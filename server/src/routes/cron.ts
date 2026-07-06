import { Router, Request, Response } from 'express';
import { runWeeklyDigestJob, revertExpiredTempPlans } from '../lib/cron';

const router = Router();

/**
 * Middleware to verify that cron requests come from Vercel's cron scheduler.
 * Vercel sends a secret in the `authorization` header as `Bearer <CRON_SECRET>`.
 * This prevents unauthorized users from triggering expensive cron jobs.
 */
function verifyCronSecret(req: Request, res: Response, next: Function) {
  const cronSecret = process.env.CRON_SECRET;

  // If no CRON_SECRET is configured, block all requests for safety
  if (!cronSecret) {
    console.error('[Cron Route] CRON_SECRET env variable is not set. Blocking request.');
    res.status(500).json({ error: 'Cron secret not configured.' });
    return;
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (token !== cronSecret) {
    console.warn('[Cron Route] Unauthorized cron request blocked.');
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  next();
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

export default router;
