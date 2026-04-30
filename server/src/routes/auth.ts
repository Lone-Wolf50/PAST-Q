import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { supabase } from '../lib/supabase';
import { sendOtpEmail } from '../lib/mailer';

const router = Router();

// Stricter rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
});

// --- Helpers ---
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const otpExpiry = () => new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

// --- REGISTER ---
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  const { full_name, email, password } = req.body;

  if (!full_name || !email || !password) {
    res.status(400).json({ error: 'All fields are required.' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  try {
    // Check if email already exists
    const { data: existing } = await supabase
      .from('UPSA_users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);
    const otp = generateOtp();
    const otp_expires_at = otpExpiry();

    // Create user (unverified)
    const { data: user, error } = await supabase
      .from('UPSA_users')
      .insert({ full_name, email, password_hash, otp, otp_expires_at, is_verified: false })
      .select('id, email')
      .single();

    if (error || !user) {
      res.status(500).json({ error: 'Failed to create account. Please try again.' });
      return;
    }

    // Send OTP email
    await sendOtpEmail(email, otp, 'verify');

    res.status(201).json({ message: 'Account created. Please check your email for the verification code.' });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// --- VERIFY EMAIL (OTP) ---
router.post('/verify-email', authLimiter, async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400).json({ error: 'Email and OTP are required.' });
    return;
  }

  try {
    const { data: user, error } = await supabase
      .from('UPSA_users')
      .select('id, otp, otp_expires_at, is_verified')
      .eq('email', email)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (user.is_verified) {
      res.status(400).json({ error: 'Email is already verified.' });
      return;
    }

    if (user.otp !== otp) {
      res.status(400).json({ error: 'Invalid OTP code.' });
      return;
    }

    if (new Date(user.otp_expires_at) < new Date()) {
      res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      return;
    }

    // Mark as verified, clear OTP
    await supabase
      .from('UPSA_users')
      .update({ is_verified: true, otp: null, otp_expires_at: null })
      .eq('id', user.id);

    res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error('[verify-email]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// --- LOGIN ---
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  try {
    const { data: user, error } = await supabase
      .from('UPSA_users')
      .select('id, full_name, email, password_hash, plan, role, is_verified')
      .eq('email', email)
      .single();

    if (error || !user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!user.is_verified) {
      res.status(403).json({ error: 'Please verify your email before logging in.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, plan: user.plan, role: user.role || 'student' },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    res.status(200).json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        plan: user.plan,
        role: user.role || 'student',
      }
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// --- FORGOT PASSWORD ---
router.post('/forgot-password', authLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }

  try {
    const { data: user } = await supabase
      .from('UPSA_users')
      .select('id')
      .eq('email', email)
      .single();

    // Always return success to prevent email enumeration
    if (!user) {
      res.status(200).json({ message: 'If an account exists, a reset code has been sent.' });
      return;
    }

    const otp = generateOtp();
    const otp_expires_at = otpExpiry();

    await supabase
      .from('UPSA_users')
      .update({ otp, otp_expires_at })
      .eq('id', user.id);

    await sendOtpEmail(email, otp, 'reset');

    res.status(200).json({ message: 'If an account exists, a reset code has been sent.' });
  } catch (err) {
    console.error('[forgot-password]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// --- RESET PASSWORD ---
router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  const { email, otp, new_password } = req.body;

  if (!email || !otp || !new_password) {
    res.status(400).json({ error: 'All fields are required.' });
    return;
  }

  if (new_password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  try {
    const { data: user } = await supabase
      .from('UPSA_users')
      .select('id, otp, otp_expires_at')
      .eq('email', email)
      .single();

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (user.otp !== otp) {
      res.status(400).json({ error: 'Invalid or expired reset code.' });
      return;
    }

    if (new Date(user.otp_expires_at) < new Date()) {
      res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
      return;
    }

    const password_hash = await bcrypt.hash(new_password, 12);

    await supabase
      .from('UPSA_users')
      .update({ password_hash, otp: null, otp_expires_at: null })
      .eq('id', user.id);

    res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// --- RESEND OTP ---
router.post('/resend-otp', authLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }

  try {
    const { data: user } = await supabase
      .from('UPSA_users')
      .select('id, is_verified')
      .eq('email', email)
      .single();

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (user.is_verified) {
      res.status(400).json({ error: 'This account is already verified.' });
      return;
    }

    const otp = generateOtp();
    const otp_expires_at = otpExpiry();

    await supabase
      .from('UPSA_users')
      .update({ otp, otp_expires_at })
      .eq('id', user.id);

    await sendOtpEmail(email, otp, 'verify');

    res.status(200).json({ message: 'A new verification code has been sent to your email.' });
  } catch (err) {
    console.error('[resend-otp]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
