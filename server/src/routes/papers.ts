import { Router, Response } from 'express';
import { supabase } from '../lib/supabase';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();

// --- GET ALL PAPERS (with filters) ---
router.get('/', protect, async (req: AuthRequest, res: Response) => {
  const { subject_id, year, semester, search, page = '1', limit = '20' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const from = (pageNum - 1) * limitNum;

  try {
    let query = supabase
      .from('UPSA_papers')
      .select('id, title, year, semester, file_url, subjects(name, code)', { count: 'exact' })
      .order('year', { ascending: false })
      .range(from, from + limitNum - 1);

    if (subject_id) query = query.eq('subject_id', subject_id);
    if (year) query = query.eq('year', year);
    if (semester) query = query.eq('semester', semester);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error, count } = await query;

    if (error) throw error;

    res.status(200).json({ papers: data, total: count, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error('[papers GET /]', err);
    res.status(500).json({ error: 'Failed to fetch papers.' });
  }
});

// --- GET SINGLE PAPER ---
router.get('/:id', protect, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  try {
    const { data: paper, error } = await supabase
      .from('UPSA_papers')
      .select('id, title, year, semester, file_url, has_answers, subjects(name, code)')
      .eq('id', id)
      .single();

    if (error || !paper) {
      res.status(404).json({ error: 'Paper not found.' });
      return;
    }

    // Answer keys are restricted to Basic/Plus/Pro
    const canSeeAnswers = ['basic', 'plus', 'pro'].includes(user.plan);
    const responseData = {
      ...paper,
      has_answers: paper.has_answers && canSeeAnswers,
      answer_url: canSeeAnswers ? (paper as any).answer_url : null,
    };

    res.status(200).json({ paper: responseData });
  } catch (err) {
    console.error('[papers GET /:id]', err);
    res.status(500).json({ error: 'Failed to fetch paper.' });
  }
});

// --- GET ALL SUBJECTS ---
router.get('/subjects/all', protect, async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('UPSA_subjects')
      .select('id, name, code')
      .order('name');

    if (error) throw error;

    res.status(200).json({ subjects: data });
  } catch (err) {
    console.error('[papers GET /subjects/all]', err);
    res.status(500).json({ error: 'Failed to fetch subjects.' });
  }
});

export default router;
