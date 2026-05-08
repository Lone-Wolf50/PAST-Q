import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { protect, AuthRequest } from '../middleware/auth';
import { generatePaperInsights, isProcessing } from '../lib/ai-insights';


const router = Router();

// ── Public: subjects list used on the Landing Page (no auth required) ─────────
router.get('/subjects/public', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('upsa_subjects')
      .select('id, name, code, upsa_papers(count)')
      .order('name');

    if (error) throw error;

    const subjects = (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      count: s.upsa_papers?.[0]?.count ?? 0,
    }));

    res.status(200).json({ subjects });
  } catch (err) {
    console.error('[papers GET /subjects/public]', err);
    res.status(500).json({ error: 'Failed to fetch subjects.' });
  }
});

// ── GET ALL PAPERS (with filters, paginated) ──────────────────────────────────
router.get('/', protect, async (req: AuthRequest, res: Response) => {
  const { subject_id, year, semester, search, page = '1', limit = '100' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const from = (pageNum - 1) * limitNum;

  try {
    let query = supabase
      .from('upsa_papers')
      // Note: we fetch file_url but we'll omit it from the response to enforce download limits
      .select('id, title, year, semester, has_answers, upsa_subjects(name, code)', { count: 'exact' })
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

// ── GET SINGLE PAPER ──────────────────────────────────────────────────────────
router.get('/:id', protect, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  try {
    const { data: paper, error } = await supabase
      .from('upsa_papers')
      .select('id, title, year, semester, has_answers, answer_url, upsa_subjects(name, code), upsa_paper_insights(*)')
      .eq('id', id)
      .single();

    if (error || !paper) {
      res.status(404).json({ error: 'Paper not found.' });
      return;
    }

    // Answer keys restricted to paid plans
    const canSeeAnswers = ['basic', 'plus', 'pro'].includes(user.plan);
    const insightsData = (paper as any).upsa_paper_insights?.[0] || null;

    // ── Insight cache logging ──────────────────────────────────────────────
    if (insightsData) {
      console.log(`[Papers] ✅ Serving CACHED insights from DB for paper "${paper.title}" (id=${id}) → Student: ${user.id} (${user.plan} plan)`);
    } else {
      console.log(`[Papers] ℹ️  No insights in DB yet for paper "${paper.title}" (id=${id}) — will be generated on first AI Chat visit.`);
    }

    const responseData = {
      ...paper,
      has_answers: paper.has_answers && canSeeAnswers,
      answer_url: canSeeAnswers ? (paper as any).answer_url : null,
      insights: insightsData,
      upsa_paper_insights: undefined, // remove raw join result
      // file_url is intentionally omitted. Use POST /:id/download
    };

    res.status(200).json({ paper: responseData });
  } catch (err) {
    console.error('[papers GET /:id]', err);
    res.status(500).json({ error: 'Failed to fetch paper.' });
  }
});

// ── REQUEST DOWNLOAD URL (Enforces Limits) ──────────────────────────────────
router.post('/:id/download', protect, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  
  try {
    // 1. Get user stats
    const { data: userData, error: userError } = await supabase
      .from('upsa_users')
      .select('plan, pdf_downloads_count, pdf_downloads_blocked_until')
      .eq('id', user.id)
      .single();
      
    if (userError || !userData) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const { plan, pdf_downloads_count, pdf_downloads_blocked_until } = userData;
    const isUnlimited = ['plus', 'pro'].includes(plan.toLowerCase());
    const limit = plan.toLowerCase() === 'basic' ? 20 : 7;
    
    // 2. Check if blocked
    if (!isUnlimited && pdf_downloads_blocked_until) {
      const blockedUntil = new Date(pdf_downloads_blocked_until);
      if (blockedUntil > new Date()) {
        const daysLeft = Math.ceil((blockedUntil.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
        res.status(429).json({ 
          error: 'limit_reached', 
          message: `You have reached your download limit. Please wait ${daysLeft} days or upgrade your plan.` 
        });
        return;
      } else {
        // Block expired, reset count implicitly by continuing and updating it later
      }
    }

    // 3. Fetch file URL
    const { data: paper, error: paperError } = await supabase
      .from('upsa_papers')
      .select('file_url')
      .eq('id', id)
      .single();

    if (paperError || !paper) {
      res.status(404).json({ error: 'Paper not found.' });
      return;
    }

    // 4. Update usage (if not unlimited)
    if (!isUnlimited) {
      let newCount = (pdf_downloads_count || 0) + 1;
      let newBlockedUntil = null;
      
      // If block expired, treat this as download 1
      if (pdf_downloads_blocked_until && new Date(pdf_downloads_blocked_until) <= new Date()) {
        newCount = 1;
      }

      if (newCount >= limit) {
        // Hit limit, block for 6 days
        const blockDate = new Date();
        blockDate.setDate(blockDate.getDate() + 6);
        newBlockedUntil = blockDate.toISOString();
        newCount = 0; // reset for next cycle
      }

      await supabase
        .from('upsa_users')
        .update({
          pdf_downloads_count: newCount,
          pdf_downloads_blocked_until: newBlockedUntil
        })
        .eq('id', user.id);
    }

    res.status(200).json({ file_url: paper.file_url });
  } catch (err) {
    console.error('[papers POST /:id/download]', err);
    res.status(500).json({ error: 'Failed to process download request.' });
  }
});



// ── GET ALL SUBJECTS (authenticated, includes paper count) ────────────────────
router.get('/subjects/all', protect, async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('upsa_subjects')
      .select('id, name, code, upsa_papers(count)')
      .order('name');

    if (error) throw error;

    const subjects = (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      count: s.upsa_papers?.[0]?.count ?? 0,
    }));

    res.status(200).json({ subjects });
  } catch (err) {
    console.error('[papers GET /subjects/all]', err);
    res.status(500).json({ error: 'Failed to fetch subjects.' });
  }
});

export default router;
