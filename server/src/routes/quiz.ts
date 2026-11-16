import { Router, Response } from 'express';
import { protect, adminOnly, AuthRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { redis } from '../lib/redis';
import {
  generateQuestion,
  generateQuestionsBatch,
  calculateQuestionTiming,
  normalizeDifficulty,
  DIFFICULTY_CONFIG_MAP,
  QuestionDifficulty,
} from '../lib/question-generator';
import { awardBadges, BADGE_REGISTRY } from '../lib/badges';
import { performOcrPipeline } from '../lib/ocr';
import { getAiCompletion } from '../lib/ai-helper';
import { GoogleGenAI } from '@google/genai';
import { askPuter, isPuterAvailable } from '../lib/puter';
import { getHFConfig, getHFModelId, defaultHFModels, askHuggingFace } from '../lib/huggingface';
const pdfParse = require('pdf-parse');

const router = Router();

/** Clear cached leaderboard periods so point updates appear immediately. */
async function invalidateLeaderboardCache(): Promise<void> {
  if (!redis) return;
  await Promise.all([
    redis.del('leaderboard:all_time'),
    redis.del('leaderboard:weekly'),
    redis.del('leaderboard:monthly')
  ]);
}

/** Return active streak only if the user pinged today or yesterday; otherwise 0. */
function getEffectiveStreak(streakCount?: number | null, streakLastDate?: string | null): number {
  const count = streakCount || 0;
  if (count <= 0 || !streakLastDate) return 0;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  return streakLastDate === todayStr || streakLastDate === yesterdayStr ? count : 0;
}

/** Check if an entry in `upsa_sessions.questions_shown` is a metadata tag rather than a question UUID. */
function isSessionMetaTag(entry: string): boolean {
  return (
    typeof entry !== 'string' ||
    entry === 'is_custom:true' ||
    entry.startsWith('paper_id:') ||
    entry.startsWith('paper_title:') ||
    entry.startsWith('difficulty:') ||
    entry.startsWith('timed:') ||
    entry.startsWith('time_limit:')
  );
}

function getSessionPaperMeta(shownIds: string[]): {
  paperId?: string;
  paperTitle?: string;
  difficulty?: QuestionDifficulty;
  timed: boolean;
  timeLimitSec?: number;
} {
  const idTag = shownIds.find((s) => typeof s === 'string' && s.startsWith('paper_id:'));
  const titleTag = shownIds.find((s) => typeof s === 'string' && s.startsWith('paper_title:'));
  const diffTag = shownIds.find((s) => typeof s === 'string' && s.startsWith('difficulty:'));
  const timedTag = shownIds.find((s) => typeof s === 'string' && s.startsWith('timed:'));
  const timeLimitTag = shownIds.find((s) => typeof s === 'string' && s.startsWith('time_limit:'));
  const parsedTimeLimit = timeLimitTag ? Number(timeLimitTag.slice('time_limit:'.length)) : NaN;
  return {
    paperId: idTag ? idTag.slice('paper_id:'.length) : undefined,
    paperTitle: titleTag ? titleTag.slice('paper_title:'.length) : undefined,
    difficulty: diffTag ? normalizeDifficulty(diffTag.slice('difficulty:'.length)) : undefined,
    timed: timedTag ? timedTag.slice('timed:'.length) !== 'false' : true,
    timeLimitSec:
      Number.isFinite(parsedTimeLimit) && parsedTimeLimit >= 15 && parsedTimeLimit <= 300
        ? Math.round(parsedTimeLimit)
        : undefined,
  };
}

/** Format a DB question row for the client (excluding correct_answer) with reading time & difficulty metadata. */
function formatClientQuestion(q: any, displaySubject: string, timed = true, overrideTimeLimitSec?: number) {
  const timing = calculateQuestionTiming(q.body, q.options, q.difficulty);
  return {
    id: q.id,
    body: q.body,
    category: displaySubject,
    difficulty: timing.difficulty,
    options: q.options,
    timed,
    time_limit_seconds: overrideTimeLimitSec ?? Math.max(Number(q.time_limit_seconds) || 0, timing.time_limit_seconds),
    reading_time_seconds: timing.reading_time_seconds,
    base_points: timed ? timing.base_points : Math.ceil(timing.base_points * 0.5),
    speed_tiers: timed ? timing.speed_tiers : [],
  };
}

/** Track in-flight batch pre-generation per session so we never duplicate AI calls. */
const inFlightSessionPrewarms = new Map<string, Promise<string[]>>();

/** Cache of prewarmed question IDs keyed by paper_id or subject name for instant session startup. */
const prewarmedCoursePool = new Map<string, string[]>();
const inFlightCoursePrewarms = new Map<string, Promise<string[]>>();

function prewarmCourseQuestions(
  subject: string,
  paperId?: string,
  paperTitle?: string,
  targetDifficulty?: QuestionDifficulty
): Promise<string[]> {
  const diffSuffix = targetDifficulty ? `:${targetDifficulty}` : '';
  const key = (paperId ? `paper:${paperId}` : `subject:${subject}`) + diffSuffix;
  const existing = inFlightCoursePrewarms.get(key);
  if (existing) return existing;

  const cached = prewarmedCoursePool.get(key);
  if (cached && cached.length >= 5) {
    return Promise.resolve(cached);
  }

  const task = (async (): Promise<string[]> => {
    try {
      const batch = await generateQuestionsBatch(6, subject, paperId, paperTitle, targetDifficulty);
      const { data: inserted } = await supabase
        .from('upsa_questions')
        .insert(batch)
        .select('id');

      const ids = (inserted || []).map((r: any) => r.id);
      if (ids.length > 0) {
        const prev = prewarmedCoursePool.get(key) || [];
        prewarmedCoursePool.set(key, [...prev, ...ids].slice(-20));
      }
      return ids;
    } catch {
      return [];
    } finally {
      inFlightCoursePrewarms.delete(key);
    }
  })();

  inFlightCoursePrewarms.set(key, task);
  return task;
}

/**
 * Pre-generates a full batch of quiz questions for a session so that once the student enters
 * the arena, all subsequent questions are already ready in `upsa_sessions.questions_shown` with 0ms wait.
 */
function prewarmSessionQuestions(
  sessionId: string,
  subject: string,
  paperId: string | undefined,
  paperTitle: string | undefined,
  targetCount: number,
  targetDifficulty?: QuestionDifficulty
): Promise<string[]> {
  const existingPromise = inFlightSessionPrewarms.get(sessionId);
  if (existingPromise) return existingPromise;

  const task = (async (): Promise<string[]> => {
    try {
      const { data: sess } = await supabase
        .from('upsa_sessions')
        .select('questions_shown')
        .eq('id', sessionId)
        .maybeSingle();

      if (!sess) return [];

      let shownIds: string[] = [];
      try {
        shownIds = typeof sess.questions_shown === 'string'
          ? JSON.parse(sess.questions_shown)
          : (sess.questions_shown || []);
      } catch {
        shownIds = [];
      }

      const currentQIds = shownIds.filter((id: string) => !isSessionMetaTag(id));
      const needed = targetCount - currentQIds.length;
      if (needed <= 0) return currentQIds;

      let newQuestionIds: string[] = [];
      try {
        const batch = await generateQuestionsBatch(needed, subject, paperId, paperTitle, targetDifficulty);
        const { data: inserted } = await supabase
          .from('upsa_questions')
          .insert(batch)
          .select('id');

        if (inserted && inserted.length > 0) {
          newQuestionIds = inserted.map((r: any) => r.id);
        }
      } catch (batchErr: any) {
        console.warn('⚠️ [Quiz Prewarm] Batch AI generation failed, falling back to single/pool:', batchErr.message);
        try {
          const singleQ = await generateQuestion(subject, paperId, paperTitle, targetDifficulty);
          const { data: insertedSingle } = await supabase
            .from('upsa_questions')
            .insert(singleQ)
            .select('id')
            .single();
          if (insertedSingle) {
            newQuestionIds = [insertedSingle.id];
          }
        } catch {
          // Pool fallback is handled below if still needed
        }
      }

      if (newQuestionIds.length < needed) {
        const stillNeeded = needed - newQuestionIds.length;
        let poolQuery = supabase
          .from('upsa_questions')
          .select('id')
          .eq('category', subject)
          .limit(60);
        if (targetDifficulty) {
          poolQuery = poolQuery.eq('difficulty', targetDifficulty);
        }
        const { data: poolQuestions } = await poolQuery;

        const exclude = new Set([...currentQIds, ...newQuestionIds]);
        const unseenPool = (poolQuestions || [])
          .map((q: any) => q.id)
          .filter((id: string) => !exclude.has(id));

        for (let i = 0; i < stillNeeded && unseenPool.length > 0; i++) {
          const pickIdx = Math.floor(Math.random() * unseenPool.length);
          newQuestionIds.push(unseenPool.splice(pickIdx, 1)[0]);
        }
      }

      if (newQuestionIds.length > 0) {
        // Re-fetch latest questions_shown to merge cleanly without race conditions
        const { data: latestSess } = await supabase
          .from('upsa_sessions')
          .select('questions_shown')
          .eq('id', sessionId)
          .maybeSingle();

        let latestShown: string[] = shownIds;
        if (latestSess?.questions_shown) {
          try {
            latestShown = typeof latestSess.questions_shown === 'string'
              ? JSON.parse(latestSess.questions_shown)
              : latestSess.questions_shown;
          } catch {
            latestShown = shownIds;
          }
        }

        const existingSet = new Set(latestShown);
        const merged = [...latestShown];
        for (const qId of newQuestionIds) {
          if (!existingSet.has(qId) && merged.filter((id: string) => !isSessionMetaTag(id)).length < targetCount) {
            merged.push(qId);
            existingSet.add(qId);
          }
        }

        await supabase
          .from('upsa_sessions')
          .update({ questions_shown: merged })
          .eq('id', sessionId);

        return merged.filter((id: string) => !isSessionMetaTag(id));
      }

      return currentQIds;
    } catch (err: any) {
      console.warn('⚠️ [Quiz Prewarm] Error:', err.message);
      return [];
    } finally {
      inFlightSessionPrewarms.delete(sessionId);
    }
  })();

  inFlightSessionPrewarms.set(sessionId, task);
  return task;
}

// All quiz routes require authentication
router.use(protect);

// --- 9. BACKFILL STREAK POINTS (one-time migration) ---
// POST /quiz/backfill-streak-points
// Awards 5 points per streak_count day for users who had streaks before the points system.
router.post('/backfill-streak-points', adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Fetch all users with streak_count > 0 and total_points = 0 (never earned quiz points)
    const { data: eligibleUsers, error: fetchErr } = await supabase
      .from('upsa_users')
      .select('id, username, streak_count, total_points')
      .gt('streak_count', 0)
      .eq('total_points', 0);

    if (fetchErr) throw fetchErr;

    if (!eligibleUsers || eligibleUsers.length === 0) {
      res.status(200).json({ message: 'No users need backfill.', updated: 0 });
      return;
    }

    let updatedCount = 0;
    const results: { username: string; streak: number; points_awarded: number }[] = [];

    for (const user of eligibleUsers) {
      const streakPoints = (user.streak_count || 0) * 5;
      if (streakPoints <= 0) continue;

      const { error: updateErr } = await supabase
        .from('upsa_users')
        .update({ total_points: streakPoints })
        .eq('id', user.id);

      if (!updateErr) {
        updatedCount++;
        results.push({
          username: user.username || 'Student',
          streak: user.streak_count,
          points_awarded: streakPoints
        });
      }
    }

    // Clear Redis leaderboard cache so new points show immediately
    await invalidateLeaderboardCache();

    console.log(`✅ [Backfill] Updated ${updatedCount} users with streak-based points.`);
    res.status(200).json({
      message: `Backfilled points for ${updatedCount} users.`,
      updated: updatedCount,
      details: results
    });
  } catch (err: any) {
    console.error('❌ [Backfill Streak Points] Error:', err.message);
    res.status(500).json({ error: 'Failed to backfill streak points.' });
  }
});

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

