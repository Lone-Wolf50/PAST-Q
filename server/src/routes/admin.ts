import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { supabase } from '../lib/supabase';
import { protect, adminOnly, AuthRequest } from '../middleware/auth';
import { uploadToR2, deleteFromR2, keyFromUrl } from '../lib/r2';
import { invalidateCachedSession, redis } from '../lib/redis';
import { getAIHealth } from '../lib/ai-health';
import { generatePaperInsights, getProcessingState, isProcessing } from '../lib/ai-insights';
import { deleteUserComplete } from '../lib/user-deletion';
import { sendGeneralEmail } from '../lib/mailer';
import { Ratelimit } from '@upstash/ratelimit';
import { runWeeklyDigestJob } from '../lib/cron';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

// ── Admin Login Rate Limiter ─────────────────────────────────────────────────
const adminAuthRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      prefix: 'rl:admin-auth:',
    })
  : null;

const adminAuthLimiter = async (req: Request, res: Response, next: any): Promise<void> => {
  if (!adminAuthRatelimit) {
    next();
    return;
  }
  try {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'anonymous';
    const { success } = await adminAuthRatelimit.limit(ip);
    if (!success) {
      res.status(429).json({ error: 'Too many login attempts. Please try again after 15 minutes.' });
      return;
    }
    next();
  } catch {
    next();
  }
};


// ── Admin Login (bcrypt + DB credentials, rate-limited) ──────────────────────
router.post('/auth/login', adminAuthLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  try {
    // Fetch admin credentials from database
    const { data: config, error: configErr } = await supabase
      .from('upsa_app_config')
      .select('admin_email, admin_password_hash')
      .eq('id', 1)
      .single();

    if (configErr || !config?.admin_email || !config?.admin_password_hash) {
      // Constant-time delay to prevent timing attacks
      await new Promise((r) => setTimeout(r, 400));
      res.status(401).json({ error: 'Invalid admin credentials.' });
      return;
    }

    if (email !== config.admin_email) {
      await new Promise((r) => setTimeout(r, 400));
      res.status(401).json({ error: 'Invalid admin credentials.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, config.admin_password_hash);
    if (!isMatch) {
      await new Promise((r) => setTimeout(r, 400));
      res.status(401).json({ error: 'Invalid admin credentials.' });
      return;
    }

    const token = jwt.sign(
      { id: 'admin', email: config.admin_email, plan: 'pro', role: 'admin' },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' } as jwt.SignOptions
    );

    res.status(200).json({ token });
  } catch {
    res.status(500).json({ error: 'Admin login failed.' });
  }
});

// All routes below require JWT + admin role
router.use(protect, adminOnly);

// ── Subjects CRUD ─────────────────────────────────────────────────────────────
router.get('/subjects', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('upsa_subjects')
      .select('id, name, code, created_at, upsa_papers(count)')
      .order('name');
    if (error) throw error;

    // Flatten the nested count into a plain `count` number field
    const subjects = (data || []).map((s: any) => ({
      ...s,
      count: s.upsa_papers?.[0]?.count ?? 0,
      upsa_papers: undefined,
    }));

    res.status(200).json({ subjects });
  } catch {
    res.status(500).json({ error: 'Failed to fetch subjects.' });
  }
});

router.post('/subjects', async (req: AuthRequest, res: Response) => {
  const { name, code } = req.body;
  if (!name || !code) { res.status(400).json({ error: 'Name and code are required.' }); return; }
  try {
    // Only validate uniqueness on name — same code with different name is allowed
    const { data: existing } = await supabase
      .from('upsa_subjects')
      .select('id')
      .ilike('name', name.trim())
      .maybeSingle();

    if (existing) {
      res.status(409).json({ error: `A subject named "${name}" already exists.` });
      return;
    }

    const { data, error } = await supabase
      .from('upsa_subjects').insert({ name: name.trim(), code: code.trim() }).select('id, name, code').single();
    if (error) throw error;
    res.status(201).json({ subject: data });
  } catch (e: any) {
    console.error('[POST /subjects]', e?.message || e);
    res.status(500).json({ error: 'Failed to create subject.' });
  }
});

router.patch('/subjects/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, code } = req.body;
  try {
    const { data, error } = await supabase
      .from('upsa_subjects').update({ name, code }).eq('id', id).select('id, name, code').single();
    if (error) throw error;
    res.status(200).json({ subject: data });
  } catch {
    res.status(500).json({ error: 'Failed to update subject.' });
  }
});

router.delete('/subjects/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await supabase.from('upsa_subjects').delete().eq('id', id);
    res.status(200).json({ message: 'Subject deleted.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete subject.' });
  }
});

