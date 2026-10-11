import { Router, Request, Response } from 'express';
import { runWeeklyDigestJob, revertExpiredTempPlans } from '../lib/cron';
import { sendDailyDigest } from '../lib/telegram';
import { redis } from '../lib/redis';

const router = Router();

/**
 * Middleware to verify that cron requests come from Vercel's cron scheduler.
 * Vercel sends a secret in the `authorization` header as `Bearer <CRON_SECRET>`.
 * This prevents unauthorized users from triggering expensive cron jobs.
 */
function verifyCronSecret(req: Request, res: Response, next: Function) {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';

  // 1. If CRON_SECRET is configured, check Bearer token, query param, or official Vercel cron header
  if (cronSecret) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.replace(/^Bearer\s+/i, '') || (req.query.secret as string);

    if (token === cronSecret || isVercelCron) {
      return next();
    }

    console.warn('[Cron Route] Unauthorized cron request blocked.');
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  // 2. If CRON_SECRET is not yet configured, allow Vercel's automated cron or dev/local testing
  if (isVercelCron || process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
    return next();
  }

  console.warn('[Cron Route] CRON_SECRET env variable is not set and request is not a verified Vercel cron.');
  res.status(401).json({ error: 'Cron secret not configured.' });
}

// Apply the secret verification to all cron routes
router.use(verifyCronSecret);

// ── Weekly Digest + Inactive User Emails ─────────────────────────
// Vercel Cron triggers this every other Monday at 8:00 AM UTC (Ghana time)
router.get('/weekly-digest', async (_req: Request, res: Response) => {
  try {
    console.log('[Cron Route] Vercel Cron triggered: weekly-digest');
    await runWeeklyDigestJob();
    res.status(200).json({ ok: true, job: 'weekly-digest', timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('[Cron Route] weekly-digest failed:', err.message || err);
    res.status(500).json({ error: err.message || 'Weekly digest job failed.' });
  }
});

// ── Revert Expired Temporary Plans ───────────────────────────────
// Vercel Cron triggers this every hour
router.get('/revert-temp-plans', async (_req: Request, res: Response) => {
  try {
    console.log('[Cron Route] Vercel Cron triggered: revert-temp-plans');
    await revertExpiredTempPlans();
    res.status(200).json({ ok: true, job: 'revert-temp-plans', timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('[Cron Route] revert-temp-plans failed:', err.message || err);
    res.status(500).json({ error: err.message || 'Temp plan revert job failed.' });
  }
});

// ── Daily Telegram Summary Digest ───────────────────────────────
// Vercel Cron triggers this every day at 8:00 AM UTC (Ghana time)
router.get('/daily-digest', async (_req: Request, res: Response) => {
  try {
    console.log('[Cron Route] Vercel Cron triggered: daily-digest');
    const todayDateStr = new Date().toISOString().slice(0, 10);
    if (redis) {
      await redis.set(`cron:daily_digest:${todayDateStr}`, 'sent', { ex: 86400 }).catch(() => {});
    }
    // Also clean up any expired temp plans during the daily check
    await revertExpiredTempPlans().catch((err) => console.error('[Cron Route] revertExpiredTempPlans error:', err));
    await sendDailyDigest();
    res.status(200).json({ ok: true, job: 'daily-digest', timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('[Cron Route] daily-digest failed:', err.message || err);
    res.status(500).json({ error: err.message || 'Daily digest failed.' });
  }
});

export default router;
