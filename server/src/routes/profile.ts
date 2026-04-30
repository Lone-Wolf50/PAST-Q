import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();

// All profile routes require authentication
router.use(protect);

// --- GET MY PROFILE ---
router.get('/me', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const { data: user, error } = await supabase
      .from('UPSA_users')
      .select('id, full_name, email, plan, plan_expires, created_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

// --- UPDATE PROFILE ---
router.patch('/me', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { full_name } = req.body;

  if (!full_name || full_name.trim().length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('UPSA_users')
      .update({ full_name: full_name.trim() })
      .eq('id', userId)
      .select('id, full_name, email, plan')
      .single();

    if (error) throw error;

    res.status(200).json({ user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// --- CHANGE PASSWORD ---
router.post('/me/change-password', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    res.status(400).json({ error: 'Both current and new password are required.' });
    return;
  }

  if (new_password.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters.' });
    return;
  }

  try {
    const { data: user, error } = await supabase
      .from('UPSA_users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const password_hash = await bcrypt.hash(new_password, 12);

    await supabase
      .from('UPSA_users')
      .update({ password_hash })
      .eq('id', userId);

    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// --- DELETE ACCOUNT ---
router.delete('/me', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ error: 'Password confirmation is required.' });
    return;
  }

  try {
    const { data: user, error } = await supabase
      .from('UPSA_users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(400).json({ error: 'Incorrect password.' });
      return;
    }

    await supabase.from('UPSA_users').delete().eq('id', userId);

    res.status(200).json({ message: 'Account deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

export default router;
