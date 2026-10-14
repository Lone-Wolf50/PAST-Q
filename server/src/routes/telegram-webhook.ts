import { Router, Request, Response } from 'express';
import { handleTelegramWebhook } from '../lib/telegram';

const router = Router();

// ── Telegram Webhook Handler ────────────────────────────────────────────────
// Telegram posts updates (messages, commands) here when configured with setWebhook.
// IMPORTANT: We must await processing BEFORE returning 200, otherwise Vercel
// kills the serverless function before the bot can reply to the user.
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    if (req.body) {
      await handleTelegramWebhook(req.body);
    }
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Route] Error:', err.message);
    res.status(200).json({ ok: true });
  }
});

// ── Webhook Info / Health ───────────────────────────────────────────────────
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'telegram-bot-integration',
    configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    enabled: process.env.TELEGRAM_ENABLED === 'true',
    hasChatId: Boolean(process.env.TELEGRAM_CHAT_ID),
  });
});

export default router;
