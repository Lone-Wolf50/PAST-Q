import { Router, Response } from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { redis } from '../lib/redis';
import { generateQuestion } from '../lib/question-generator';
import { awardBadges, BADGE_REGISTRY } from '../lib/badges';

const router = Router();

// All quiz routes require authentication
router.use(protect);

/**
 * Helper to get the ISO string for the start of the current week (Monday 00:00:00 UTC)
 */
function getStartOfWeek(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff, 0, 0, 0, 0));
  return start.toISOString();
}

/**
 * Helper to get the ISO string for the start of the current month (1st day 00:00:00 UTC)
 */
function getStartOfMonth(): string {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return start.toISOString();
}

// --- 1. START / FETCH ACTIVE QUIZ SESSION ---
router.post('/session', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { subject } = req.body;

  if (!subject) {
    res.status(400).json({ error: 'Subject selection is required to start a quiz.' });
    return;
  }

  try {
    // Check for an active session of the selected subject (started in the last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: activeSession, error: fetchErr } = await supabase
      .from('upsa_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('subject', subject)
      .gte('started_at', twoHoursAgo)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (activeSession) {
      res.status(200).json({ session: activeSession });
      return;
    }

    // Otherwise, create a new session with the chosen subject
    const { data: newSession, error: createErr } = await supabase
      .from('upsa_sessions')
      .insert({ user_id: userId, subject, questions_shown: [] })
      .select('*')
      .single();

    if (createErr) throw createErr;

    // Check daily login bonus
    const { data: userData } = await supabase
      .from('upsa_users')
      .select('total_points, last_login_at, login_streak')
      .eq('id', userId)
      .single();

    if (userData) {
      const nowStr = new Date().toISOString().split('T')[0];
      const lastLoginStr = userData.last_login_at ? new Date(userData.last_login_at).toISOString().split('T')[0] : '';

      if (lastLoginStr !== nowStr) {
        let newStreak = userData.login_streak || 0;
        if (userData.last_login_at) {
          const diffTime = Math.abs(Date.now() - new Date(userData.last_login_at).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays <= 1.5) {
            newStreak += 1;
          } else {
            newStreak = 1;
          }
        } else {
          newStreak = 1;
        }

        await supabase
          .from('upsa_users')
          .update({
            total_points: (userData.total_points || 0) + 5,
            last_login_at: new Date().toISOString(),
            login_streak: newStreak
          })
          .eq('id', userId);
      }
    }

    res.status(201).json({ session: newSession });
  } catch (err: any) {
    console.error('❌ [Quiz Session] Error:', err.message);
    res.status(500).json({ error: 'Failed to start quiz session.' });
  }
});

// --- 2. GET CURRENT / NEXT QUESTION (Anti-Cheat: Excludes Correct Answer) ---
router.get('/question', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    // 1. Fetch active session
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: session, error: sessionErr } = await supabase
      .from('upsa_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', twoHoursAgo)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionErr || !session) {
      res.status(400).json({ error: 'No active session found. Please start a session first.' });
      return;
    }

    let shownIds: string[] = [];
    try {
      shownIds = typeof session.questions_shown === 'string'
        ? JSON.parse(session.questions_shown)
        : session.questions_shown;
    } catch {
      shownIds = [];
    }

    // Check if user has an unanswered question from this session
    if (shownIds.length > 0) {
      const lastQuestionId = shownIds[shownIds.length - 1];
      const { data: sub } = await supabase
        .from('upsa_submissions')
        .select('id')
        .eq('user_id', userId)
        .eq('question_id', lastQuestionId)
        .maybeSingle();

      if (!sub) {
        // Serve the unanswered question again
        const { data: question } = await supabase
          .from('upsa_questions')
          .select('id, body, category, difficulty, options, time_limit_seconds')
          .eq('id', lastQuestionId)
          .single();

        if (question) {
          res.status(200).json({ question });
          return;
        }
      } else {
        // The last served question was already answered.
        // If we've already served 10 questions, this session is completed!
        if (shownIds.length >= 10) {
          res.status(400).json({ error: 'This quiz session is already completed.', isCompleted: true });
          return;
        }
      }
    }

    // 2. Generate a new question dynamically
    const qData = await generateQuestion(session.subject);

    // 3. Save to questions table
    const { data: dbQuestion, error: qErr } = await supabase
      .from('upsa_questions')
      .insert(qData)
      .select('*')
      .single();

    if (qErr || !dbQuestion) throw qErr;

    // 4. Update session
    shownIds.push(dbQuestion.id);
    await supabase
      .from('upsa_sessions')
      .update({ questions_shown: shownIds })
      .eq('id', session.id);

    // 5. Send to client, STRICTLY EXCLUDING correct_answer column
    const clientQuestion = {
      id: dbQuestion.id,
      body: dbQuestion.body,
      category: dbQuestion.category,
      difficulty: dbQuestion.difficulty,
      options: dbQuestion.options,
      time_limit_seconds: dbQuestion.time_limit_seconds
    };

    res.status(200).json({ question: clientQuestion });
  } catch (err: any) {
    console.error('❌ [Quiz Question] Error:', err.message);
    res.status(500).json({ error: 'Failed to serve next question.' });
  }
});