// ── Papers CRUD ───────────────────────────────────────────────────────────────
router.get('/papers', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('upsa_papers')
      .select('*, upsa_subjects(name, code), upsa_paper_insights(id)')
      .order('year', { ascending: false })
      .order('title', { ascending: true });
    if (error) throw error;

    // Include per-paper processing state from in-memory tracker
    const processingState = getProcessingState();

    // Map to include a simple boolean for insights status
    const papersWithStatus = (data || []).map((p: any) => ({
      ...p,
      has_insights: (p.upsa_paper_insights?.length ?? 0) > 0,
      ai_processing_started_at: processingState[p.id] ?? null,
      upsa_paper_insights: undefined
    }));

    res.status(200).json({
      papers: papersWithStatus,
      ai_health: getAIHealth()
    });
  } catch (err: any) {

    res.status(500).json({ error: 'Failed to fetch papers.' });
  }
});

// ── Fetch full AI insights for a specific paper ───────────────────────────
router.get('/papers/:id/insights', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('upsa_paper_insights')
      .select('*')
      .eq('paper_id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'No insights found for this paper.' });
    }
    res.status(200).json({ insights: data });
  } catch (err: any) {

    res.status(500).json({ error: 'Failed to fetch insights.' });
  }
});


router.post(
  '/papers',
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'answer_file', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response) => {
    const { title, subject_id, year, semester, file_url, has_answers, answer_url } = req.body;

    if (!title || !subject_id || !year || !semester) {
      res.status(400).json({ error: 'title, subject_id, year, and semester are required.' });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const pdfFile = files?.['file']?.[0];
    const answerFile = files?.['answer_file']?.[0];

    if (!pdfFile && !file_url) {
      res.status(400).json({ error: 'Provide either a PDF file upload or an external file_url.' });
      return;
    }

    try {
      let finalFileUrl = file_url || '';
      let finalAnswerUrl = answer_url || null;

      if (pdfFile) {
        const ext = path.extname(pdfFile.originalname) || '.pdf';
        const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const key = `papers/${year}/${sanitizedTitle}_${Date.now()}${ext}`;
        finalFileUrl = await uploadToR2(pdfFile.buffer, key, pdfFile.mimetype);
      }

      if (answerFile) {
        const ext = path.extname(answerFile.originalname) || '.pdf';
        const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const key = `papers/${year}/${sanitizedTitle}_answers_${Date.now()}${ext}`;
        finalAnswerUrl = await uploadToR2(answerFile.buffer, key, answerFile.mimetype);
      }

      const { data, error } = await supabase
        .from('upsa_papers')
        .insert({
          title,
          subject_id,
          year,
          semester,
          file_url: finalFileUrl,
          has_answers: has_answers === 'true' || has_answers === true,
          answer_url: finalAnswerUrl,
        })
        .select('id, title')
        .single();

      if (error) throw error;

      res.status(201).json({ paper: data, file_url: finalFileUrl });
    } catch (e: any) {

      res.status(500).json({ error: 'Failed to upload paper.' });
    }
  }
);

router.patch(
  '/papers/:id',
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'answer_file', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;

    // multer populates req.body from multipart fields; guard against undefined
    const body = req.body || {};
    const { title, subject_id, year, semester, file_url, has_answers, answer_url } = body;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const pdfFile = files?.['file']?.[0];
    const answerFile = files?.['answer_file']?.[0];

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (subject_id !== undefined) updates.subject_id = subject_id;
    if (year !== undefined) updates.year = year;
    if (semester !== undefined) updates.semester = semester;
    if (has_answers !== undefined) updates.has_answers = has_answers === 'true' || has_answers === true;
    if (answer_url !== undefined) updates.answer_url = answer_url || null;

    try {
      // If a new PDF was uploaded, push it to R2
      if (pdfFile) {
        const ext = path.extname(pdfFile.originalname) || '.pdf';
        const sanitized = (title || 'paper').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const key = `papers/${year || 'unknown'}/${sanitized}_${Date.now()}${ext}`;
        updates.file_url = await uploadToR2(pdfFile.buffer, key, pdfFile.mimetype);
      } else if (file_url !== undefined) {
        updates.file_url = file_url;
      }

      if (answerFile) {
        const ext = path.extname(answerFile.originalname) || '.pdf';
        const sanitized = (title || 'paper').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const key = `papers/${year || 'unknown'}/${sanitized}_answers_${Date.now()}${ext}`;
        updates.answer_url = await uploadToR2(answerFile.buffer, key, answerFile.mimetype);
      }

      const { data, error } = await supabase
        .from('upsa_papers')
        .update(updates)
        .eq('id', id as string)
        .select('id, title')
        .single();
      if (error) throw error;
      res.status(200).json({ paper: data });
    } catch (e: any) {

      res.status(500).json({ error: 'Failed to update paper.' });
    }
  }
);

