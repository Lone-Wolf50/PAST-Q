import { Router, Response } from 'express';
import { supabase } from '../lib/supabase';
import { protect, adminOnly, AuthRequest } from '../middleware/auth';

const router = Router();

// All user routes are admin-only
router.use(protect, adminOnly);

// --- GET ALL USERS ---
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('upsa_users')
      .select('id, full_name, email, plan, role, is_verified, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ users: data });
  } catch (err) {

    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// --- UPDATE USER PLAN ---
router.patch('/:id/plan', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { plan } = req.body;
  const validPlans = ['free', 'basic', 'plus', 'pro'];

  if (!validPlans.includes(plan)) {
    res.status(400).json({ error: 'Invalid plan value.' });
    return;
  }

  try {
    const { error } = await supabase
      .from('upsa_users')
      .update({ plan })
      .eq('id', id);

    if (error) throw error;
    res.status(200).json({ message: `User plan updated to ${plan}.` });
  } catch (err) {

    res.status(500).json({ error: 'Failed to update user plan.' });
  }
});

// --- DELETE USER ---
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('upsa_users')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(200).json({ message: 'User account deleted successfully.' });
  } catch (err) {

    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

export default router;