// --- 3. SUBMIT ANSWER ---
router.post('/submit', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { question_id, submitted_answer } = req.body;

  if (!question_id || submitted_answer === undefined) {
    res.status(400).json({ error: 'Question ID and submitted answer are required.' });
    return;
  }

  try {
    const now = new Date();

    // 1. Rate limit: max 1 submission per question per user
    const { data: existingSub } = await supabase
      .from('upsa_submissions')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', question_id)
      .maybeSingle();

    if (existingSub) {
      res.status(409).json({ error: 'You have already submitted an answer to this question.' });
      return;
    }

    // 2. Fetch the question to get the correct answer and time limits
    const { data: question, error: qErr } = await supabase
      .from('upsa_questions')
      .select('*')
      .eq('id', question_id)
      .single();

    if (qErr || !question) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    // 3. Find the user's active session to calculate server-side elapsed time
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: session, error: sessionErr } = await supabase
      .from('upsa_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', twoHoursAgo)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (sessionErr || !session) {
      res.status(400).json({ error: 'No active session found.' });
      return;
    }

    let shownIds: string[] = [];
    try {
      shownIds = typeof session.questions_shown === 'string'
        ? JSON.parse(session.questions_shown)
        : session.questions_shown;
    } catch {
      shownIds = [];
    }

    const questionIndex = shownIds.indexOf(question_id);
    if (questionIndex === -1) {
      res.status(400).json({ error: 'This question was not served in your current session.' });
      return;
    }

    // Calculate start time for the question
    let startTime = new Date(session.started_at).getTime();
    if (questionIndex > 0) {
      const prevQuestionId = shownIds[questionIndex - 1];
      const { data: prevSub } = await supabase
        .from('upsa_submissions')
        .select('submitted_at')
        .eq('user_id', userId)
        .eq('question_id', prevQuestionId)
        .single();

      if (prevSub) {
        startTime = new Date(prevSub.submitted_at).getTime();
      }
    }

    const timeTakenMs = now.getTime() - startTime;

    // Flag sub-1000ms submissions as suspicious
    if (timeTakenMs < 1000) {
      console.warn(`🚨 [Anti-Cheat] Suspiciously fast submission: User ID ${userId} answered Question ${question_id} in ${timeTakenMs}ms.`);
    }

    // 4. Enforce time limit (allow a 2-second buffer for latency)
    const allowedTimeMs = (question.time_limit_seconds * 1000) + 2000;
    const isExpired = timeTakenMs > allowedTimeMs;

    // 5. Evaluate correctness and calculate points
    const isCorrect = !isExpired && (submitted_answer.trim() === question.correct_answer.trim());
    let pointsAwarded = 0;

    if (isCorrect) {
      pointsAwarded = 10;

      // Speed bonus
      if (timeTakenMs < 3000) {
        pointsAwarded += 5;
      } else if (timeTakenMs < 6000) {
        pointsAwarded += 3;
      } else if (timeTakenMs < 10000) {
        pointsAwarded += 1;
      }

      // Streak bonus: 1.5x multiply if user has 3+ correct answers in a row (including current)
      const { data: lastSubs } = await supabase
        .from('upsa_submissions')
        .select('is_correct')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(2);

      if (lastSubs && lastSubs.length === 2 && lastSubs.every(s => s.is_correct)) {
        pointsAwarded = Math.round(pointsAwarded * 1.5);
      }
    }

    // 6. Log submission
    const { error: insertErr } = await supabase
      .from('upsa_submissions')
      .insert({
        user_id: userId,
        question_id,
        submitted_answer,
        time_taken_ms: timeTakenMs,
        is_correct: isCorrect,
        points_awarded: pointsAwarded,
        submitted_at: now.toISOString()
      });

    if (insertErr) throw insertErr;

    // Calculate current session stats
    const otherQuestionIds = shownIds.filter(id => id !== question_id);
    let totalSessionPoints = pointsAwarded;
    let correctCount = isCorrect ? 1 : 0;

    if (otherQuestionIds.length > 0) {
      const { data: prevSubs } = await supabase
        .from('upsa_submissions')
        .select('points_awarded, is_correct')
        .eq('user_id', userId)
        .in('question_id', otherQuestionIds);

      if (prevSubs) {
        prevSubs.forEach(s => {
          totalSessionPoints += Number(s.points_awarded) || 0;
          if (s.is_correct) correctCount += 1;
        });
      }
    }

    const isSessionComplete = shownIds.length === 10 && questionIndex === 9;
    let earnedBadges: string[] = [];

    if (isSessionComplete) {
      // 7. Update user's total points ONLY on full session completion
      const { data: userRecord } = await supabase
        .from('upsa_users')
        .select('total_points')
        .eq('id', userId)
        .single();

      if (userRecord) {
        await supabase
          .from('upsa_users')
          .update({ total_points: (userRecord.total_points || 0) + totalSessionPoints })
          .eq('id', userId);
      }

      // 8. Award badges automatically
      earnedBadges = await awardBadges(userId);
    }

    res.status(200).json({
      is_correct: isCorrect,
      correct_answer: question.correct_answer, // Return answer for student feedback
      points_awarded: pointsAwarded,
      time_taken_ms: timeTakenMs,
      is_expired: isExpired,
      is_completed: isSessionComplete,
      session_points: totalSessionPoints,
      session_correct: correctCount,
      session_total: 10,
      earned_badges: earnedBadges
    });
  } catch (err: any) {
    console.error('❌ [Quiz Submit] Error:', err.message);
    res.status(500).json({ error: 'Failed to submit answer.' });
  }
});

