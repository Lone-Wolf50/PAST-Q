// ── Sentry must be initialized before any other imports ──────────────────────
import './instrument';
import * as Sentry from '@sentry/node';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Ratelimit } from '@upstash/ratelimit';

// Route imports
import authRouter from './routes/auth';
import papersRouter from './routes/papers';
import profileRouter from './routes/profile';
import paymentsRouter from './routes/payments';
import adminRouter from './routes/admin';
import aiRouter from './routes/ai';
import supportRouter from './routes/support';
import streaksRouter from './routes/streaks';
import { supabase } from './lib/supabase';
import { redis } from './lib/redis';

dotenv.config();

const app = express();



// Trust the first proxy (Render) to allow express-rate-limit to read the correct IP
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;

// ── CORS — must come before Helmet so preflight OPTIONS responses ──────────────
// get the Access-Control-Allow-Origin header before Helmet processes them.
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5175',
    'http://localhost:5174',
    'https://past-q-three.vercel.app',
    'https://past-q.vercel.app',
    /^https:\/\/past-q.*\.vercel\.app$/,
    // Custom domain
    'https://pastqhub.com',
    'https://www.pastqhub.com',
  ] as (string | RegExp)[],
  credentials: true,
};

// Handle preflight OPTIONS requests immediately — before any other middleware
app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));

// ── Security Middlewares ───────────────────────────────────────────────────────
app.use(helmet());
// Specific body parser overrides MUST come before the global 1MB body parser:
// Allow larger payloads on the AI chat route for base64 encoded PDF uploads
app.use('/api/ai/chat', express.json({ limit: '15mb' }));
app.use('/api/ai/chat', express.urlencoded({ limit: '15mb', extended: true }));

// Limit global JSON payloads to 1MB. Admin file uploads use multer (memory storage)
// on specific routes and bypass this limit — they are not affected.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// ── Global Rate Limiting ───────────────────────────────────────────────────────
const apiRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(500, '15 m'),
      prefix: 'rl:api:',
    })
  : null;

const apiLimiter = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  if (!apiRatelimit) {
    next();
    return;
  }
  try {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'anonymous';
    const { success, limit, reset, remaining } = await apiRatelimit.limit(ip);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);

    if (!success) {
      res.status(429).json({ error: 'Too many requests, please try again later.' });
      return;
    }
    next();
  } catch (err) {
    console.error('Rate limiting error:', err);
    next();
  }
};
app.use('/api', apiLimiter);

// ── Strict AI Rate Limiting ──────────────────────────────────────────────────
// Expensive AI operations are limited to 30 requests per 15 minutes to protect
// API budgets and prevent loop-blocking abuse.
const aiRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '15 m'),
      prefix: 'rl:ai:',
    })
  : null;

const aiChatLimiter = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  if (!aiRatelimit) {
    next();
    return;
  }
  try {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'anonymous';
    const { success, limit, reset, remaining } = await aiRatelimit.limit(ip);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);

    if (!success) {
      res.status(429).json({ error: 'You are sending AI queries too quickly. Please try again after 15 minutes.' });
      return;
    }
    next();
  } catch (err) {
    console.error('AI Rate limiting error:', err);
    next();
  }
};
app.use('/api/ai/chat', aiChatLimiter);

// ── Root Route ────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'PastQ API is online and healthy.',
    docs: 'https://past-q-server.vercel.app/api/health'
  });
});

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'PastQ API is running' });
});

// ── Public Config ──────────────────────────────────────────────────────────────
app.get('/api/public/site-config', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('upsa_app_config')
      .select('global_banner, global_banner_active')
      .eq('id', 1)
      .single();

    if (!error && data) {
      res.json({
        globalBanner: data.global_banner || '',
        globalBannerActive: !!data.global_banner_active,
      });
    } else {
      res.json({ globalBanner: '', globalBannerActive: false });
    }
  } catch (err) {
    res.json({ globalBanner: '', globalBannerActive: false });
  }
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/papers', papersRouter);
app.use('/api/profile', profileRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/hq-management', adminRouter);   // includes /api/hq-management/auth/login, /subjects, /papers, /users, /payments, /stats
app.use('/api/ai', aiRouter);
app.use('/api/support', supportRouter);
app.use('/api/streaks', streaksRouter);

// ── 404 Handler ────────────────────────────────────────────────────────────────
app.use((req, res) => {
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  console.log(`🔍 404: ${req.method} ${fullUrl}`);
  res.status(404).json({
    error: 'Route not found.',
    method: req.method,
    path: req.originalUrl
  });
});

// ── Sentry Error Handler (must be before the global error handler) ─────────────
// This captures all unhandled Express errors and sends them to Sentry.
Sentry.setupExpressErrorHandler(app);

// ── Global Error Handler ───────────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ GLOBAL ERROR:', err);
  res.status(500).json({
    error: 'An unexpected server error occurred.',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
// ── Process-Level Error Handlers ──────────────────────────────────────────────
// On Vercel (serverless), processes do not restart — so we log but do NOT call
// process.exit(1). Sentry captures the error for alerting regardless.
process.on('uncaughtException', (err) => {
  console.error('🔴 UNCAUGHT EXCEPTION — process will continue (Vercel serverless):', err);
  Sentry.captureException(err);
});

process.on('unhandledRejection', (reason) => {
  console.error('🔴 UNHANDLED PROMISE REJECTION:', reason);
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
});

if (process.env.VERCEL !== '1') {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`✅  PastQ API running on http://localhost:${PORT}`);
    console.log(`📡 Network access enabled for mobile testing.`);
  });
}



export default app;
// ── Start Server ───────────────────────────────────────────────────────────────

