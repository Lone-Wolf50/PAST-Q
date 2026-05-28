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

    res.status(500).json({ error: 'Failed to fetch subjects.' });
  }
});

// ── GET ALL PAPERS (with filters, paginated) ──────────────────────────────────
router.get('/', protect, async (req: AuthRequest, res: Response) => {
  const { subject_id, subject_name, year, semester, search, page = '1', limit = '100' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const from = (pageNum - 1) * limitNum;

  try {
    let query = supabase
      .from('upsa_papers')
      // Note: we fetch file_url but we'll omit it from the response to enforce download limits
      .select('id, title, year, semester, has_answers, answer_url, upsa_subjects!inner(name, code)', { count: 'exact' })
      .order('year', { ascending: false })
      .order('title', { ascending: true })
      .range(from, from + limitNum - 1);

    if (subject_id) query = query.eq('subject_id', subject_id);
    if (subject_name) query = query.eq('upsa_subjects.name', subject_name);
    if (year) query = query.eq('year', year);
    if (semester) query = query.eq('semester', semester);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    const user = req.user!;
    const canSeeAnswers = ['basic', 'plus', 'pro'].includes(user.plan);

    const sanitizedPapers = (data || []).map((p: any) => ({
      ...p,
      has_answers: p.has_answers && canSeeAnswers,
      answer_url: canSeeAnswers ? p.answer_url : null,
    }));

    res.status(200).json({ papers: sanitizedPapers, total: count, page: pageNum, limit: limitNum });
  } catch (err) {

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

    } else {

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
    const limit = plan.toLowerCase() === 'basic' ? 20 : 4;
    
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
        // Hit limit, block for 3 days
        const blockDate = new Date();
        blockDate.setDate(blockDate.getDate() + 3);
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

    res.status(500).json({ error: 'Failed to process download request.' });
  }
});

// ── REQUEST VIEW URL (Enforces Limits) ──────────────────────────────────────
router.post('/:id/view', protect, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  
  try {
    // 1. Get user stats
    const { data: userData, error: userError } = await supabase
      .from('upsa_users')
      .select('plan, pdf_views_count, pdf_views_blocked_until')
      .eq('id', user.id)
      .single();
      
    if (userError || !userData) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const { plan, pdf_views_count, pdf_views_blocked_until } = userData;
    const isUnlimited = ['plus', 'pro'].includes(plan.toLowerCase());
    const limit = plan.toLowerCase() === 'basic' ? 20 : 4;
    
    // 2. Check if blocked
    if (!isUnlimited && pdf_views_blocked_until) {
      const blockedUntil = new Date(pdf_views_blocked_until);
      if (blockedUntil > new Date()) {
        const daysLeft = Math.ceil((blockedUntil.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
        res.status(429).json({ 
          error: 'limit_reached', 
          message: `You have reached your view limit. Please wait ${daysLeft} days or upgrade your plan.` 
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
      let newCount = (pdf_views_count || 0) + 1;
      let newBlockedUntil = null;
      
      // If block expired, treat this as view 1
      if (pdf_views_blocked_until && new Date(pdf_views_blocked_until) <= new Date()) {
        newCount = 1;
      }

      if (newCount >= limit) {
        // Hit limit, block for 3 days
        const blockDate = new Date();
        blockDate.setDate(blockDate.getDate() + 3);
        newBlockedUntil = blockDate.toISOString();
        newCount = 0; // reset for next cycle
      }

      await supabase
        .from('upsa_users')
        .update({
          pdf_views_count: newCount,
          pdf_views_blocked_until: newBlockedUntil
        })
        .eq('id', user.id);
    }

    res.status(200).json({ file_url: paper.file_url });
  } catch (err) {

    res.status(500).json({ error: 'Failed to process view request.' });
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

    res.status(500).json({ error: 'Failed to fetch subjects.' });
  }
});

// ── BOOKMARKS ────────────────────────────────────────────────────────────────

/**
 * GET /papers/bookmarks/ids
 * Returns an array of paper IDs the logged-in (premium) user has bookmarked.
 * Used on PapersPage to highlight starred cards on load.
 */
router.get('/bookmarks/ids', protect, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const premiumPlans = ['basic', 'plus', 'pro'];
  if (!premiumPlans.includes(user.plan?.toLowerCase())) {
    res.status(200).json({ ids: [] });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('upsa_bookmarks')
      .select('paper_id')
      .eq('user_id', user.id);
    if (error) throw error;
    res.status(200).json({ ids: (data || []).map((b: any) => b.paper_id) });
  } catch (err) {

    res.status(500).json({ error: 'Failed to fetch bookmarks.' });
  }
});

/**
 * GET /papers/bookmarks
 * Returns full paper objects for the logged-in (premium) user's bookmarks.
 */
router.get('/bookmarks', protect, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const premiumPlans = ['basic', 'plus', 'pro'];
  if (!premiumPlans.includes(user.plan?.toLowerCase())) {
    res.status(403).json({ error: 'Bookmarks are available on premium plans only.' });
    return;
  }
  try {
    const { data, error } = await supabase
      .from('upsa_bookmarks')
      .select('paper_id, upsa_papers(id, title, year, semester, has_answers, answer_url, upsa_subjects(name, code))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const papers = (data || []).map((b: any) => b.upsa_papers).filter(Boolean);
    res.status(200).json({ papers });
  } catch (err) {

    res.status(500).json({ error: 'Failed to fetch bookmarks.' });
  }
});

/**
 * POST /papers/:id/bookmark
 * Toggle: adds bookmark if not present, removes if present.
 * Premium plans only.
 */
router.post('/:id/bookmark', protect, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const premiumPlans = ['basic', 'plus', 'pro'];
  if (!premiumPlans.includes(user.plan?.toLowerCase())) {
    res.status(403).json({ error: 'Bookmarks are available on premium plans only.' });
    return;
  }
  try {
    // Check if already bookmarked
    const { data: existing } = await supabase
      .from('upsa_bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('paper_id', id)
      .single();

    if (existing) {
      // Remove bookmark
      await supabase.from('upsa_bookmarks').delete().eq('id', existing.id);
      res.status(200).json({ bookmarked: false });
    } else {
      // Add bookmark
      await supabase.from('upsa_bookmarks').insert({ user_id: user.id, paper_id: id });
      res.status(200).json({ bookmarked: true });
    }
  } catch (err) {

    res.status(500).json({ error: 'Failed to update bookmark.' });
  }
});

// ── CONTENT REPORTS ───────────────────────────────────────────────────────────

/**
 * POST /papers/:id/report
 * Any logged-in user can submit a content quality report.
 * Also creates an admin notification.
 */
router.post('/:id/report', protect, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { reason, details } = req.body;

  const validReasons = ['blurry_pdf', 'missing_pages', 'wrong_paper', 'other'];
  if (!reason || !validReasons.includes(reason)) {
    res.status(400).json({ error: 'A valid report reason is required.' });
    return;
  }

  try {
    // Fetch paper title for the notification message
    const { data: paper } = await supabase
      .from('upsa_papers')
      .select('title, upsa_subjects(name)')
      .eq('id', id)
      .single();

    const paperTitle = (paper as any)?.title || (paper as any)?.upsa_subjects?.name || 'Unknown Paper';
    const reasonLabels: Record<string, string> = {
      blurry_pdf: 'PDF is blurry/unreadable',
      missing_pages: 'Pages are missing',
      wrong_paper: 'Wrong paper uploaded',
      other: 'Other issue',
    };

    // Insert report
    await supabase.from('upsa_paper_reports').insert({
      user_id: user.id,
      paper_id: id,
      reason,
      details: details || null,
    });

    // Create admin notification
    await supabase.from('upsa_admin_notifications').insert({
      title: '🚩 Content Report',
      message: `"${paperTitle}" — ${reasonLabels[reason]}${details ? `: ${details}` : ''}. Reported by user ${user.email}.`,
      type: 'report',
    });

    res.status(201).json({ message: 'Report submitted. Thank you for helping us improve!' });
  } catch (err) {

    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

export default router;