router.delete('/papers/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const { data: paper } = await supabase
      .from('upsa_papers')
      .select('file_url, answer_url')
      .eq('id', id)
      .single();

    await supabase.from('upsa_papers').delete().eq('id', id);

    if (paper) {
      const r2Base = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, '');
      if (r2Base && paper.file_url?.startsWith(r2Base)) {
        deleteFromR2(keyFromUrl(paper.file_url)).catch(console.error);
      }
      if (r2Base && paper.answer_url?.startsWith(r2Base)) {
        deleteFromR2(keyFromUrl(paper.answer_url)).catch(console.error);
      }
    }

    res.status(200).json({ message: 'Paper deleted.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete paper.' });
  }
});

// ── Users Management ──────────────────────────────────────────────────────────
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const plan = (req.query.plan as string) || '';
    const status = (req.query.status as string) || '';
    const panel = (req.query.panel as string) || 'active';

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Parallel counts fetch for active, failed, and deleted stats badges
    const [activeCountRes, failedCountRes, deletedCountRes] = await Promise.all([
      supabase.from('upsa_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_verified', true),
      supabase.from('upsa_users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_verified', false),
      supabase.from('upsa_deleted_accounts').select('id', { count: 'exact', head: true })
    ]);

    const counts = {
      active: activeCountRes.count || 0,
      failed: failedCountRes.count || 0,
      deleted: deletedCountRes.count || 0
    };

    let users: any[] = [];
    let totalCount = 0;

    if (panel === 'deleted') {
      let query = supabase
        .from('upsa_deleted_accounts')
        .select('*', { count: 'exact' })
        .order('deleted_at', { ascending: false });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (plan) {
        query = query.eq('plan', plan);
      }

      const { data, count, error } = await query.range(from, to);
      if (error) throw error;

      users = (data || []).map((d: any) => ({
        ...d,
        id: d.id || d.email, // ensure unique ID
        full_name: d.full_name || 'Deleted Account',
        email: d.email,
        plan: d.plan || 'free',
        status: 'deleted',
        is_verified: true,
        created_at: d.deleted_at
      }));
      totalCount = count || 0;
    } else if (panel === 'failed') {
      let query = supabase
        .from('upsa_users')
        .select('*', { count: 'exact' })
        .eq('role', 'student')
        .eq('is_verified', false)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, count, error } = await query.range(from, to);
      if (error) throw error;

      users = (data || []).map((d: any) => ({
        id: d.id,
        full_name: d.full_name || 'No Name',
        email: d.email,
        reason: 'Pending OTP',
        created_at: d.created_at || new Date().toISOString()
      }));
      totalCount = count || 0;
    } else {
      // panel is 'active' or 'limits'
      let query = supabase
        .from('upsa_users')
        .select(`
          id, 
          full_name, 
          email, 
          plan, 
          role, 
          status, 
          is_verified, 
          ai_enabled, 
          created_at,
          pdf_downloads_count,
          pdf_downloads_blocked_until,
          pdf_views_count,
          pdf_views_blocked_until,
          upsa_ai_queries(count)
        `, { count: 'exact' })
        .eq('role', 'student')
        .eq('is_verified', true)
        .order('full_name', { ascending: true });


      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (plan) {
        query = query.eq('plan', plan);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data: dbUsers, count, error } = await query.range(from, to);
      if (error) throw error;

      totalCount = count || 0;

      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: recentQueries } = await supabase
        .from('upsa_ai_queries')
        .select('user_id, created_at, has_file')
        .gte('created_at', thirtyDaysAgo);

      const recentQueriesByUser = new Map<string, { queries10h: number; queries30d: number; files30d: number }>();
      if (recentQueries) {
        for (const q of recentQueries) {
          const userId = q.user_id;
          const createdAt = q.created_at;
          const hasFile = q.has_file;

          if (!recentQueriesByUser.has(userId)) {
            recentQueriesByUser.set(userId, { queries10h: 0, queries30d: 0, files30d: 0 });
          }
          const stats = recentQueriesByUser.get(userId)!;
          stats.queries30d++;
          if (hasFile) {
            stats.files30d++;
          }
          if (new Date(createdAt) >= new Date(tenHoursAgo)) {
            stats.queries10h++;
          }
        }
      }

      users = (dbUsers || []).map((u: any) => {
        const stats = recentQueriesByUser.get(u.id) || { queries10h: 0, queries30d: 0, files30d: 0 };
        const totalQueries = u.upsa_ai_queries?.[0]?.count ?? 0;

        const uPlan = (u.plan || 'Free').toLowerCase();
        let limitMsg = '';
        let usageMsg = '';
        let limitReached = false;

        if (uPlan === 'free') {
          limitMsg = '3 queries / 10h';
          usageMsg = `${stats.queries10h} / 3 queries`;
          limitReached = stats.queries10h >= 3;
        } else if (uPlan === 'basic') {
          limitMsg = '10 queries & 5 files / month';
          usageMsg = `${stats.queries30d}/10 q, ${stats.files30d}/5 files`;
          limitReached = stats.queries30d >= 10 || stats.files30d >= 5;
        } else if (uPlan === 'plus' || uPlan === 'pro') {
          limitMsg = 'Unlimited';
          usageMsg = 'Unlimited';
          limitReached = false;
        } else {
          limitMsg = 'N/A';
          usageMsg = 'N/A';
        }

        const pdfCount = u.pdf_downloads_count || 0;
        const pdfBlockedUntil = u.pdf_downloads_blocked_until;
        const pdfLimitReached = !!(pdfBlockedUntil && new Date(pdfBlockedUntil) > new Date());

        const pdfViewCount = u.pdf_views_count || 0;
        const pdfViewBlockedUntil = u.pdf_views_blocked_until;
        const pdfViewLimitReached = !!(pdfViewBlockedUntil && new Date(pdfViewBlockedUntil) > new Date());

        let pdfLimitMsg = '';
        let pdfUsageMsg = '';
        let pdfViewLimitMsg = '';
        let pdfViewUsageMsg = '';

        if (uPlan === 'free') {
          pdfLimitMsg = '4 downloads / 3 days';
          pdfUsageMsg = `${pdfCount} / 4`;
          pdfViewLimitMsg = '4 views / 3 days';
          pdfViewUsageMsg = `${pdfViewCount} / 4`;
        } else if (uPlan === 'basic') {
          pdfLimitMsg = '20 downloads / week';
          pdfUsageMsg = `${pdfCount} / 20`;
          pdfViewLimitMsg = '20 views / week';
          pdfViewUsageMsg = `${pdfViewCount} / 20`;
        } else if (uPlan === 'plus' || uPlan === 'pro') {
          pdfLimitMsg = 'Unlimited';
          pdfUsageMsg = 'Unlimited';
          pdfViewLimitMsg = 'Unlimited';
          pdfViewUsageMsg = 'Unlimited';
        } else {
          pdfLimitMsg = 'N/A';
          pdfUsageMsg = 'N/A';
          pdfViewLimitMsg = 'N/A';
          pdfViewUsageMsg = 'N/A';
        }

        return {
          ...u,
          upsa_ai_queries: undefined,
          total_ai_queries: totalQueries,
          ai_limit: limitMsg,
          ai_usage: usageMsg,
          ai_limit_reached: limitReached,
          queries_10h: stats.queries10h,
          queries_30d: stats.queries30d,
          files_30d: stats.files30d,
          pdf_limit: pdfLimitMsg,
          pdf_usage: pdfUsageMsg,
          pdf_limit_reached: pdfLimitReached,
          pdf_downloads_count: pdfCount,
          pdf_downloads_blocked_until: pdfBlockedUntil,
          pdf_view_limit: pdfViewLimitMsg,
          pdf_view_usage: pdfViewUsageMsg,
          pdf_view_limit_reached: pdfViewLimitReached,
          pdf_views_count: pdfViewCount,
          pdf_views_blocked_until: pdfViewBlockedUntil
        };
      });
    }

    res.status(200).json({
      users,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      counts
    });
  } catch (err: any) {
    console.error('[GET /users]', err?.message || err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

router.patch('/users/:id/plan', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { plan } = req.body;
  const validPlans = ['free', 'basic', 'plus', 'pro'];
  if (!validPlans.includes(plan)) { res.status(400).json({ error: 'Invalid plan.' }); return; }
  try {
    await supabase.from('upsa_users').update({ plan }).eq('id', id);
    invalidateCachedSession(id as string).catch(() => {});
    res.status(200).json({ message: `Plan updated to ${plan}.` });
  } catch {
    res.status(500).json({ error: 'Failed to update plan.' });
  }
});

router.patch('/users/:id/status', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['active', 'suspended', 'deactivated'];
  if (!validStatuses.includes(status)) { res.status(400).json({ error: 'Invalid status.' }); return; }
  try {
    await supabase.from('upsa_users').update({ status }).eq('id', id);
    invalidateCachedSession(id as string).catch(() => {});
    res.status(200).json({ message: `Status updated to ${status}.` });
  } catch {
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

router.patch('/users/:id/ai-status', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { ai_enabled } = req.body;
  if (typeof ai_enabled !== 'boolean') { res.status(400).json({ error: 'Invalid AI status.' }); return; }
  try {
    await supabase.from('upsa_users').update({ ai_enabled }).eq('id', id);
    invalidateCachedSession(id as string).catch(() => {});
    res.status(200).json({ message: `AI access ${ai_enabled ? 'enabled' : 'disabled'}.` });
  } catch {
    res.status(500).json({ error: 'Failed to update AI access.' });
  }
});

router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = Array.isArray(id) ? id[0] : id;
  try {
    // Fetch full user info before deletion for archiving and notifications
    const { data: user, error: fetchError } = await supabase
      .from('upsa_users')
      .select('email, full_name, plan, is_verified')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('[DELETE /users/:id] Failed to fetch user before deletion:', fetchError.message);
      // Continue even if fetch fails — maybe the user was partially created
    }

    // Archive verified (active) users to deleted_accounts for records (upsert on email to prevent duplicates)
    if (user?.is_verified) {
      try {
        await supabase.from('upsa_deleted_accounts').upsert({
          email: user.email,
          full_name: user.full_name,
          plan: user.plan || 'free',
          deleted_at: new Date().toISOString()
        }, { onConflict: 'email' });
      } catch (e: any) {
        console.error('[DELETE /users/:id] Archive error:', e?.message || e);
      }
    }

    await deleteUserComplete(userId, user?.email as string | undefined);
    try {
      await invalidateCachedSession(userId);
    } catch {}

    // Send admin notification based on user type
    if (user) {
      try {
        if (user.is_verified) {
          await supabase.from('upsa_admin_notifications').insert({
            title: '🗑️ User Deleted by Admin',
            message: `Admin permanently deleted active student ${user.email} (${user.full_name || 'No Name'}) from the system. Their account has been archived in the Deleted panel.`,
            type: 'alert'
          });
        } else {
          await supabase.from('upsa_admin_notifications').insert({
            title: '🧹 Failed Registration Removed',
            message: `Admin removed unverified/failed user ${user.email} (${user.full_name || 'No Name'}) from the system.`,
            type: 'info'
          });
        }
      } catch {}
    }

    res.status(200).json({ message: 'User deleted.' });
  } catch (err: any) {
    const errorMsg = err?.message || String(err) || 'Unknown error during deletion';
    console.error('[DELETE /users/:id] Deletion error:', errorMsg);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

router.get('/deletions', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('upsa_deleted_accounts')
      .select('*')
      .order('deleted_at', { ascending: false });
    if (error) throw error;
    res.status(200).json({ deletions: data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch deletions.' });
  }
});

router.delete('/deletions/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await supabase.from('upsa_deleted_accounts').delete().eq('id', id);
    res.status(200).json({ message: 'Deleted account log dismissed.' });
  } catch {
    res.status(500).json({ error: 'Failed to dismiss deleted account log.' });
  }
});