// --- 0. PREWARM QUESTIONS WHEN STUDENT CLICKS A COURSE ---
router.post('/prewarm', async (req: AuthRequest, res: Response): Promise<void> => {
  const { subject, paper_id, difficulty } = req.body || {};
  try {
    let canonicalSubject = String(subject || '').trim();
    let matchedPaperId: string | undefined;
    let matchedPaperTitle: string | undefined;
    const targetDifficulty = difficulty ? normalizeDifficulty(difficulty) : undefined;

    if (paper_id) {
      const { data: paperRow } = await supabase
        .from('upsa_papers')
        .select('id, title, upsa_subjects(name)')
        .eq('id', paper_id)
        .maybeSingle();

      if (paperRow) {
        matchedPaperId = (paperRow as any).id;
        matchedPaperTitle = (paperRow as any).title;
        canonicalSubject = (paperRow as any).upsa_subjects?.name || canonicalSubject;
      }
    }

    if (canonicalSubject) {
      void prewarmCourseQuestions(canonicalSubject, matchedPaperId, matchedPaperTitle, targetDifficulty);
    }
    res.status(200).json({ ok: true });
  } catch {
    res.status(200).json({ ok: false });
  }
});

// --- 1. START / FETCH ACTIVE QUIZ SESSION ---
router.post('/session', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { subject, paper_id, force_new, difficulty, timed, time_limit_seconds } = req.body;
  const requestedDiff = difficulty ? normalizeDifficulty(difficulty) : undefined;
  const requestedTimed = timed !== false;
  const parsedTimeLimit = Number(time_limit_seconds);
  const requestedTimeLimitSec =
    requestedTimed && Number.isFinite(parsedTimeLimit) && parsedTimeLimit >= 15 && parsedTimeLimit <= 300
      ? Math.round(parsedTimeLimit)
      : undefined;

  if ((!subject || !String(subject).trim()) && !paper_id) {
    res.status(400).json({ error: 'Course selection is required to start a quiz.' });
    return;
  }

  const trimmedSubject = String(subject || '').trim();

  try {
    // 1. Fetch all subjects and resolve either a specific paper (out of all 617 papers) or a subject
    const { data: allSubjects, error: subjectErr } = await supabase
      .from('upsa_subjects')
      .select('id, name, code');

    if (subjectErr) throw subjectErr;

    const lowerInput = trimmedSubject.toLowerCase();
    let canonicalSubject = '';
    let matchedPaperId: string | undefined;
    let matchedPaperTitle: string | undefined;

    if (paper_id) {
      const { data: paperRow } = await supabase
        .from('upsa_papers')
        .select('id, title, upsa_subjects(id, name, code)')
        .eq('id', paper_id)
        .maybeSingle();

      if (paperRow) {
        matchedPaperId = (paperRow as any).id;
        matchedPaperTitle = (paperRow as any).title;
        canonicalSubject = (paperRow as any).upsa_subjects?.name || allSubjects?.[0]?.name || '';
      }
    }

    if (!canonicalSubject && trimmedSubject) {
      // Check upsa_subjects by name or code first
      const subjectMatch = (allSubjects || []).find(
        (s: any) =>
          s.name?.trim().toLowerCase() === lowerInput ||
          (s.code && s.code.trim().toLowerCase() === lowerInput)
      );

      if (subjectMatch) {
        canonicalSubject = subjectMatch.name;
      } else {
        // Otherwise check all 617 papers in upsa_papers by title
        const { data: paperMatches } = await supabase
          .from('upsa_papers')
          .select('id, title, upsa_subjects(id, name, code)')
          .ilike('title', trimmedSubject)
          .limit(1);

        if (paperMatches && paperMatches.length > 0) {
          const p = paperMatches[0] as any;
          matchedPaperId = p.id;
          matchedPaperTitle = p.title;
          canonicalSubject = p.upsa_subjects?.name || allSubjects?.[0]?.name || '';
        }
      }
    }

    if (!canonicalSubject) {
      res.status(404).json({
        error: 'subject_not_available',
        message: `The course "${trimmedSubject}" is currently not available or does not exist. Please choose a course from the list.`
      });
      return;
    }

    // Fetch user plan early so we know total questions per session and daily limits
    const { data: limitUserData, error: userErr } = await supabase
      .from('upsa_users')
      .select('plan')
      .eq('id', userId)
      .single();

    if (userErr) throw userErr;
    const plan = (limitUserData?.plan || 'free').toLowerCase();
    const sessionQuestionTarget = plan === 'free' ? 5 : 10;

    // Check for an INCOMPLETE active standard session of the selected course/subject (started in the last 2 hours)
    if (!force_new) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: activeSessions, error: fetchErr } = await supabase
        .from('upsa_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('subject', canonicalSubject)
        .gte('started_at', twoHoursAgo)
        .order('started_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      for (const s of activeSessions || []) {
        let shownIds: string[] = [];
        try {
          shownIds = typeof s.questions_shown === 'string'
            ? JSON.parse(s.questions_shown)
            : s.questions_shown;
        } catch {
          shownIds = [];
        }
        if (shownIds.includes('is_custom:true')) continue;

        const { paperId: sessPaperId, difficulty: sessDiff, timed: sessTimed, timeLimitSec: sessTimeLimit } = getSessionPaperMeta(shownIds);
        if (matchedPaperId && sessPaperId !== matchedPaperId) continue;
        if (requestedDiff && sessDiff !== requestedDiff) continue;
        if (sessTimed !== requestedTimed) continue;
        if (requestedTimeLimitSec !== undefined && sessTimeLimit !== requestedTimeLimitSec) continue;

        const qIds = shownIds.filter((id: string) => !isSessionMetaTag(id));
        if (qIds.length < sessionQuestionTarget) {
          res.status(200).json({ session: s });
          return;
        }

        // If all target questions were shown, check if any remain unanswered
        const { count: answeredCount } = await supabase
          .from('upsa_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('question_id', qIds);

        if ((answeredCount ?? 0) < qIds.length) {
          res.status(200).json({ session: s });
          return;
        }
      }
    }

    if (plan === 'free' || plan === 'basic') {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentSessions, error: countErr } = await supabase
        .from('upsa_sessions')
        .select('questions_shown')
        .eq('user_id', userId)
        .gte('started_at', twentyFourHoursAgo);

      if (countErr) throw countErr;

      // Count standard (Arena) sessions that actually served at least 1 question
      const standardCount = (recentSessions || []).filter((s: any) => {
        try {
          const shown = typeof s.questions_shown === 'string'
            ? JSON.parse(s.questions_shown)
            : s.questions_shown;
          if (!Array.isArray(shown) || shown.includes('is_custom:true')) return false;
          return shown.some((id: string) => !isSessionMetaTag(id));
        } catch { return false; }
      }).length;

      const limit = plan === 'free' ? 5 : 20;
      if (standardCount >= limit) {
        res.status(403).json({
          error: 'quiz_limit_reached',
          message: `You have reached your daily limit of ${limit} Arena quizzes on the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan. Upgrade to Plus or Pro to take unlimited quizzes!`
        });
        return;
      }
    }

    const initialMetaTags: string[] = [];
    if (matchedPaperId) initialMetaTags.push(`paper_id:${matchedPaperId}`);
    if (matchedPaperTitle) initialMetaTags.push(`paper_title:${matchedPaperTitle}`);
    if (requestedDiff) initialMetaTags.push(`difficulty:${requestedDiff}`);
    initialMetaTags.push(`timed:${requestedTimed}`);
    if (requestedTimeLimitSec !== undefined) initialMetaTags.push(`time_limit:${requestedTimeLimitSec}`);

    // Seed with any already-prewarmed or unseen pool questions so Question 1 starts with 0ms wait
    const diffSuffix = requestedDiff ? `:${requestedDiff}` : '';
    const courseKey = (matchedPaperId ? `paper:${matchedPaperId}` : `subject:${canonicalSubject}`) + diffSuffix;
    let candidatePoolIds = [...(prewarmedCoursePool.get(courseKey) || [])];

    if (candidatePoolIds.length === 0) {
      let poolQuery = supabase
        .from('upsa_questions')
        .select('id')
        .eq('category', canonicalSubject)
        .order('created_at', { ascending: false })
        .limit(30);
      if (requestedDiff) {
        poolQuery = poolQuery.eq('difficulty', requestedDiff);
      }
      const { data: existingPool } = await poolQuery;
      candidatePoolIds = (existingPool || []).map((q: any) => q.id);
    }

    if (candidatePoolIds.length > 0) {
      const { data: answeredRows } = await supabase
        .from('upsa_submissions')
        .select('question_id')
        .eq('user_id', userId)
        .in('question_id', candidatePoolIds);
      const answeredSet = new Set((answeredRows || []).map((r: any) => r.question_id));
      const unseenSeed = candidatePoolIds
        .filter((id: string) => !answeredSet.has(id))
        .slice(0, Math.min(3, sessionQuestionTarget));
      initialMetaTags.push(...unseenSeed);
    }

    // Create a new session with the canonical subject name (for FK integrity) + paper metadata tags + seeded questions
    const { data: newSession, error: createErr } = await supabase
      .from('upsa_sessions')
      .insert({ user_id: userId, subject: canonicalSubject, questions_shown: initialMetaTags })
      .select('*')
      .single();

    if (createErr) throw createErr;

    // Immediately kick off background batch pre-generation for all remaining questions in this session
    // so the student never waits between questions!
    void prewarmSessionQuestions(
      newSession.id,
      canonicalSubject,
      matchedPaperId,
      matchedPaperTitle,
      sessionQuestionTarget,
      requestedDiff
    );

    // Check daily login bonus
    const { data: userData } = await supabase
      .from('upsa_users')
      .select('total_points, last_login_at')
      .eq('id', userId)
      .single();

    if (userData) {
      const nowStr = new Date().toISOString().split('T')[0];
      const lastLoginStr = userData.last_login_at ? new Date(userData.last_login_at).toISOString().split('T')[0] : '';

      if (lastLoginStr !== nowStr) {
        await supabase
          .from('upsa_users')
          .update({
            total_points: (userData.total_points || 0) + 5,
            last_login_at: new Date().toISOString()
          })
          .eq('id', userId);
        await invalidateLeaderboardCache();
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
  const sessionId = req.query.session_id;

  try {
    let session;
    if (sessionId) {
      const { data, error } = await supabase
        .from('upsa_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();
      if (error || !data) {
        res.status(404).json({ error: 'Session not found.' });
        return;
      }
      session = data;
    } else {
      // 1. Fetch active standard session (excluding custom sessions)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: activeSessions, error: sessionErr } = await supabase
        .from('upsa_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('started_at', twoHoursAgo)
        .order('started_at', { ascending: false });

      if (sessionErr) throw sessionErr;

      session = (activeSessions || []).find((s: any) => {
        let shownIds: string[] = [];
        try {
          shownIds = typeof s.questions_shown === 'string'
            ? JSON.parse(s.questions_shown)
            : s.questions_shown;
        } catch {
          shownIds = [];
        }
        return !shownIds.includes('is_custom:true');
      });

      if (!session) {
        res.status(400).json({ error: 'No active session found. Please start a session first.' });
        return;
      }
    }

    let shownIds: string[] = [];
    try {
      shownIds = typeof session.questions_shown === 'string'
        ? JSON.parse(session.questions_shown)
        : session.questions_shown;
    } catch {
      shownIds = [];
    }

    // Enforce pricing plan quiz limits
    const { data: limitUserData, error: userErr } = await supabase
      .from('upsa_users')
      .select('plan')
      .eq('id', userId)
      .single();

    if (userErr) throw userErr;
    const plan = (limitUserData?.plan || 'free').toLowerCase();

    const isCustom = shownIds.includes('is_custom:true');
    const {
      paperId,
      paperTitle,
      difficulty: sessionDifficulty,
      timed: isTimedSession,
      timeLimitSec,
    } = getSessionPaperMeta(shownIds);
    const displaySubject = paperTitle || session.subject;
    const questionIds = shownIds.filter((id: string) => !isSessionMetaTag(id));
    const totalQuestions = isCustom ? questionIds.length : (plan === 'free' ? 5 : 10);

    // Fetch submissions for this session's questions
    let answeredIds = new Set<string>();
    if (questionIds.length > 0) {
      const { data: subs } = await supabase
        .from('upsa_submissions')
        .select('question_id')
        .eq('user_id', userId)
        .in('question_id', questionIds);
      answeredIds = new Set((subs || []).map((s: any) => s.question_id));
    }

    // Find the first unanswered question ID
    let nextQuestionId = questionIds.find(id => !answeredIds.has(id));

    // If we have an unanswered question ready, serve it immediately and top up remaining questions in the background
    if (nextQuestionId) {
      if (!isCustom && questionIds.length < totalQuestions) {
        void prewarmSessionQuestions(
          session.id,
          session.subject,
          paperId,
          paperTitle,
          totalQuestions,
          sessionDifficulty
        );
      }

      const { data: question, error: qErr } = await supabase
        .from('upsa_questions')
        .select('id, body, category, difficulty, options, time_limit_seconds')
        .eq('id', nextQuestionId)
        .single();

      if (qErr || !question) {
        res.status(404).json({ error: 'Question not found.' });
        return;
      }

      // Also peek the subsequent question (if already pre-generated) so the client can transition in 0ms
      const nextIdx = questionIds.indexOf(nextQuestionId) + 1;
      let prefetchedNext: any = null;
      if (nextIdx < questionIds.length) {
        const { data: peekQ } = await supabase
          .from('upsa_questions')
          .select('id, body, category, difficulty, options, time_limit_seconds')
          .eq('id', questionIds[nextIdx])
          .maybeSingle();
        if (peekQ) {
          prefetchedNext = formatClientQuestion(peekQ, displaySubject, isTimedSession, timeLimitSec);
        }
      }

      res.status(200).json({
        question: formatClientQuestion(question, displaySubject, isTimedSession, timeLimitSec),
        nextQuestion: prefetchedNext,
        totalQuestions,
        questionIndex: answeredIds.size + 1,
        subject: displaySubject,
        timed: isTimedSession,
        difficulty: sessionDifficulty
      });
      return;
    }

    // All questions in the current shownIds list are answered.
    // If we've already reached the limit, this session is completed!
    if (isCustom || questionIds.length >= totalQuestions) {
      if (plan === 'free' && !isCustom && questionIds.length >= 5) {
        res.status(403).json({
          error: 'quiz_limit_reached',
          message: 'You have reached the 5-question Free plan limit for this quiz. Upgrade to a paid plan to take full-length 10-question quizzes!'
        });
        return;
      }
      res.status(400).json({ error: 'This quiz session is already completed.', isCompleted: true });
      return;
    }

    // Otherwise, await the session prewarm batch (which generates all questions for the quiz at once)
    const prewarmedIds = await prewarmSessionQuestions(
      session.id,
      session.subject,
      paperId,
      paperTitle,
      totalQuestions,
      sessionDifficulty
    );

    nextQuestionId = prewarmedIds.find(id => !answeredIds.has(id));

    let dbQuestion: any = null;
    if (nextQuestionId) {
      const { data: fetchedQ } = await supabase
        .from('upsa_questions')
        .select('id, body, category, difficulty, options, time_limit_seconds')
        .eq('id', nextQuestionId)
        .maybeSingle();
      dbQuestion = fetchedQ;
    }

    // Final safety fallback if batch prewarm returned empty
    if (!dbQuestion) {
      try {
        const qData = await generateQuestion(session.subject, paperId, paperTitle, sessionDifficulty);
        const { data: insertedQuestion, error: qErr } = await supabase
          .from('upsa_questions')
          .insert(qData)
          .select('*')
          .single();

        if (qErr || !insertedQuestion) throw qErr;
        dbQuestion = insertedQuestion;
      } catch (genErr: any) {
        console.warn('⚠️ [Quiz Question] Dynamic generation failed, checking existing question pool:', genErr.message);
        let fallbackPoolQuery = supabase
          .from('upsa_questions')
          .select('*')
          .eq('category', session.subject)
          .limit(50);
        if (sessionDifficulty) {
          fallbackPoolQuery = fallbackPoolQuery.eq('difficulty', sessionDifficulty);
        }
        const { data: poolQuestions } = await fallbackPoolQuery;

        const unseenPool = (poolQuestions || []).filter((q: any) => !questionIds.includes(q.id));
        if (unseenPool.length > 0) {
          dbQuestion = unseenPool[Math.floor(Math.random() * unseenPool.length)];
        } else if (poolQuestions && poolQuestions.length > 0) {
          dbQuestion = poolQuestions[Math.floor(Math.random() * poolQuestions.length)];
        } else {
          throw genErr;
        }
      }

      const newShownIds = [...shownIds, dbQuestion.id];
      await supabase
        .from('upsa_sessions')
        .update({ questions_shown: newShownIds })
        .eq('id', session.id);
    }

    // Also include the second question in `nextQuestion` if available from the batch so Question 2 loads in 0ms
    let prefetchedNext: any = null;
    const nextIdxAfterCurrent = prewarmedIds.indexOf(dbQuestion.id) + 1;
    if (nextIdxAfterCurrent > 0 && nextIdxAfterCurrent < prewarmedIds.length) {
      const { data: peekQ } = await supabase
        .from('upsa_questions')
        .select('id, body, category, difficulty, options, time_limit_seconds')
        .eq('id', prewarmedIds[nextIdxAfterCurrent])
        .maybeSingle();
      if (peekQ) {
        prefetchedNext = formatClientQuestion(peekQ, displaySubject, isTimedSession, timeLimitSec);
      }
    }

    const clientQuestion = formatClientQuestion(dbQuestion, displaySubject, isTimedSession, timeLimitSec);

    res.status(200).json({
      question: clientQuestion,
      nextQuestion: prefetchedNext,
      totalQuestions,
      questionIndex: answeredIds.size + 1,
      subject: displaySubject,
      timed: isTimedSession,
      difficulty: sessionDifficulty
    });
  } catch (err: any) {
    console.error('❌ [Quiz Question] Error:', err.message);
    res.status(500).json({ error: 'Failed to serve next question.' });
  }
});

// --- 3. SUBMIT ANSWER ---
router.post('/submit', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { question_id, submitted_answer, session_id, answer_time_ms } = req.body;

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
    let session;
    if (session_id) {
      const { data, error } = await supabase
        .from('upsa_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', userId)
        .single();
      session = data;
    } else {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: activeSessions, error: sessionErr } = await supabase
        .from('upsa_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('started_at', twoHoursAgo)
        .order('started_at', { ascending: false });

      if (sessionErr) throw sessionErr;

      session = (activeSessions || []).find((s: any) => {
        let shownIds: string[] = [];
        try {
          shownIds = typeof s.questions_shown === 'string'
            ? JSON.parse(s.questions_shown)
            : s.questions_shown;
        } catch {
          shownIds = [];
        }
        return !shownIds.includes('is_custom:true');
      });
    }

    if (!session) {
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

    const { data: limitUserData, error: userErr } = await supabase
      .from('upsa_users')
      .select('plan')
      .eq('id', userId)
      .single();

    if (userErr) throw userErr;
    const plan = (limitUserData?.plan || 'free').toLowerCase();

    const isCustom = shownIds.includes('is_custom:true');
    const { paperTitle, timed: isTimedSession, timeLimitSec } = getSessionPaperMeta(shownIds);
    const displaySubject = paperTitle || session.subject;
    const questionIds = shownIds.filter((id: string) => !isSessionMetaTag(id));
    const totalQs = isCustom ? questionIds.length : (plan === 'free' ? 5 : 10);

    const questionIndex = questionIds.indexOf(question_id);
    if (questionIndex === -1) {
      res.status(400).json({ error: 'This question was not served in your current session.' });
      return;
    }

    // Calculate difficulty-aware timing & reading grace buffer for this question
    const timing = calculateQuestionTiming(question.body, question.options, question.difficulty);
    const diffConfig = DIFFICULTY_CONFIG_MAP[timing.difficulty];
    const effectiveTimeLimitSec =
      timeLimitSec ?? Math.max(Number(question.time_limit_seconds) || 0, timing.time_limit_seconds);
    const readingGraceMs = timing.reading_time_seconds * 1000;

    // Calculate server-side start time for the question
    let startTime = new Date(session.started_at).getTime();
    if (questionIndex > 0) {
      const prevQuestionId = questionIds[questionIndex - 1];
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

    const rawServerElapsedMs = Math.max(300, now.getTime() - startTime);
    const serverReadingAdjustedMs = Math.max(400, rawServerElapsedMs - readingGraceMs);

    // Prefer client-measured active answer time (post-reading grace) when valid so reading Cortana explanations
    // on the previous question never penalizes the student's timer on the next question.
    // Behind-the-scenes untimed sessions record 99999ms so they never accidentally qualify for <3s speed badges.
    const clientAnswerMs = Number(answer_time_ms);
    const timeTakenMs = !isTimedSession
      ? 99999
      : Number.isFinite(clientAnswerMs) && clientAnswerMs >= 250 && clientAnswerMs <= (effectiveTimeLimitSec + 30) * 1000
        ? Math.round(clientAnswerMs)
        : serverReadingAdjustedMs;

    // 4. Enforce time limit only on timed sessions (allow a 3-second buffer for network latency)
    const allowedTimeMs = (effectiveTimeLimitSec * 1000) + 3000;
    const isExpired = isTimedSession ? (submitted_answer === '' || timeTakenMs > allowedTimeMs) : false;

    // 5. Evaluate correctness and calculate difficulty-scaled & mode-aware points
    // Behind the scenes for Untimed ("No Timer") mode:
    // - 50% base points (Easy: 5, Normal/Medium: 8, Hard: 10, Insane: 15)
    // - 0 speed bonus
    // - 1.25x streak multiplier (vs 1.5x in Timed mode) for 3+ correct in a row
    const effectiveBasePoints = isTimedSession
      ? diffConfig.basePoints
      : Math.ceil(diffConfig.basePoints * 0.5);
    const isCorrect = !isExpired && (String(submitted_answer).trim() === question.correct_answer.trim());
    let pointsAwarded = 0;
    let speedBonusAwarded = 0;

    if (isCorrect) {
      pointsAwarded = effectiveBasePoints;

      if (isTimedSession) {
        // Difficulty-specific speed bonus tiers (e.g. <=3s on Insane gives +15 bonus!)
        for (const tier of diffConfig.speedTiers) {
          if (timeTakenMs <= tier.maxMs) {
            speedBonusAwarded = tier.bonus;
            pointsAwarded += tier.bonus;
            break;
          }
        }
      }

      // Streak bonus: 1.5x (timed) or 1.25x (untimed) if user has 3+ correct answers in a row (including current)
      const { data: lastSubs } = await supabase
        .from('upsa_submissions')
        .select('is_correct')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(2);

      if (lastSubs && lastSubs.length === 2 && lastSubs.every(s => s.is_correct)) {
        const streakMultiplier = isTimedSession ? 1.5 : 1.25;
        pointsAwarded = Math.round(pointsAwarded * streakMultiplier);
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
    const otherQuestionIds = questionIds.filter(id => id !== question_id);
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

    const isSessionComplete = questionIndex === totalQs - 1;
    let earnedBadges: string[] = [];

    if (isSessionComplete) {
      // 7. Update user's total points on full session completion
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
        await invalidateLeaderboardCache();
      }
    }

    // 8. Check and award badges immediately on any correct answer OR session completion
    // so fast-answer badges (e.g. <=3s on Insane -> Insane Reflex / Speed Demon) unlock right away!
    if (isCorrect || isSessionComplete) {
      earnedBadges = await awardBadges(userId);
    }

    // 9. Pre-load next question into response so clicking "Next Question" is 0ms instant
    let nextQuestionPayload: any = null;
    if (!isSessionComplete && questionIndex + 1 < questionIds.length) {
      const nextQId = questionIds[questionIndex + 1];
      const { data: nextQRow } = await supabase
        .from('upsa_questions')
        .select('id, body, category, difficulty, options, time_limit_seconds')
        .eq('id', nextQId)
        .maybeSingle();
      if (nextQRow) {
        nextQuestionPayload = formatClientQuestion(nextQRow, displaySubject, isTimedSession, timeLimitSec);
      }
    }

    const responseData: any = {
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
      base_points: effectiveBasePoints,
      speed_bonus: speedBonusAwarded,
      difficulty: timing.difficulty,
      timed: isTimedSession,
      time_taken_ms: timeTakenMs,
      is_expired: isExpired,
      is_completed: isSessionComplete,
      session_points: totalSessionPoints,
      session_correct: correctCount,
      session_total: totalQs,
      earned_badges: earnedBadges,
      next_question: nextQuestionPayload
    };

    // Only reveal correct answers after the ENTIRE quiz session is completed
    // This prevents users from inspecting DevTools mid-quiz to gain an advantage
    if (isSessionComplete) {
      const { data: sessionQuestions } = await supabase
        .from('upsa_questions')
        .select('id, correct_answer')
        .in('id', questionIds);

      responseData.session_answers = (sessionQuestions || []).map((q: any) => ({
        question_id: q.id,
        correct_answer: q.correct_answer
      }));
    }

    res.status(200).json(responseData);
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
        .select('id, username, total_points, streak_count, streak_last_date, avatar_url, created_at, upsa_user_badges(count)')
        .order('total_points', { ascending: false })
        .order('streak_count', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(100);

      const expiredUserIds: string[] = [];
      leaderboardData = (users || [])
        .map((u: any) => {
          const effectiveStreak = getEffectiveStreak(u.streak_count, u.streak_last_date);
          if ((u.streak_count || 0) > 0 && effectiveStreak === 0) {
            expiredUserIds.push(u.id);
          }
          return {
            user_id: u.id,
            username: u.username || 'Student',
            score: u.total_points || 0,
            login_streak: effectiveStreak,
            badge_count: u.upsa_user_badges?.[0]?.count || 0,
            avatar_url: u.avatar_url,
            created_at: u.created_at
          };
        })
        .sort((a: any, b: any) => b.score - a.score || b.login_streak - a.login_streak || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(({ created_at, ...entry }: any, idx: number) => ({
          rank: idx + 1,
          ...entry
        }));

      if (expiredUserIds.length > 0) {
        await supabase.from('upsa_users').update({ streak_count: 0 }).in('id', expiredUserIds);
      }
    } else {
      // For Weekly / Monthly, fetch submissions from the start period
      const startDate = period === 'weekly' ? getStartOfWeek() : getStartOfMonth();

      const { data: submissions, error: subErr } = await supabase
        .from('upsa_submissions')
        .select('user_id, points_awarded, upsa_users(username, avatar_url, streak_count, streak_last_date, upsa_user_badges(count))')
        .gte('submitted_at', startDate);

      if (subErr) throw subErr;

      // Group and sum in JS
      const userSums: Record<string, { username: string; avatar_url: string; score: number; badge_count: number; login_streak: number }> = {};
      (submissions || []).forEach((s: any) => {
        const uid = s.user_id;
        const pts = Number(s.points_awarded) || 0;
        if (!userSums[uid]) {
          userSums[uid] = {
            username: s.upsa_users?.username || 'Student',
            avatar_url: s.upsa_users?.avatar_url || '',
            score: 0,
            badge_count: s.upsa_users?.upsa_user_badges?.[0]?.count || 0,
            login_streak: getEffectiveStreak(s.upsa_users?.streak_count, s.upsa_users?.streak_last_date)
          };
        }
        userSums[uid].score += pts;
      });

      // Sort and map to leaderboard array (tiebreak by streak desc, then username)
      leaderboardData = Object.keys(userSums)
        .map(uid => ({
          user_id: uid,
          username: userSums[uid].username,
          avatar_url: userSums[uid].avatar_url,
          score: userSums[uid].score,
          badge_count: userSums[uid].badge_count,
          login_streak: userSums[uid].login_streak
        }))
        .sort((a, b) => b.score - a.score || (userSums[b.user_id]?.login_streak || 0) - (userSums[a.user_id]?.login_streak || 0) || a.username.localeCompare(b.username))
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
      .select('total_points, streak_count, streak_last_date, created_at')
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

    // 4. Calculate user's unique rank on global all-time leaderboard
    //    Rank = (users with MORE points) + (users with SAME points but higher streak)
    //         + (users with SAME points AND streak but earlier signup) + 1
    const userPoints = user.total_points || 0;
    const userStreak = user.streak_count || 0;
    const userCreatedAt = user.created_at;

    const { count: usersStrictlyAhead } = await supabase
      .from('upsa_users')
      .select('id', { count: 'exact', head: true })
      .gt('total_points', userPoints);

    const { count: usersTiedHigherStreak } = await supabase
      .from('upsa_users')
      .select('id', { count: 'exact', head: true })
      .eq('total_points', userPoints)
      .gt('streak_count', userStreak)
      .neq('id', userId);

    const { count: usersTiedSameStreakEarlier } = await supabase
      .from('upsa_users')
      .select('id', { count: 'exact', head: true })
      .eq('total_points', userPoints)
      .eq('streak_count', userStreak)
      .lt('created_at', userCreatedAt)
      .neq('id', userId);

    const rank = (usersStrictlyAhead ?? 0) + (usersTiedHigherStreak ?? 0) + (usersTiedSameStreakEarlier ?? 0) + 1;

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
        login_streak: getEffectiveStreak(user.streak_count, user.streak_last_date),
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

// --- 6. CORTANA QUIZ EXPLAINER ---
// POST /quiz/explain
// Returns an explanation of why an answer is correct/incorrect for a quiz question.
router.post('/explain', async (req: AuthRequest, res: Response): Promise<void> => {
  const { question_id } = req.body;

  if (!question_id) {
    res.status(400).json({ error: 'question_id is required.' });
    return;
  }

  try {
    const { data: question, error: qErr } = await supabase
      .from('upsa_questions')
      .select('body, category, difficulty, options, correct_answer')
      .eq('id', question_id)
      .single();

    if (qErr || !question) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    const optionsList = (question.options as string[])
      .map((opt: string, i: number) => `${['A', 'B', 'C', 'D'][i]}. ${opt}`)
      .join('\n');

    const systemInstruction = `You are Cortana, an expert academic tutor on PastQ. Your task is to give a clear, educational explanation of a multiple choice question. Be concise, warm and encouraging. Use premium markdown formatting with bold key terms. Keep the total response under 250 words.`;

    const userMessage =
      `Explain the following multiple choice question to a student.\n\n` +
      `**Question**: ${question.body}\n\n` +
      `**Options**:\n${optionsList}\n\n` +
      `**Correct Answer**: ${question.correct_answer}\n\n` +
      `Explain clearly:\n1. Why the correct answer is right.\n2. Why each of the other options is wrong (briefly).\n3. A key concept to remember.`;

    const explanation = await getAiCompletion(systemInstruction, [], userMessage);

    res.status(200).json({ explanation });
  } catch (err: any) {
    console.error('❌ [Quiz Explain] Error:', err.message);
    res.status(500).json({ error: 'Failed to get explanation from Cortana.' });
  }
});

// --- 7. PUBLIC USER STATS (for Leaderboard Profile Modal) ---
// GET /quiz/stats/:userId
// Returns another user's public stats and earned badges.
router.get('/stats/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { userId } = req.params;

  try {
    // 1. Fetch user's public profile data
    const { data: user, error: userErr } = await supabase
      .from('upsa_users')
      .select('id, username, full_name, avatar_url, plan, total_points, streak_count, streak_last_date, created_at')
      .eq('id', userId)
      .single();

    if (userErr || !user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // 2. Fetch submission stats
    const { data: subs } = await supabase
      .from('upsa_submissions')
      .select('is_correct')
      .eq('user_id', userId);

    const totalAnswered = subs ? subs.length : 0;
    const correctCount = subs ? subs.filter((s: any) => s.is_correct).length : 0;
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    // 3. Fetch earned badges
    const { data: earnedRows } = await supabase
      .from('upsa_user_badges')
      .select('badge_slug, earned_at')
      .eq('user_id', userId);

    const earnedMap = new Map((earnedRows || []).map((r: any) => [r.badge_slug, r.earned_at]));

    // 4. Calculate unique rank (points > streak > signup date)
    const profilePoints = user.total_points || 0;
    const profileStreak = user.streak_count || 0;

    const { count: profileUsersAhead } = await supabase
      .from('upsa_users')
      .select('id', { count: 'exact', head: true })
      .gt('total_points', profilePoints);

    const { count: profileTiedHigherStreak } = await supabase
      .from('upsa_users')
      .select('id', { count: 'exact', head: true })
      .eq('total_points', profilePoints)
      .gt('streak_count', profileStreak)
      .neq('id', userId);

    const { count: profileTiedSameStreakEarlier } = await supabase
      .from('upsa_users')
      .select('id', { count: 'exact', head: true })
      .eq('total_points', profilePoints)
      .eq('streak_count', profileStreak)
      .lt('created_at', user.created_at)
      .neq('id', userId);

    const rank = (profileUsersAhead ?? 0) + (profileTiedHigherStreak ?? 0) + (profileTiedSameStreakEarlier ?? 0) + 1;

    // 5. Build badge collection (only earned badges for public profiles)
    const badges = Object.keys(BADGE_REGISTRY)
      .filter(slug => earnedMap.has(slug))
      .map(slug => {
        const meta = BADGE_REGISTRY[slug];
        return {
          slug,
          name: meta.name,
          description: meta.description,
          icon: meta.icon,
          earned_at: earnedMap.get(slug)
        };
      });

    res.status(200).json({
      profile: {
        id: user.id,
        username: user.username || user.full_name || 'Student',
        avatar_url: user.avatar_url,
        plan: user.plan,
        points: user.total_points || 0,
        login_streak: getEffectiveStreak(user.streak_count, user.streak_last_date),
        total_answered: totalAnswered,
        correct_answered: correctCount,
        accuracy,
        rank
      },
      badges
    });
  } catch (err: any) {
    console.error('❌ [Quiz Public Stats] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// --- 8. AI CUSTOM PRACTICE QUIZ GENERATOR ---
// POST /quiz/generate-from-paper
// Generates a 5-question custom quiz from a given paper's PDF content.
router.post('/generate-from-paper', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { paper_id } = req.body;

  if (!paper_id) {
    res.status(400).json({ error: 'paper_id is required.' });
    return;
  }

  try {
    // ── Enforce plan-based paper quiz limits ──────────────────────────────
    const { data: limitUser, error: limitErr } = await supabase
      .from('upsa_users')
      .select('plan')
      .eq('id', userId)
      .single();

    if (limitErr) throw limitErr;
    const plan = (limitUser?.plan || 'free').toLowerCase();

    if (plan === 'free' || plan === 'basic') {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // Count custom (paper-generated) sessions in the last 24h
      const { data: recentSessions, error: countErr } = await supabase
        .from('upsa_sessions')
        .select('questions_shown')
        .eq('user_id', userId)
        .gte('started_at', twentyFourHoursAgo);

      if (countErr) throw countErr;

      // Only count sessions that are custom (paper-generated) quizzes
      const customCount = (recentSessions || []).filter((s: any) => {
        try {
          const shown = typeof s.questions_shown === 'string'
            ? JSON.parse(s.questions_shown)
            : s.questions_shown;
          return Array.isArray(shown) && shown.includes('is_custom:true');
        } catch { return false; }
      }).length;

      const limit = plan === 'free' ? 5 : 20;
      if (customCount >= limit) {
        res.status(403).json({
          error: 'quiz_limit_reached',
          message: `You've used all ${limit} practice quizzes for today on the ${plan === 'free' ? 'Free' : 'Basic'} plan. Upgrade for more, or come back in 24 hours!`
        });
        return;
      }
    }

    // 1. Fetch paper metadata + file_url
    const { data: paper, error: paperErr } = await supabase
      .from('upsa_papers')
      .select('id, title, file_url, upsa_subjects(name)')
      .eq('id', paper_id)
      .single();

    if (paperErr || !paper || !(paper as any).file_url) {
      res.status(404).json({ error: 'Paper not found or has no file.' });
      return;
    }

    const subjectName = (paper as any).upsa_subjects?.name || 'General';

    // 2. Download + parse PDF text
    let extractedText = '';
    let pdfBuffer: Buffer | null = null;
    let pageCount = 6; // default page count to process if not extractable
    
    try {
      const pdfRes = await fetch((paper as any).file_url);
      if (pdfRes.ok) {
        const arrayBuffer = await pdfRes.arrayBuffer();
        pdfBuffer = Buffer.from(arrayBuffer);
        const pdfData = await pdfParse(pdfBuffer);
        extractedText = (pdfData.text || '').trim();
        pageCount = Number(pdfData.numpages) || pageCount;
      }
    } catch (parseErr: any) {
      console.warn('[generate-from-paper] PDF parse failed:', parseErr.message);
    }

    // OCR Fallback: If the text is empty/too short (scanned PDF), run it through OCR
    if (extractedText.length < 100 && pdfBuffer) {
      try {
        console.log(`[generate-from-paper] Extracted text too short (${extractedText.length} chars). Falling back to OCR pipeline...`);
        const ocrRes = await performOcrPipeline(pdfBuffer, pageCount);
        extractedText = ocrRes.text;
      } catch (ocrErr: any) {
        console.error('[generate-from-paper] OCR fallback failed:', ocrErr.message);
      }
    }

    // Multi-Provider Vision/Extraction Fallback (when OCR fails / is disabled in production)
    if (extractedText.length < 100 && pdfBuffer) {
      let extractionFailed = true;
      const pdfSizeBytes = pdfBuffer.length;
      const MAX_INLINE_PDF_BYTES = 20 * 1024 * 1024; // 20MB limit

      if (pdfSizeBytes <= MAX_INLINE_PDF_BYTES) {
        // Fallback 1: Gemini Vision
        if (process.env.GEMINI_API_KEY) {
          try {
            console.log(`[generate-from-paper] OCR failed. Attempting Gemini Vision text extraction (PDF size: ${(pdfSizeBytes / 1024 / 1024).toFixed(2)}MB)...`);
            const geminiExtractAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1beta' });
            const base64Pdf = pdfBuffer.toString('base64');
            const extractModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
            for (const extractModel of extractModels) {
              try {
                const extractResult = await geminiExtractAI.models.generateContent({
                  model: extractModel,
                  contents: [{
                    role: 'user',
                    parts: [
                      { inlineData: { mimeType: 'application/pdf', data: base64Pdf } },
                      { text: 'Extract ALL text from this PDF document exactly as it appears. Include every question, instruction, header, numbering, and sub-question. Output ONLY the raw text content, nothing else. Do not summarize or paraphrase.' }
                    ]
                  }]
                });
                const geminiText = extractResult.text?.trim();
                if (geminiText && geminiText.length > 100) {
                  extractedText = geminiText;
                  extractionFailed = false;
                  console.log(`[generate-from-paper] Gemini Vision extraction succeeded with ${extractModel}! Length: ${geminiText.length}`);
                  break;
                }
              } catch (geminiModelErr: any) {
                console.warn(`[generate-from-paper] Gemini Vision extraction failed with ${extractModel}:`, geminiModelErr.message);
              }
            }
          } catch (geminiExtractErr: any) {
            console.warn('[generate-from-paper] Gemini Vision extraction initialization failed:', geminiExtractErr.message);
          }
        }

        // Fallback 2: Puter text extraction
        if (extractionFailed && isPuterAvailable()) {
          try {
            console.log('[generate-from-paper] Gemini Vision failed. Attempting Puter text extraction...');
            const puterExtractText = await askPuter(
              'You are a document text extractor. Extract ALL text exactly as it appears.',
              [],
              'Extract ALL text from this exam paper. Include every question, instruction, header, numbering, and sub-question exactly as written. Output ONLY the raw text content, nothing else.\n\nPaper title: ' + (paper.title || 'Unknown')
            );
            if (puterExtractText && puterExtractText.length > 100) {
              extractedText = puterExtractText;
              extractionFailed = false;
              console.log('[generate-from-paper] Puter text extraction succeeded! Length:', puterExtractText.length);
            }
          } catch (puterExtErr: any) {
            console.warn('[generate-from-paper] Puter text extraction failed:', puterExtErr.message);
          }
        }

        // Fallback 3: HuggingFace text extraction
        if (extractionFailed) {
          try {
            const hfConfig = await getHFConfig();
            if (hfConfig && hfConfig.apiKey) {
              console.log('[generate-from-paper] Gemini + Puter extraction failed. Attempting HuggingFace text extraction...');
              const hfModels = hfConfig.modelNames.length > 0 ? hfConfig.modelNames : defaultHFModels;
              for (const rawModel of hfModels) {
                const modelId = getHFModelId(rawModel);
                try {
                  const hfExtractText = await askHuggingFace(
                    modelId,
                    hfConfig.apiKey,
                    'You are a document text extractor. Extract ALL text exactly as it appears.',
                    [],
                    'Extract ALL text from this exam paper. Include every question, instruction, header, numbering, and sub-question exactly as written. Output ONLY the raw text content, nothing else.\n\nPaper title: ' + (paper.title || 'Unknown')
                  );
                  if (hfExtractText && hfExtractText.length > 100) {
                    extractedText = hfExtractText;
                    extractionFailed = false;
                    console.log(`[generate-from-paper] HuggingFace text extraction succeeded with ${modelId}! Length: ${hfExtractText.length}`);
                    break;
                  }
                } catch (hfExtErr: any) {
                  console.warn(`[generate-from-paper] HuggingFace extraction with ${modelId} failed:`, hfExtErr.message);
                }
              }
            }
          } catch (hfOuterErr: any) {
            console.warn('[generate-from-paper] HuggingFace text extraction initialization failed:', hfOuterErr.message);
          }
        }
      }
    }

    // Cap the text for the AI query context window
    extractedText = extractedText.substring(0, 12000);

    if (extractedText.length < 100) {
      res.status(422).json({ error: 'Could not extract enough text from this paper to generate questions.' });
      return;
    }

    // 3. Ask Cortana to generate 5 MCQs as JSON
    const systemInstruction = `You are an expert academic exam author. Generate ONLY a valid JSON array. No markdown fences, no explanations, just raw JSON.`;

    const userMessage =
      `Based on the following exam paper content, generate exactly 5 multiple-choice questions for a student to practice (progressing across Easy, Medium, Hard, and Insane difficulty).\n\n` +
      `PAPER CONTENT:\n${extractedText}\n\n` +
      `Rules:\n` +
      `- Each question must have exactly 4 options.\n` +
      `- The correct_answer field must be an EXACT copy of one of the options strings.\n` +
      `- difficulty must be one of: Easy, Medium, Hard, Insane\n` +
      `- category must be: "${subjectName}"\n\n` +
      `Return ONLY a valid JSON array like this (no extra text):\n` +
      `[{"body":"...","options":["A","B","C","D"],"correct_answer":"A","difficulty":"Medium","category":"${subjectName}"}]`;

    const rawReply = await getAiCompletion(systemInstruction, [], userMessage);

    // 4. Parse + validate the JSON output
    let questions: any[];
    try {
      const jsonMatch = rawReply.match(/\[\s*\{[\s\S]*\}\s*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawReply.trim();
      questions = JSON.parse(jsonStr);

      if (!Array.isArray(questions) || questions.length === 0) throw new Error('Empty array returned');

      // Validate each question
      questions = questions.slice(0, 5).filter(q =>
        q.body && Array.isArray(q.options) && q.options.length === 4 &&
        q.correct_answer && q.options.includes(q.correct_answer)
      );

      if (questions.length < 3) {
        res.status(422).json({ error: 'Could not generate enough valid questions from this paper. Please try another.' });
        return;
      }
    } catch (parseErr: any) {
      console.error('[generate-from-paper] JSON parse failed:', parseErr.message, '\nRaw:', rawReply.substring(0, 300));
      res.status(422).json({ error: 'Cortana had trouble generating questions for this paper. Please try again.' });
      return;
    }

    // 5. Insert questions into upsa_questions
    const insertPayload = questions.map(q => {
      const timing = calculateQuestionTiming(q.body, q.options, q.difficulty);
      return {
        body: q.body,
        category: q.category || subjectName,
        difficulty: timing.difficulty,
        correct_answer: q.correct_answer,
        options: q.options,
        time_limit_seconds: timing.time_limit_seconds
      };
    });

    const { data: insertedQuestions, error: insertErr } = await supabase
      .from('upsa_questions')
      .insert(insertPayload)
      .select('id');

    if (insertErr || !insertedQuestions || insertedQuestions.length === 0) {
      throw insertErr ?? new Error('No questions were inserted.');
    }

    const questionIds = insertedQuestions.map((q: any) => q.id);

    // 6. Create a custom quiz session for this user
    const { data: newSession, error: sessionErr } = await supabase
      .from('upsa_sessions')
      .insert({ user_id: userId, subject: subjectName, questions_shown: [...questionIds, 'is_custom:true'] })
      .select('id')
      .single();

    if (sessionErr || !newSession) throw sessionErr ?? new Error('Failed to create session.');

    res.status(201).json({
      session_id: newSession.id,
      question_count: questionIds.length,
      subject: subjectName
    });
  } catch (err: any) {
    console.error('❌ [Quiz Generate] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate custom practice quiz.' });
  }
});
export default router;
