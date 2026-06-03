import { supabase } from './supabase';

export interface Badge {
  slug: string;
  name: string;
  description: string;
  icon: string;
  condition: string;
  hidden: boolean;
}

export const BADGE_REGISTRY: Record<string, Badge> = {
  // Streak
  hot_streak: { slug: 'hot_streak', name: 'Hot Streak', description: '5 correct answers in a row', icon: 'Flame', condition: 'Get 5 correct answers in a row', hidden: false },
  on_fire: { slug: 'on_fire', name: 'On Fire', description: '10 correct answers in a row', icon: 'Flame', condition: 'Get 10 correct answers in a row', hidden: false },
  unstoppable: { slug: 'unstoppable', name: 'Unstoppable', description: '25 correct answers in a row', icon: 'ShieldAlert', condition: 'Get 25 correct answers in a row', hidden: false },
  comeback_kid: { slug: 'comeback_kid', name: 'Comeback Kid', description: 'Get 3 correct after 3 wrong in a row', icon: 'Award', condition: 'Get 3 correct answers after 3 wrong answers in a row', hidden: false },

  // Speed
  speed_demon: { slug: 'speed_demon', name: 'Speed Demon', description: 'Answer correctly in under 3 seconds', icon: 'Zap', condition: 'Answer correctly in under 3 seconds', hidden: false },
  lightning: { slug: 'lightning', name: 'Lightning', description: 'Answer 10 questions correctly all under 3s', icon: 'Sparkles', condition: 'Answer 10 questions correctly in under 3 seconds each', hidden: false },
  blink: { slug: 'blink', name: 'Blink', description: 'Answer correctly in under 1 second', icon: 'Eye', condition: 'Answer correctly in under 1 second', hidden: false },

  // Volume
  centurion: { slug: 'centurion', name: 'Centurion', description: 'Answer 100 questions total', icon: 'Award', condition: 'Answer 100 questions total', hidden: false },
  five_hundred: { slug: 'five_hundred', name: '500 Club', description: 'Answer 500 questions total', icon: 'Crown', condition: 'Answer 500 questions total', hidden: false },
  marathoner: { slug: 'marathoner', name: 'Marathoner', description: 'Answer 1000 questions total', icon: 'Timer', condition: 'Answer 1000 questions total', hidden: false },

  // Accuracy
  perfectionist: { slug: 'perfectionist', name: 'Perfectionist', description: 'Finish a 10-question quiz with 100% score', icon: 'CheckCircle2', condition: 'Finish a 10-question session with 100% score (10/10 correct)', hidden: false },
  sharpshooter: { slug: 'sharpshooter', name: 'Sharpshooter', description: 'Maintain 90%+ accuracy over 50 answers', icon: 'Target', condition: 'Maintain 90% or higher accuracy over 50 or more answers', hidden: false },
  no_nonsense: { slug: 'no_nonsense', name: 'No Nonsense', description: 'Answer 20 questions with no wrong answers', icon: 'ShieldCheck', condition: 'Answer 20 questions total with 0 wrong answers', hidden: false },

  // Loyalty
  seven_day: { slug: 'seven_day', name: '7-Day Streak', description: 'Log in 7 days in a row', icon: 'CalendarDays', condition: 'Log in 7 days in a row', hidden: false },
  thirty_day: { slug: 'thirty_day', name: 'Monthly Regular', description: 'Log in 30 days in a row', icon: 'CalendarDays', condition: 'Log in 30 days in a row', hidden: false },
  veteran: { slug: 'veteran', name: 'Veteran', description: 'Account is 1 year old with 500+ answers', icon: 'Shield', condition: 'Account is 1 year old and has answered 500+ questions', hidden: false },

  // Explorer
  category_master: { slug: 'category_master', name: 'Category Master', description: 'Answer all questions in one category correctly', icon: 'GraduationCap', condition: 'Answer at least 15 questions in a single category with 100% accuracy', hidden: false },
  all_rounder: { slug: 'all_rounder', name: 'All-Rounder', description: 'Answer at least 10 questions in every category', icon: 'Compass', condition: 'Answer at least 10 questions in every active category (minimum 3 categories)', hidden: false },
  deep_diver: { slug: 'deep_diver', name: 'Deep Diver', description: 'Complete all hard-difficulty questions in a category', icon: 'Waves', condition: 'Answer at least 10 Hard difficulty questions in a single category', hidden: false },

  // Leaderboard
  top_10: { slug: 'top_10', name: 'Top 10', description: 'Reach global top 10 on the leaderboard', icon: 'Trophy', condition: 'Reach global top 10 on the leaderboard', hidden: false },
  top_3: { slug: 'top_3', name: 'Podium', description: 'Reach global top 3', icon: 'Trophy', condition: 'Reach global top 3 on the leaderboard', hidden: false },
  champion: { slug: 'champion', name: 'Champion', description: 'Reach #1 on the global leaderboard', icon: 'Crown', condition: 'Reach #1 on the global leaderboard', hidden: false },
  weekly_winner: { slug: 'weekly_winner', name: 'Weekly Winner', description: 'Finish #1 on the weekly leaderboard', icon: 'Sparkles', condition: 'Finish #1 on the weekly leaderboard snapshot', hidden: false },

  // Special / Hidden
  first_blood: { slug: 'first_blood', name: 'First Blood', description: 'First user to correctly answer a brand new question', icon: 'Zap', condition: 'Be the first user to correctly answer a newly generated question', hidden: true },
  bug_hunter: { slug: 'bug_hunter', name: 'Bug Hunter', description: 'Report a question error that gets confirmed by admin', icon: 'Bug', condition: 'Report a question error that gets confirmed by an admin', hidden: true },
  night_owl: { slug: 'night_owl', name: 'Night Owl', description: 'Answer 50 questions between midnight and 4am', icon: 'Moon', condition: 'Answer 50 questions between 12:00 AM and 4:00 AM', hidden: true },
  early_bird: { slug: 'early_bird', name: 'Early Bird', description: 'Answer 50 questions between 5am and 7am', icon: 'Sun', condition: 'Answer 50 questions between 5:00 AM and 7:00 AM', hidden: true },
  ghost: { slug: 'ghost', name: 'Ghost', description: 'Return after 30 days of inactivity', icon: 'Ghost', condition: 'Return to the website after 30 or more days of inactivity', hidden: true },
  overachiever: { slug: 'overachiever', name: 'Overachiever', description: 'Earn 10 other badges', icon: 'Medal', condition: 'Earn 10 other badges', hidden: true },
  completionist: { slug: 'completionist', name: 'Completionist', description: 'Earn every non-hidden badge', icon: 'Gem', condition: 'Earn all 18 standard non-hidden badges', hidden: true },
  underdog: { slug: 'underdog', name: 'Underdog', description: "Beat a top-10 player's weekly score from rank 100+", icon: 'TrendingUp', condition: "Outscore a top 10 player's weekly score when starting from rank 100+", hidden: true },
  double_xp: { slug: 'double_xp', name: 'Double XP', description: 'Score 200+ points in a single day', icon: 'Activity', condition: 'Score 200 or more points in a single calendar day', hidden: true },
  curator: { slug: 'curator', name: 'Curator', description: 'Have 5 submitted questions approved by admin', icon: 'BookOpen', condition: 'Have 5 user-submitted questions approved by an administrator', hidden: true },
};