// ── Failed Accounts ───────────────────────────────────────────────────────────
router.get('/failed-accounts', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('upsa_failed_accounts')
      .select('*')
      .order('failed_at', { ascending: false });
    if (error) throw error;
    res.status(200).json({ failedAccounts: data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch failed accounts.' });
  }
});

router.delete('/failed-accounts/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await supabase.from('upsa_failed_accounts').delete().eq('id', id);
    res.status(200).json({ message: 'Failed account log dismissed.' });
  } catch {
    res.status(500).json({ error: 'Failed to dismiss failed account log.' });
  }
});

// ── Payments Overview ─────────────────────────────────────────────────────────
router.get('/payments', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('upsa_transactions')
      .select('id, reference, plan, amount, status, created_at, upsa_users(full_name, email)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.status(200).json({ transactions: data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch payments.' });
  }
});

// ── Notifications ─────────────────────────────────────────────────────────────
router.get('/notifications', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('upsa_admin_notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Filter out fallback events from regular notifications list
    const filtered = (data || []).filter((n: any) => !n.metadata?.is_fallback);

    res.status(200).json({ notifications: filtered });
  } catch {
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

router.patch('/notifications/read-all', async (_req: AuthRequest, res: Response) => {
  try {
    const { data: unreadNotifications } = await supabase
      .from('upsa_admin_notifications')
      .select('id, metadata')
      .eq('is_read', false);
    
    const regularIds = (unreadNotifications || [])
      .filter((n: any) => !n.metadata?.is_fallback)
      .map((n: any) => n.id);

    if (regularIds.length > 0) {
      const { error } = await supabase
        .from('upsa_admin_notifications')
        .update({ is_read: true })
        .in('id', regularIds);
      if (error) throw error;
    }

    res.status(200).json({ message: 'All notifications marked as read.' });
  } catch {
    res.status(500).json({ error: 'Failed to mark notifications as read.' });
  }
});

router.patch('/notifications/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('upsa_admin_notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) throw error;
    res.status(200).json({ message: 'Notification marked as read.' });
  } catch {
    res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
});

