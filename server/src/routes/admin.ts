import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase';
import { protect, adminOnly, AuthRequest } from '../middleware/auth';

const router = Router();

// ── Admin Login (password-only, separate from student auth) ──────────────────
router.post('/auth/login', async (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ error: 'Password is required.' });
    return;
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    // Simulate a slight delay to thwart brute force
    await new Promise((r) => setTimeout(r, 400));
    res.status(401).json({ error: 'Invalid admin credentials.' });
    return;
  }

  const token = jwt.sign(
    { id: 'admin', email: process.env.ADMIN_EMAIL || 'admin@pastq.com', plan: 'pro', role: 'admin' },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' } as jwt.SignOptions
  );

  res.status(200).json({ token });
});

// All routes below require JWT + admin role
router.use(protect, adminOnly);

// ── Subjects CRUD ─────────────────────────────────────────────────────────────
router.get('/subjects', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('UPSA_subjects')
      .select('id, name, code, created_at')
      .order('name');
    if (error) throw error;
    res.status(200).json({ subjects: data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch subjects.' });
  }
});

router.post('/subjects', async (req: AuthRequest, res: Response) => {
  const { name, code } = req.body;
  if (!name || !code) { res.status(400).json({ error: 'Name and code are required.' }); return; }
  try {
    const { data, error } = await supabase
      .from('UPSA_subjects').insert({ name, code }).select('id, name, code').single();
    if (error) throw error;
    res.status(201).json({ subject: data });
  } catch {
    res.status(500).json({ error: 'Failed to create subject.' });
  }
});

router.patch('/subjects/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, code } = req.body;
  try {
    const { data, error } = await supabase
      .from('UPSA_subjects').update({ name, code }).eq('id', id).select('id, name, code').single();
    if (error) throw error;
    res.status(200).json({ subject: data });
  } catch {
    res.status(500).json({ error: 'Failed to update subject.' });
  }
});

router.delete('/subjects/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await supabase.from('UPSA_subjects').delete().eq('id', id);
    res.status(200).json({ message: 'Subject deleted.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete subject.' });
  }
});

// ── Papers CRUD ───────────────────────────────────────────────────────────────
router.get('/papers', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('UPSA_papers')
      .select('id, title, year, semester, file_url, has_answers, subjects(name, code)')
      .order('year', { ascending: false });
    if (error) throw error;
    res.status(200).json({ papers: data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch papers.' });
  }
});

router.post('/papers', async (req: AuthRequest, res: Response) => {
  const { title, subject_id, year, semester, file_url, has_answers, answer_url } = req.body;
  if (!title || !subject_id || !year || !semester || !file_url) {
    res.status(400).json({ error: 'All required fields must be provided.' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('UPSA_papers')
      .insert({ title, subject_id, year, semester, file_url, has_answers: !!has_answers, answer_url: answer_url || null })
      .select('id, title').single();
    if (error) throw error;
    res.status(201).json({ paper: data });
  } catch {
    res.status(500).json({ error: 'Failed to upload paper.' });
  }
});

router.delete('/papers/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await supabase.from('UPSA_papers').delete().eq('id', id);
    res.status(200).json({ message: 'Paper deleted.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete paper.' });
  }
});

// ── Users Management ──────────────────────────────────────────────────────────
router.get('/users', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('UPSA_users')
      .select('id, full_name, email, plan, role, is_verified, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.status(200).json({ users: data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

router.patch('/users/:id/plan', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { plan } = req.body;
  const validPlans = ['free', 'basic', 'plus', 'pro'];
  if (!validPlans.includes(plan)) { res.status(400).json({ error: 'Invalid plan.' }); return; }
  try {
    await supabase.from('UPSA_users').update({ plan }).eq('id', id);
    res.status(200).json({ message: `Plan updated to ${plan}.` });
  } catch {
    res.status(500).json({ error: 'Failed to update plan.' });
  }
});

router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await supabase.from('UPSA_users').delete().eq('id', id);
    res.status(200).json({ message: 'User deleted.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// ── Payments Overview ─────────────────────────────────────────────────────────
router.get('/payments', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('UPSA_transactions')
      .select('id, reference, plan, amount, status, created_at, UPSA_users(full_name, email)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.status(200).json({ transactions: data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch payments.' });
  }
});

// ── Dashboard Stats ───────────────────────────────────────────────────────────
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [usersResult, papersResult, txResult] = await Promise.all([
      supabase.from('UPSA_users').select('id, plan', { count: 'exact' }),
      supabase.from('UPSA_papers').select('id', { count: 'exact' }),
      supabase.from('UPSA_transactions').select('amount, status'),
    ]);

    const totalUsers = usersResult.count || 0;
    const activePlans = (usersResult.data || []).filter(u => u.plan !== 'free').length;
    const totalPapers = papersResult.count || 0;
    const totalRevenue = (txResult.data || [])
      .filter(t => t.status === 'success')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    res.status(200).json({ totalUsers, activePlans, totalPapers, totalRevenue });
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

export default router;