/**
 * Checks and awards badges for a user.
 * Returns an array of slugs of newly earned badges.
 */
export async function awardBadges(userId: string): Promise<string[]> {
  const newlyEarned: string[] = [];

  try {
    // 1. Fetch user detail & currently earned badges
    const { data: user, error: userErr } = await supabase
      .from('upsa_users')
      .select('created_at, login_streak, total_points')
      .eq('id', userId)
      .single();

    if (userErr || !user) return [];

    const { data: earnedRows, error: earnedErr } = await supabase
      .from('upsa_user_badges')
      .select('badge_slug')
      .eq('user_id', userId);

    if (earnedErr) return [];

    const earnedSlugs = new Set((earnedRows || []).map(r => r.badge_slug));

    // Helper to check if a badge is already earned
    const hasBadge = (slug: string) => earnedSlugs.has(slug);

    // Helper to insert badge
    const grantBadge = async (slug: string) => {
      if (hasBadge(slug)) return;
      const { error } = await supabase
        .from('upsa_user_badges')
        .insert({ user_id: userId, badge_slug: slug });

      if (!error) {
        newlyEarned.push(slug);
        earnedSlugs.add(slug);
      }
    };

    // 2. Fetch submission history for streak/accuracy/volume evaluations
    const { data: subs, error: subsErr } = await supabase
      .from('upsa_submissions')
      .select('*, upsa_questions(category, difficulty)')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });

    const totalCount = subs ? subs.length : 0;
    const correctSubs = subs ? subs.filter(s => s.is_correct) : [];
    const correctCount = correctSubs.length;

    // --- STREAK BADGES ---
    if (subs && subs.length >= 5) {
      // Hot Streak (5 correct in a row)
      if (!hasBadge('hot_streak') && subs.slice(0, 5).every(s => s.is_correct)) {
        await grantBadge('hot_streak');
      }
      // On Fire (10 correct in a row)
      if (!hasBadge('on_fire') && subs.length >= 10 && subs.slice(0, 10).every(s => s.is_correct)) {
        await grantBadge('on_fire');
      }
      // Unstoppable (25 correct in a row)
      if (!hasBadge('unstoppable') && subs.length >= 25 && subs.slice(0, 25).every(s => s.is_correct)) {
        await grantBadge('unstoppable');
      }
      // Comeback Kid (3 correct after 3 wrong in a row)
      if (!hasBadge('comeback_kid') && subs.length >= 6) {
        const last6 = subs.slice(0, 6); // index 0 is newest, index 5 is oldest
        if (
          last6[0].is_correct && last6[1].is_correct && last6[2].is_correct &&
          !last6[3].is_correct && !last6[4].is_correct && !last6[5].is_correct
        ) {
          await grantBadge('comeback_kid');
        }
      }
    }

    // --- SPEED BADGES ---
    if (subs && subs.length > 0) {
      // Speed Demon (Correct in < 3s)
      if (!hasBadge('speed_demon')) {
        const hasSpeedSub = subs.some(s => s.is_correct && s.time_taken_ms < 3000);
        if (hasSpeedSub) await grantBadge('speed_demon');
      }

      // Lightning (Answer 10 correctly all under 3s)
      if (!hasBadge('lightning')) {
        const lightningCount = subs.filter(s => s.is_correct && s.time_taken_ms < 3000).length;
        if (lightningCount >= 10) await grantBadge('lightning');
      }

      // Blink (Correct in < 1s)
      if (!hasBadge('blink')) {
        const hasBlinkSub = subs.some(s => s.is_correct && s.time_taken_ms < 1000);
        if (hasBlinkSub) await grantBadge('blink');
      }
    }

    // --- VOLUME BADGES ---
    if (totalCount >= 100 && !hasBadge('centurion')) {
      await grantBadge('centurion');
    }
    if (totalCount >= 500 && !hasBadge('five_hundred')) {
      await grantBadge('five_hundred');
    }
    if (totalCount >= 1000 && !hasBadge('marathoner')) {
      await grantBadge('marathoner');
    }

    // --- ACCURACY BADGES ---
    // Perfectionist: Finish a 10-question quiz with 100% score (session with 10 questions and 10 correct)
    if (!hasBadge('perfectionist')) {
      const { data: sessions } = await supabase
        .from('upsa_sessions')
        .select('id, questions_shown')
        .eq('user_id', userId);

      if (sessions) {
        for (const session of sessions) {
          let shownIds: string[] = [];
          try {
            shownIds = typeof session.questions_shown === 'string'
              ? JSON.parse(session.questions_shown)
              : session.questions_shown;
          } catch {
            shownIds = [];
          }

          if (shownIds && shownIds.length === 10) {
            const correctSessionSubs = subs ? subs.filter(s => shownIds.includes(s.question_id) && s.is_correct) : [];
            if (correctSessionSubs.length === 10) {
              await grantBadge('perfectionist');
              break;
            }
          }
        }
      }
    }

    // Sharpshooter (90%+ accuracy over 50 answers)
    if (!hasBadge('sharpshooter') && totalCount >= 50) {
      const accuracy = correctCount / totalCount;
      if (accuracy >= 0.90) await grantBadge('sharpshooter');
    }

    // No Nonsense (Answer 20 questions with no wrong answers)
    if (!hasBadge('no_nonsense') && totalCount >= 20) {
      const wrongCount = subs ? subs.filter(s => !s.is_correct).length : 0;
      if (wrongCount === 0) await grantBadge('no_nonsense');
    }

    // --- LOYALTY BADGES ---
    if (user.login_streak >= 7 && !hasBadge('seven_day')) {
      await grantBadge('seven_day');
    }
    if (user.login_streak >= 30 && !hasBadge('thirty_day')) {
      await grantBadge('thirty_day');
    }
    if (!hasBadge('veteran') && totalCount >= 500) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      if (new Date(user.created_at) <= oneYearAgo) {
        await grantBadge('veteran');
      }
    }

    // --- EXPLORER BADGES (Dynamic/Based on submission history) ---
    if (subs && subs.length > 0) {
      const catSubmissions: Record<string, any[]> = {};
      subs.forEach(s => {
        const cat = s.upsa_questions?.category;
        if (cat) {
          if (!catSubmissions[cat]) catSubmissions[cat] = [];
          catSubmissions[cat].push(s);
        }
      });

      // Category Master (Answer 15 questions in one category correctly with 100% accuracy)
      if (!hasBadge('category_master')) {
        for (const cat of Object.keys(catSubmissions)) {
          const list = catSubmissions[cat];
          if (list.length >= 15 && list.every(s => s.is_correct)) {
            await grantBadge('category_master');
            break;
          }
        }
      }

      // All-Rounder (Answer at least 10 questions in every category - check at least 3 categories)
      if (!hasBadge('all_rounder')) {
        const categories = Object.keys(catSubmissions);
        if (categories.length >= 3 && categories.every(cat => catSubmissions[cat].length >= 10)) {
          await grantBadge('all_rounder');
        }
      }

      // Deep Diver (Complete/answer at least 10 hard-difficulty questions in a category)
      if (!hasBadge('deep_diver')) {
        for (const cat of Object.keys(catSubmissions)) {
          const hardCount = catSubmissions[cat].filter(s => s.upsa_questions?.difficulty === 'Hard').length;
          if (hardCount >= 10) {
            await grantBadge('deep_diver');
            break;
          }
        }
      }
    }

    // --- LEADERBOARD BADGES (Checked against overall leaderboard rank) ---
    // Top 10, Podium, Champion are checked periodically during leaderboard fetches or refreshes

    // --- SPECIAL / HIDDEN BADGES ---
    // Night Owl (50 questions between midnight and 4am UTC/local)
    if (!hasBadge('night_owl') && subs) {
      const nightCount = subs.filter(s => {
        const hour = new Date(s.submitted_at).getHours(); // Use local hours
        return hour >= 0 && hour < 4;
      }).length;
      if (nightCount >= 50) await grantBadge('night_owl');
    }

    // Early Bird (50 questions between 5am and 7am)
    if (!hasBadge('early_bird') && subs) {
      const earlyCount = subs.filter(s => {
        const hour = new Date(s.submitted_at).getHours();
        return hour >= 5 && hour < 7;
      }).length;
      if (earlyCount >= 50) await grantBadge('early_bird');
    }

    // Double XP (200+ points in a single day)
    if (!hasBadge('double_xp') && subs) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayPoints = subs
        .filter(s => new Date(s.submitted_at) >= startOfDay)
        .reduce((sum, s) => sum + Number(s.points_awarded), 0);
      if (todayPoints >= 200) await grantBadge('double_xp');
    }

    // Overachiever (Earn 10 other badges)
    if (!hasBadge('overachiever')) {
      const currentBadgeCount = earnedSlugs.size;
      if (currentBadgeCount >= 10) {
        await grantBadge('overachiever');
      }
    }

    // Completionist (Earn all 18 standard non-hidden badges)
    if (!hasBadge('completionist')) {
      const nonHiddenSlugs = Object.keys(BADGE_REGISTRY).filter(k => !BADGE_REGISTRY[k].hidden);
      const earnedNonHidden = nonHiddenSlugs.filter(slug => earnedSlugs.has(slug));
      if (earnedNonHidden.length === nonHiddenSlugs.length) {
        await grantBadge('completionist');
      }
    }

  } catch (err) {
    console.error('❌ [Badge System] Error evaluating badges:', err);
  }

  return newlyEarned;
}