router.delete('/notifications/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('upsa_admin_notifications')
      .delete()
      .eq('id', id);
    if (error) throw error;
    res.status(200).json({ message: 'Notification deleted.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete notification.' });
  }
});

// ── Model Fallbacks Monitor ──────────────────────────────────────────────────
router.get('/fallbacks', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('upsa_admin_notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Filter to only get fallback log notifications
    const fallbacks = (data || []).filter((n: any) => !!n.metadata?.is_fallback);

    res.status(200).json({ fallbacks });
  } catch {
    res.status(500).json({ error: 'Failed to fetch model fallbacks.' });
  }
});

router.delete('/fallbacks/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('upsa_admin_notifications')
      .delete()
      .eq('id', id);
    if (error) throw error;
    res.status(200).json({ message: 'Fallback log dismissed.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete fallback log.' });
  }
});

router.delete('/fallbacks', async (_req: AuthRequest, res: Response) => {
  try {
    const { data: allFallbacks } = await supabase
      .from('upsa_admin_notifications')
      .select('id, metadata');
    
    const fallbackIds = (allFallbacks || [])
      .filter((n: any) => !!n.metadata?.is_fallback)
      .map((n: any) => n.id);

    if (fallbackIds.length > 0) {
      const { error } = await supabase
        .from('upsa_admin_notifications')
        .delete()
        .in('id', fallbackIds);
      if (error) throw error;
    }
    
    res.status(200).json({ message: 'All fallback logs cleared.' });
  } catch {
    res.status(500).json({ error: 'Failed to clear fallback logs.' });
  }
});

