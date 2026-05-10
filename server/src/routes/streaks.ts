import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { protect, AuthRequest } from '../middleware/auth';
import { Response } from 'express';

const router = Router();

/**
 * POST /api/streaks/ping
 * Called once per app session on load. Updates streak_count and streak_last_date.
 * Returns the current streak so the frontend can display it.
 */
router.post('/ping', protect, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  // Skip streak tracking for the hardcoded admin account
  if (userId === 'admin') {
    res.status(200).json({ streak: 0, isNewDay: false });
    return;
  }

  try {
    const { data: userData, error: fetchError } = await supabase
      .from('upsa_users')
      .select('streak_count, streak_last_date')
      .eq('id', userId)
      .single();

    if (fetchError || !userData) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
    const lastDate = userData.streak_last_date;
    const currentStreak = userData.streak_count || 0;

    // Already pinged today — return existing streak without changes
    if (lastDate === today) {
      res.status(200).json({ streak: currentStreak, isNewDay: false });
      return;
    }

    // Calculate yesterday to check streak continuity
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak: number;
    if (lastDate === yesterdayStr) {
      // Consecutive day — extend streak
      newStreak = currentStreak + 1;
    } else {
      // Missed a day or first login — reset to 1
      newStreak = 1;
    }

    await supabase
      .from('upsa_users')
      .update({ streak_count: newStreak, streak_last_date: today })
      .eq('id', userId);

    res.status(200).json({ streak: newStreak, isNewDay: true });
  } catch (err) {
    console.error('[streaks POST /ping]', err);
    res.status(500).json({ error: 'Failed to update streak.' });
  }
});

export default router;