// --- 4. LEADERBOARD (All-Time, Weekly, Monthly) ---
router.get('/leaderboard', async (req: AuthRequest, res: Response): Promise<void> => {
  const period = (req.query.period as string) || 'all_time';

  if (!['all_time', 'weekly', 'monthly'].includes(period)) {
    res.status(400).json({ error: 'Invalid period parameter.' });
    return;
  }

  const cacheKey = `leaderboard:${period}`;

  try {
    // 1. Try to read from Redis cache
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        res.status(200).json({ leaderboard: parsed });
        return;
      }
    }

    // 2. Fetch/calculate leaderboard from database
    let leaderboardData: any[] = [];

    if (period === 'all_time') {
      const { data: users } = await supabase
        .from('upsa_users')
        .select('id, username, total_points, avatar_url, upsa_user_badges(count)')
        .order('total_points', { ascending: false })
        .limit(100);

      leaderboardData = (users || []).map((u: any, idx) => ({
        rank: idx + 1,
        user_id: u.id,
        username: u.username || 'Student',
        score: u.total_points || 0,
        badge_count: u.upsa_user_badges?.[0]?.count || 0,
        avatar_url: u.avatar_url
      }));
    } else {
      // For Weekly / Monthly, fetch submissions from the start period
      const startDate = period === 'weekly' ? getStartOfWeek() : getStartOfMonth();

      const { data: submissions, error: subErr } = await supabase
        .from('upsa_submissions')
        .select('user_id, points_awarded, upsa_users(username, avatar_url, upsa_user_badges(count))')
        .gte('submitted_at', startDate);

      if (subErr) throw subErr;

      // Group and sum in JS
      const userSums: Record<string, { username: string; avatar_url: string; score: number; badge_count: number }> = {};
      (submissions || []).forEach((s: any) => {
        const uid = s.user_id;
        const pts = Number(s.points_awarded) || 0;
        if (!userSums[uid]) {
          userSums[uid] = {
            username: s.upsa_users?.username || 'Student',
            avatar_url: s.upsa_users?.avatar_url || '',
            score: 0,
            badge_count: s.upsa_users?.upsa_user_badges?.[0]?.count || 0
          };
        }
        userSums[uid].score += pts;
      });

      // Sort and map to leaderboard array
      leaderboardData = Object.keys(userSums)
        .map(uid => ({
          user_id: uid,
          username: userSums[uid].username,
          avatar_url: userSums[uid].avatar_url,
          score: userSums[uid].score,
          badge_count: userSums[uid].badge_count
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 100)
        .map((entry, idx) => ({
          rank: idx + 1,
          ...entry
        }));

      // Update snapshots table
      await supabase.from('upsa_leaderboard_snapshots').delete().eq('period', period);
      if (leaderboardData.length > 0) {
        const snapshots = leaderboardData.map(l => ({
          user_id: l.user_id,
          period,
          score: l.score,
          rank: l.rank
        }));
        await supabase.from('upsa_leaderboard_snapshots').insert(snapshots);
      }
    }

    // 3. Cache top 100 in Redis (refresh every 5 minutes)
    if (redis && leaderboardData.length > 0) {
      await redis.set(cacheKey, JSON.stringify(leaderboardData), { ex: 300 });
    }

    res.status(200).json({ leaderboard: leaderboardData });
  } catch (err: any) {
    console.error(`❌ [Quiz Leaderboard] Error fetching ${period}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

// --- 5. GET USER STATS & BADGES COLLECTION ---
router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    // 1. Fetch user data (points, streak)
    const { data: user, error: userErr } = await supabase
      .from('upsa_users')
      .select('total_points, login_streak, created_at')
      .eq('id', userId)
      .single();

    if (userErr || !user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // 2. Fetch submissions details
    const { data: subs } = await supabase
      .from('upsa_submissions')
      .select('is_correct')
      .eq('user_id', userId);

    const totalAnswered = subs ? subs.length : 0;
    const correctCount = subs ? subs.filter(s => s.is_correct).length : 0;
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    // 3. Fetch earned badges
    const { data: earnedRows } = await supabase
      .from('upsa_user_badges')
      .select('badge_slug, earned_at')
      .eq('user_id', userId);

    const earnedMap = new Map((earnedRows || []).map(r => [r.badge_slug, r.earned_at]));

    // 4. Calculate user's current rank on global all-time leaderboard
    const { data: rankQuery } = await supabase
      .from('upsa_users')
      .select('id')
      .order('total_points', { ascending: false });

    const rank = rankQuery ? rankQuery.findIndex((u: any) => u.id === userId) + 1 : 0;

    // 5. Check if user qualifies for leaderboard badges
    if (rank > 0) {
      if (rank === 1 && !earnedMap.has('champion')) {
        await supabase.from('upsa_user_badges').insert({ user_id: userId, badge_slug: 'champion' });
        earnedMap.set('champion', new Date().toISOString());
      }
      if (rank <= 3 && !earnedMap.has('top_3')) {
        await supabase.from('upsa_user_badges').insert({ user_id: userId, badge_slug: 'top_3' });
        earnedMap.set('top_3', new Date().toISOString());
      }
      if (rank <= 10 && !earnedMap.has('top_10')) {
        await supabase.from('upsa_user_badges').insert({ user_id: userId, badge_slug: 'top_10' });
        earnedMap.set('top_10', new Date().toISOString());
      }
    }

    // 6. Build badge collection (unlocked + locked, filtering out unearned hidden badges)
    const badges = Object.keys(BADGE_REGISTRY)
      .map(slug => {
        const isEarned = earnedMap.has(slug);
        const earned_at = earnedMap.get(slug) || null;
        const meta = BADGE_REGISTRY[slug];

        return {
          slug,
          name: meta.name,
          description: meta.description,
          icon: meta.icon,
          condition: meta.condition,
          hidden: meta.hidden,
          is_earned: isEarned,
          earned_at
        };
      })
      .filter(badge => !badge.hidden || badge.is_earned);

    res.status(200).json({
      stats: {
        points: user.total_points || 0,
        login_streak: user.login_streak || 0,
        total_answered: totalAnswered,
        correct_answered: correctCount,
        accuracy,
        rank
      },
      badges
    });
  } catch (err: any) {
    console.error('❌ [Quiz Stats] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user quiz stats.' });
  }
});

export default router;