// ── Dashboard Stats ──────────────────
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const range = (req.query.range as string) || 'monthly';
    let gteDate = new Date();

    if (range === 'daily') gteDate.setHours(0, 0, 0, 0); // Start of today
    else if (range === 'weekly') gteDate.setDate(gteDate.getDate() - 7);
    else if (range === 'yearly') gteDate.setFullYear(gteDate.getFullYear() - 1);
    else gteDate.setMonth(gteDate.getMonth() - 1); // Default Monthly (30 days)

    const results = await Promise.all([
      supabase.from('upsa_users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_verified', true),
      supabase.from('upsa_users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_verified', true).neq('plan', 'free'),
      supabase.from('upsa_papers').select('*', { count: 'exact', head: true }),
      supabase.from('upsa_deleted_accounts').select('*', { count: 'exact', head: true }),
      supabase.from('upsa_users').select('plan').eq('role', 'student').eq('is_verified', true).neq('plan', 'free'),
      supabase.from('upsa_transactions').select('amount, status, created_at').gte('created_at', gteDate.toISOString()),
      supabase.from('upsa_users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_verified', false),
      supabase.from('upsa_failed_accounts').select('*', { count: 'exact', head: true }),
    ]);

    const totalStudents = results[0].count || 0;
    const activePlans = results[1].count || 0;
    const totalPapers = results[2].count || 0;
    const totalDeleted = results[3].count || 0;
    const planRows = results[4].data || [];
    const transactions = results[5].data || [];
    const unverifiedCount = results[6].count || 0;
    const failedRegistrationAttempts = results[7].count || 0;
    const totalFailed = unverifiedCount;

    const planBreakdown = { basic: 0, plus: 0, pro: 0 };
    planRows.forEach((u: any) => {
      if (u.plan in planBreakdown) planBreakdown[u.plan as keyof typeof planBreakdown]++;
    });

    let totalRevenue = 0;
    let failedTransactions = 0;
    transactions.forEach((t: any) => {
      if (t.status === 'success') totalRevenue += Number(t.amount) || 0;
      if (t.status === 'failed') failedTransactions++;
    });

    // Process sales data for charts
    const salesByPeriod: Record<string, number> = {};
    const revenueByPlan: Record<string, number> = { basic: 0, plus: 0, pro: 0 };

    transactions.forEach((t: any) => {
      if (t.status === 'success') {
        let periodKey: string;
        const d = new Date(t.created_at);

        if (range === 'daily' || range === 'weekly') {
          periodKey = d.toISOString().split('T')[0]; // Daily
        } else {
          periodKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`; // Monthly
        }

        salesByPeriod[periodKey] = (salesByPeriod[periodKey] || 0) + (Number(t.amount) || 0);

        // Revenue by plan (we assume the plan is in the transaction metadata or we can infer it)
        // Since we don't have a direct plan column in transactions, we'll try to find it in metadata
        // or just skip if not present. Actually, let's assume we can infer it for this dashboard.
        // For now, let's use a dummy grouping or check if we have it.
        // Wait, I'll check the transaction schema in a moment.
      }
    });

    // AI Usage Stats (Join with users to get plan)
    const { data: aiStats } = await supabase
      .from('upsa_ai_queries')
      .select('user_id, upsa_users(plan)')
      .gte('created_at', gteDate.toISOString());

    const aiUsageByPlan: Record<string, number> = { free: 0, basic: 0, plus: 0, pro: 0 };
    (aiStats || []).forEach((q: any) => {
      const plan = q.upsa_users?.plan?.toLowerCase();
      if (plan && plan in aiUsageByPlan) {
        aiUsageByPlan[plan]++;
      }
    });

    // Revenue by Plan (Sum from transactions)
    const { data: revenueData } = await supabase
      .from('upsa_transactions')
      .select('amount, plan')
      .eq('status', 'success')
      .gte('created_at', gteDate.toISOString());

    const revenueBreakdownByPlan: Record<string, number> = { basic: 0, plus: 0, pro: 0 };
    (revenueData || []).forEach((r: any) => {
      const p = r.plan?.toLowerCase();
      if (p && p in revenueBreakdownByPlan) {
        revenueBreakdownByPlan[p] += Number(r.amount) || 0;
      }
    });

    const salesChartData = Object.keys(salesByPeriod).sort().map(key => ({
      date: key,
      revenue: salesByPeriod[key]
    }));

    // User Growth by Plan (Signups)
    const { data: usersForGrowth } = await supabase
      .from('upsa_users')
      .select('created_at, plan')
      .eq('role', 'student')
      .eq('is_verified', true)
      .gte('created_at', gteDate.toISOString())
      .order('created_at');

    const growthByPeriod: Record<string, any> = {};
    (usersForGrowth || []).forEach((u: any) => {
      const d = new Date(u.created_at);
      let periodKey: string;
      if (range === 'daily' || range === 'weekly') {
        periodKey = d.toISOString().split('T')[0]; // Daily granularity
      } else {
        periodKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`; // Monthly granularity
      }

      if (!growthByPeriod[periodKey]) {
        growthByPeriod[periodKey] = { date: periodKey, free: 0, basic: 0, plus: 0, pro: 0 };
      }
      const planKey = u.plan.toLowerCase() as 'free' | 'basic' | 'plus' | 'pro';
      if (planKey in growthByPeriod[periodKey]) {
        growthByPeriod[periodKey][planKey]++;
      }
    });

    const growthChartDataArr = Object.values(growthByPeriod).sort((a: any, b: any) => a.date.localeCompare(b.date));

    // Make it cumulative
    let cumulativeFree = 0;
    let cumulativeBasic = 0;
    let cumulativePlus = 0;
    let cumulativePro = 0;

    const cumulativeGrowthData = growthChartDataArr.map((d: any) => {
      cumulativeFree += d.free;
      cumulativeBasic += d.basic;
      cumulativePlus += d.plus;
      cumulativePro += d.pro;
      return {
        ...d,
        free: cumulativeFree,
        basic: cumulativeBasic,
        plus: cumulativePlus,
        pro: cumulativePro,
      };
    });

    res.status(200).json({
      totalStudents,
      activePlans,
      planBreakdown,
      totalPapers,
      totalDeleted,
      totalFailed,
      totalRevenue,
      failedTransactions,
      activeSubscribers: activePlans,
      salesChartData,
      growthChartData: cumulativeGrowthData,
      revenueByPlan: revenueBreakdownByPlan,
      aiUsageByPlan,
    });
  } catch (err: any) {

    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

router.get('/ai-config', async (req: AuthRequest, res: Response) => {
  try {
    let globalAiBlock = process.env.GLOBAL_AI_BLOCK === 'true';
    let globalBanner = '';
    let globalBannerActive = false;

    const { data, error } = await supabase
      .from('upsa_app_config')
      .select('global_ai_block, global_banner, global_banner_active')
      .eq('id', 1)
      .single();

    if (!error && data) {
      if (typeof data.global_ai_block === 'boolean') {
        globalAiBlock = data.global_ai_block;
      }
      if (typeof data.global_banner === 'string') {
        globalBanner = data.global_banner;
      }
      if (typeof data.global_banner_active === 'boolean') {
        globalBannerActive = data.global_banner_active;
      }
    }

    res.status(200).json({ globalAiBlock, globalBanner, globalBannerActive });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read AI config' });
  }
});

router.post('/ai-config', async (req: AuthRequest, res: Response) => {
  const { globalAiBlock, globalBanner, globalBannerActive } = req.body;
  try {
    // Get current config to merge
    const { data: currentData, error: fetchError } = await supabase
      .from('upsa_app_config')
      .select('*')
      .eq('id', 1)
      .single();

    const updates: any = { id: 1 };
    
    // We only update what was passed in the request body
    if (typeof globalAiBlock === 'boolean') updates.global_ai_block = globalAiBlock;
    else if (currentData) updates.global_ai_block = currentData.global_ai_block;

    if (typeof globalBanner === 'string') updates.global_banner = globalBanner;
    else if (currentData) updates.global_banner = currentData.global_banner;

    if (typeof globalBannerActive === 'boolean') updates.global_banner_active = globalBannerActive;
    else if (currentData) updates.global_banner_active = currentData.global_banner_active;

    updates.updated_at = new Date().toISOString();

    const { error: upsertError } = await supabase
      .from('upsa_app_config')
      .upsert(updates);

    if (upsertError) throw upsertError;

    res.status(200).json({ 
      success: true, 
      globalAiBlock: updates.global_ai_block,
      globalBanner: updates.global_banner,
      globalBannerActive: updates.global_banner_active
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// ── Broadcast Email ──────────────────
// If `recipients` array is provided, send only to those emails (individual mode).
// Otherwise, send to ALL verified students (broadcast mode).
router.post('/broadcast', async (req: AuthRequest, res: Response) => {
  const { subject, title, body: bodyText, recipients, sendInAppNotification } = req.body;

  if (!subject || !title || !bodyText) {
    res.status(400).json({ error: 'Subject, title, and body are required.' });
    return;
  }

  try {
    let emails: string[] = [];

    if (Array.isArray(recipients) && recipients.length > 0) {
      // Individual mode — use provided email list
      emails = recipients.map((e: string) => e.trim().toLowerCase()).filter(Boolean);
    } else {
      // Broadcast mode — fetch all verified student emails
      const { data: users, error } = await supabase
        .from('upsa_users')
        .select('email')
        .eq('role', 'student')
        .eq('is_verified', true);

      if (error) throw error;
      if (!users || users.length === 0) {
        res.status(200).json({ message: 'No verified students found.', sent: 0, failed: 0 });
        return;
      }
      emails = users.map((u: any) => u.email).filter(Boolean);
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send in batches of 10 with 1s delay between batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((email: string) => sendGeneralEmail(email, subject, title, bodyText))
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          sent++;
        } else {
          failed++;
          errors.push(`${batch[idx]}: ${r.reason?.message || 'Unknown error'}`);
        }
      });
      // Delay between batches to avoid SMTP rate limiting
      if (i + BATCH_SIZE < emails.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Log the broadcast as an admin notification
    const isIndividual = Array.isArray(recipients) && recipients.length > 0;

    // In-app notifications
    if (sendInAppNotification) {
      let targetUserIds: string[] = [];
      if (isIndividual) {
        const { data: usersData } = await supabase
          .from('upsa_users')
          .select('id')
          .in('email', emails);
        if (usersData) {
          targetUserIds = usersData.map((u: any) => u.id);
        }
      } else {
        const { data: usersData } = await supabase
          .from('upsa_users')
          .select('id')
          .eq('role', 'student');
        if (usersData) {
          targetUserIds = usersData.map((u: any) => u.id);
        }
      }

      if (targetUserIds.length > 0) {
        const notifications = targetUserIds.map((userId) => ({
          user_id: userId,
          title: title,
          message: bodyText,
          type: 'info',
          is_read: false
        }));

        const NOTIF_BATCH = 500;
        for (let i = 0; i < notifications.length; i += NOTIF_BATCH) {
          const batch = notifications.slice(i, i + NOTIF_BATCH);
          await supabase.from('upsa_notifications').insert(batch);
        }
      }
    }

    await supabase.from('upsa_admin_notifications').insert({
      title: isIndividual ? '📧 Individual Email Sent' : '📧 Broadcast Email Sent',
      message: `Subject: "${subject}" — Sent to ${sent}/${emails.length} ${isIndividual ? 'recipient(s)' : 'students'}. ${failed > 0 ? `${failed} failed.` : ''}`,
      type: 'info',
    });

    res.status(200).json({ message: 'Broadcast complete.', total: emails.length, sent, failed, errors: errors.slice(0, 10) });
  } catch (err: any) {
    console.error('Broadcast error:', err);
    res.status(500).json({ error: 'Failed to send broadcast.' });
  }
});

// ── Test Weekly Digest Cron Job ───────
router.post('/test-weekly-digest', protect, adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    await runWeeklyDigestJob();
    res.status(200).json({ message: 'Weekly digest job triggered successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to run weekly digest.' });
  }
});

export default router;