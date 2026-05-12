import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
      .from('upsa_users')
      .select('id, full_name, email, plan, plan_expires, created_at, avatar_url')
      .eq('id', userId)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Fetch AI usage count for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: aiUsageCount } = await supabase
      .from('upsa_ai_queries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo);

    res.status(200).json({ 
      user: {
        ...user,
        ai_usage_count: aiUsageCount || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

// --- UPDATE PROFILE ---
router.patch('/me', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { full_name } = req.body;

  if (full_name !== undefined && full_name.trim().length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }

  const updates: any = {};
  if (full_name !== undefined) updates.full_name = full_name.trim();
  if (req.body.avatar_url !== undefined) updates.avatar_url = req.body.avatar_url;

  try {
    const { data, error } = await supabase
      .from('upsa_users')
      .update(updates)
      .eq('id', userId)
      .select('id, full_name, email, plan, avatar_url')
      .single();

    if (error) throw error;

    res.status(200).json({ user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// --- UPLOAD AVATAR ---
router.post('/me/avatar', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { avatar_base64 } = req.body;

  if (!avatar_base64 || typeof avatar_base64 !== 'string') {
    res.status(400).json({ error: 'Avatar data is required.' });
    return;
  }

  // Guard: max 7MB base64 string (~5MB image)
  if (avatar_base64.length > 7 * 1024 * 1024) {
    res.status(413).json({ error: 'Image is too large. Maximum size is 5MB.' });
    return;
  }

  try {
    // Safe parsing: avoid regex on huge strings (can cause V8 RangeError)
    const commaIdx = avatar_base64.indexOf(',');
    const semicolonIdx = avatar_base64.indexOf(';');
    if (
      !avatar_base64.startsWith('data:') ||
      commaIdx === -1 ||
      semicolonIdx === -1 ||
      semicolonIdx > commaIdx
    ) {
      res.status(400).json({ error: 'Invalid base64 image data.' });
      return;
    }

    const mimeType = avatar_base64.substring(5, semicolonIdx); // between 'data:' and ';'
    const base64Data = avatar_base64.substring(commaIdx + 1);
    const buffer = Buffer.from(base64Data, 'base64');
    const fileExtension = mimeType.split('/')[1]?.split('+')[0] || 'png';
    const filePath = `${userId}/avatar.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {

      res.status(500).json({ error: `Storage error: ${uploadError.message}` });
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    // Bust the CDN cache by appending a timestamp query param
    const publicUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: dbError } = await supabase
      .from('upsa_users')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (dbError) {

      res.status(500).json({ error: `DB error: ${dbError.message}` });
      return;
    }

    res.status(200).json({ avatar_url: publicUrl, message: 'Avatar updated successfully.' });
  } catch (err: any) {

    res.status(500).json({ error: err?.message || 'Failed to upload avatar.' });
  }
});

// --- DELETE AVATAR ---
router.delete('/me/avatar', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const { data: user } = await supabase.from('upsa_users').select('avatar_url').eq('id', userId).single();
    if (user?.avatar_url) {
      // Strip query string (?t=...) before parsing the path
      const cleanUrl = user.avatar_url.split('?')[0];
      const urlParts = cleanUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];   // e.g. avatar.png
      const folderName = urlParts[urlParts.length - 2]; // e.g. userId

      if (folderName === userId && fileName) {
        const { error: removeError } = await supabase.storage
          .from('avatars')
          .remove([`${userId}/${fileName}`]);
        if (removeError) {

        }
      }
    }

    await supabase.from('upsa_users').update({ avatar_url: null }).eq('id', userId);
    res.status(200).json({ message: 'Avatar deleted successfully.' });
  } catch (err: any) {

    res.status(500).json({ error: 'Failed to delete avatar.' });
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
      .from('upsa_users')
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
      .from('upsa_users')
      .update({ password_hash })
      .eq('id', userId);

    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// --- GET DELETE ACCOUNT WORD ---
router.get('/delete-word', (req: AuthRequest, res: Response) => {
  const words = ['PENCIL', 'ERASER', 'LAPTOP', 'CAMPUS', 'DEGREE', 'STUDENT', 'LIBRARY', 'EXAMS'];
  const word = words[Math.floor(Math.random() * words.length)] + '-' + Math.floor(1000 + Math.random() * 9000);
  const token = jwt.sign({ delete_word: word, id: req.user!.id }, process.env.JWT_SECRET!, { expiresIn: '15m' });
  res.status(200).json({ word, token });
});

// --- DELETE ACCOUNT ---
router.delete('/me', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { confirmation_word, token } = req.body;

  if (!confirmation_word || !token) {
    res.status(400).json({ error: 'Confirmation word and token are required.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (decoded.id !== userId || decoded.delete_word !== confirmation_word) {
      res.status(400).json({ error: 'Invalid or expired confirmation word.' });
      return;
    }

    // 1. Fetch user data before deletion
    const { data: user } = await supabase
      .from('upsa_users')
      .select('email, full_name, plan')
      .eq('id', userId)
      .single();

    // 2. Archive to upsa_deleted_accounts
    if (user) {
      const { error: archiveError } = await supabase.from('upsa_deleted_accounts').insert({
        email: user.email,
        full_name: user.full_name,
        plan: user.plan,
        deleted_at: new Date().toISOString()
      });
      if (archiveError) {

      }
    }

    // 3. Perform hard delete
    await supabase.from('upsa_users').delete().eq('id', userId);

    if (user) {
      await supabase.from('upsa_admin_notifications').insert({
        title: 'Account Deleted',
        message: `User ${user.email} (${user.full_name || 'No Name'}) has permanently deleted their account.`,
        type: 'alert'
      });
    }

    res.status(200).json({ message: 'Account deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

// --- GET MY NOTIFICATIONS ---
router.get('/notifications', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const { data, error } = await supabase
      .from('upsa_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ notifications: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// --- MARK NOTIFICATION AS READ ---
router.patch('/notifications/:id/read', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('upsa_notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    res.status(200).json({ message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

// --- MARK ALL AS READ ---
router.patch('/notifications/read-all', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const { error } = await supabase
      .from('upsa_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

export default router;
