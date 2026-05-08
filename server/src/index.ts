import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Route imports
import authRouter from './routes/auth';
import papersRouter from './routes/papers';
import profileRouter from './routes/profile';
import paymentsRouter from './routes/payments';
import adminRouter from './routes/admin';
import aiRouter from './routes/ai';
import supportRouter from './routes/support';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security Middlewares ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5175',
    'http://localhost:5174'
  ],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── Global Rate Limiting ───────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased to accommodate dashboard auto-refreshes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'PastQ API is running' });
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/papers', papersRouter);
app.use('/api/profile', profileRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/hq-management', adminRouter);   // includes /api/hq-management/auth/login, /subjects, /papers, /users, /payments, /stats
app.use('/api/ai', aiRouter);
app.use('/api/support', supportRouter);

// ── 404 Handler ────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Global Error Handler ───────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});
// ── Start Server ───────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`✅  PastQ API running on http://localhost:${PORT}`);
});
// ── Start Server ───────────────────────────────────────────────────────────────

