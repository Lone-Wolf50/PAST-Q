import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import validator from 'validator';
import { supabase } from '../lib/supabase';
import { sendOtpEmail } from '../lib/mailer';
import crypto from 'crypto';

const router = Router();

// ─── Rate limiter ────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
});

// ─── Helpers ─────────────────────────────────────────────────
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();
const otpExpiry = () => new Date(Date.now() + 5 * 60 * 1000).toISOString();

/**
 * Sanitize a free-text string:
 * - Trim whitespace
 * - Strip HTML tags and dangerous characters to prevent XSS stored in DB
 * - Collapse multiple spaces into one
 */
const sanitizeText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return validator.escape(value.trim()).replace(/\s+/g, ' ');
};

/**
 * Normalize and validate an email address:
 * - Trim and lowercase
 * - Reject anything that isn't a valid email format
 * Returns null if invalid.
 */
const sanitizeEmail = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const email = validator.normalizeEmail(value.trim(), { gmail_remove_dots: false });
  if (!email || !validator.isEmail(email)) return null;
  return email;
};

/**
 * Check if the email address is allowed on the platform:
 * - Prevent student upsamail emails matching [digits]@upsamail.edu.gh or id[digits]@upsamail.edu.gh
 * - Allow other upsamail.edu.gh emails (staff/faculty)
 * - Allow gmail.com (standard personal email)
 * - Exclude all other third-party email providers
 */
const isAllowedEmail = (email: string): boolean => {
  const lowercaseEmail = email.toLowerCase().trim();
  
  // 1. Block student upsamail (e.g. 10306679@upsamail.edu.gh or id10306679@upsamail.edu.gh)
  const upsaStudentRegex = /^(id)?\d+@upsamail\.edu\.gh$/i;
  if (upsaStudentRegex.test(lowercaseEmail)) {
    return false;
  }
  
  // 2. Allow non-student upsamail (e.g. staff/admin @upsamail.edu.gh)
  if (lowercaseEmail.endsWith('@upsamail.edu.gh')) {
    return true;
  }
  
  // 3. Force all other personal/third-party emails to strictly be Gmail
  if (lowercaseEmail.endsWith('@gmail.com')) {
    return true;
  }
  
  return false;
};

/**
 * Ensure a value is a plain string OTP of exactly 6 digits.
 * Rejects booleans, objects, or anything non-numeric.
 */
const sanitizeOtp = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{6}$/.test(trimmed)) return null;
  return trimmed;
};


// ─── REGISTER ────────────────────────────────────────────────
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  const full_name = sanitizeText(req.body.full_name);
  const email = sanitizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  // Validate full_name
  if (!full_name || full_name.length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }
  if (full_name.length > 100) {
    res.status(400).json({ error: 'Full name must be under 100 characters.' });
    return;
  }

  // Validate email
  if (!email) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }

  // Restrict emails
  if (!isAllowedEmail(email)) {
    res.status(400).json({ 
      error: 'Only personal Gmail accounts (@gmail.com) or staff upsamail emails are allowed. Student upsamail accounts and other third-party providers (Yahoo, Outlook, etc.) are restricted.' 
    });
    return;
  }

  // Validate password — enforce on backend, not just frontend
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }
  if (password.length > 128) {
    res.status(400).json({ error: 'Password must be under 128 characters.' });
    return;
  }

  try {
    console.log(`📝 Registering user: ${email}`);
    const { data: existing, error: existingErr } = await supabase
      .from('upsa_users')
      .select('id, is_verified')
      .eq('email', email)
      .single();

    if (existing) {
      console.log(`⚠️ User already exists: ${email} (verified: ${existing.is_verified})`);
      if (existing.is_verified) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      } else {
        console.log(`🗑️ Deleting unverified user: ${existing.id}`);
        await supabase.from('upsa_users').delete().eq('id', existing.id);
      }
    }

    console.log(`🔐 Hashing password...`);
    const password_hash = await bcrypt.hash(password, 12);
    const otp = generateOtp();
    const otp_expires_at = otpExpiry();

    console.log(`💾 Inserting user into DB...`);
    const { data: user, error } = await supabase
      .from('upsa_users')
      .insert({ full_name, email, password_hash, otp, otp_expires_at, is_verified: false })
      .select('id, email')
      .single();

    if (error || !user) {
      console.error('❌ DB Error during registration:', error);
      res.status(500).json({ error: 'Failed to create account. Please try again.', detail: error?.message });
      return;
    }

    console.log(`📧 Sending verification email to ${email}...`);
    try {
      await sendOtpEmail(email, otp, 'verify');
      console.log(`✅ Email sent successfully.`);
    } catch (emailErr: any) {
      console.error('❌ Email Error:', emailErr);
      // Rollback: delete the unverified user from the database since the email failed to send
      await supabase.from('upsa_users').delete().eq('id', user.id);
      res.status(500).json({ error: 'Failed to send verification email. Please check your email address and try again.', detail: emailErr.message });
      return;
    }

    res.status(201).json({ message: 'Account created. Please check your email for the verification code.' });
  } catch (err: any) {
    console.error('❌ Unexpected Registration Error:', err);
    res.status(500).json({ error: 'Internal server error.', detail: err.message });
  }
});


// ─── VERIFY EMAIL ────────────────────────────────────────────
router.post('/verify-email', authLimiter, async (req: Request, res: Response) => {
  const email = sanitizeEmail(req.body.email);
  const otp = sanitizeOtp(req.body.otp);

  if (!email) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }
  if (!otp) {
    res.status(400).json({ error: 'OTP must be a 6-digit code.' });
    return;
  }

  try {
    const { data: user, error } = await supabase
      .from('upsa_users')
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

    // Fetch full user details for login token generation
    const { data: fullUser, error: fullUserError } = await supabase
      .from('upsa_users')
      .select('id, full_name, email, plan, role, avatar_url, session_version')
      .eq('id', user.id)
      .single();

    if (fullUserError || !fullUser) {
      res.status(500).json({ error: 'Failed to complete login setup after verification.' });
      return;
    }

    const newSessionVersion = (fullUser.session_version || 0) + 1;

    await supabase
      .from('upsa_users')
      .update({ is_verified: true, otp: null, otp_expires_at: null, session_version: newSessionVersion })
      .eq('id', user.id);

    const token = jwt.sign(
      { id: fullUser.id, email: fullUser.email, plan: fullUser.plan, role: fullUser.role || 'student', session_version: newSessionVersion },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' } as jwt.SignOptions
    );

    res.status(200).json({
      message: 'Email verified successfully.',
      token,
      user: {
        id: fullUser.id,
        full_name: fullUser.full_name,
        email: fullUser.email,
        plan: fullUser.plan,
        role: fullUser.role || 'student',
        avatar_url: fullUser.avatar_url,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});


// ─── LOGIN ───────────────────────────────────────────────────
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const email = sanitizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }
  if (!password) {
    res.status(400).json({ error: 'Password is required.' });
    return;
  }
  // Hard cap to prevent bcrypt DoS (bcrypt silently truncates at 72 bytes)
  if (password.length > 128) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  try {
    const { data: user, error } = await supabase
      .from('upsa_users')
      .select('id, full_name, email, password_hash, plan, role, is_verified, avatar_url, status, session_version')
      .eq('email', email)
      .single();

    if (error || !user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ error: 'Your account is suspended. Please contact support.' });
      return;
    }

    if (user.status === 'deactivated') {
      res.status(403).json({ error: 'This account has been deactivated.' });
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

    // Increment session_version to invalidate other devices
    const newSessionVersion = (user.session_version || 0) + 1;
    await supabase
      .from('upsa_users')
      .update({ session_version: newSessionVersion })
      .eq('id', user.id);

    const token = jwt.sign(
      { id: user.id, email: user.email, plan: user.plan, role: user.role || 'student', session_version: newSessionVersion },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' } as jwt.SignOptions
    );

    res.status(200).json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        plan: user.plan,
        role: user.role || 'student',
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {

    res.status(500).json({ error: 'Internal server error.' });
  }
});


// ─── FORGOT PASSWORD ─────────────────────────────────────────
router.post('/forgot-password', authLimiter, async (req: Request, res: Response) => {
  const email = sanitizeEmail(req.body.email);

  if (!email) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }

  // Always return the same message — never reveal whether the email exists
  const genericResponse = { message: 'If an account exists, a reset code has been sent.' };

  try {
    const { data: user } = await supabase
      .from('upsa_users')
      .select('id')
      .eq('email', email)
      .single();

    if (!user) {
      res.status(200).json(genericResponse);
      return;
    }

    const otp = generateOtp();
    const otp_expires_at = otpExpiry();

    await supabase
      .from('upsa_users')
      .update({ otp, otp_expires_at })
      .eq('id', user.id);

    await sendOtpEmail(email, otp, 'reset');

    res.status(200).json(genericResponse);
  } catch (err) {

    res.status(500).json({ error: 'Internal server error.' });
  }
});


// ─── RESET PASSWORD ──────────────────────────────────────────
router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  const email = sanitizeEmail(req.body.email);
  const otp = sanitizeOtp(req.body.otp);
  const new_password = typeof req.body.new_password === 'string' ? req.body.new_password : '';

  if (!email) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }
  if (!otp) {
    res.status(400).json({ error: 'OTP must be a 6-digit code.' });
    return;
  }
  if (new_password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }
  if (new_password.length > 128) {
    res.status(400).json({ error: 'Password must be under 128 characters.' });
    return;
  }

  try {
    const { data: user } = await supabase
      .from('upsa_users')
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
      .from('upsa_users')
      .update({ password_hash, otp: null, otp_expires_at: null })
      .eq('id', user.id);

    res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {

    res.status(500).json({ error: 'Internal server error.' });
  }
});


// ─── RESEND OTP ──────────────────────────────────────────────
router.post('/resend-otp', authLimiter, async (req: Request, res: Response) => {
  const email = sanitizeEmail(req.body.email);

  if (!email) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }

  try {
    const { data: user } = await supabase
      .from('upsa_users')
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
      .from('upsa_users')
      .update({ otp, otp_expires_at })
      .eq('id', user.id);

    await sendOtpEmail(email, otp, 'verify');

    res.status(200).json({ message: 'A new verification code has been sent to your email.' });
  } catch (err) {

    res.status(500).json({ error: 'Internal server error.' });
  }
});


// ─── GOOGLE OAUTH LOGIN ─────────────────────────────────────
router.post('/google-login', authLimiter, async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Supabase access token is required.' });
    return;
  }

  try {
    // 1. Verify the token server-side with Supabase — prevents spoofing
    const { data: { user: googleUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !googleUser || !googleUser.email) {
      console.error('❌ Supabase token verification failed:', authError?.message);
      res.status(401).json({ error: 'Invalid or expired Google token. Please try again.' });
      return;
    }

    const email = googleUser.email.toLowerCase().trim();

    if (!isAllowedEmail(email)) {
      res.status(403).json({ 
        error: 'Only personal Gmail accounts (@gmail.com) or staff upsamail emails are allowed. Student upsamail accounts and other third-party providers (Yahoo, Outlook, etc.) are restricted.' 
      });
      return;
    }

    const full_name = sanitizeText(
      googleUser.user_metadata?.full_name ||
      googleUser.user_metadata?.name ||
      email.split('@')[0]
    );
    const avatar_url = googleUser.user_metadata?.avatar_url || googleUser.user_metadata?.picture || null;

    console.log(`🔑 Google OAuth login: ${email}`);

    // 2. Check if user already exists in our table
    const { data: existingUser } = await supabase
      .from('upsa_users')
      .select('id, full_name, email, plan, role, avatar_url, status, session_version, password_hash')
      .eq('email', email)
      .single();

    let dbUser: any;

    if (existingUser) {
      // Check account status
      if (existingUser.status === 'suspended') {
        res.status(403).json({ error: 'Your account is suspended. Please contact support.' });
        return;
      }
      if (existingUser.status === 'deactivated') {
        res.status(403).json({ error: 'This account has been deactivated.' });
        return;
      }

      // Increment session_version to invalidate all other active device sessions
      const newSessionVersion = (existingUser.session_version || 0) + 1;

      // Sync avatar and name from Google if they changed
      await supabase
        .from('upsa_users')
        .update({
          avatar_url: avatar_url || existingUser.avatar_url,
          full_name: existingUser.full_name || full_name,
          is_verified: true,
          session_version: newSessionVersion,
        })
        .eq('id', existingUser.id);

      dbUser = { ...existingUser, session_version: newSessionVersion };
      console.log(`✅ Existing Google user logged in: ${email} (session v${newSessionVersion})`);
    } else {
      // 3. New user — create record in upsa_users
      // password_hash is null for OAuth users (they never set a password)
      const { data: newUser, error: insertError } = await supabase
        .from('upsa_users')
        .insert({
          full_name,
          email,
          password_hash: null,
          avatar_url,
          is_verified: true,
          plan: 'free',
          role: 'student',
          session_version: 1,
        })
        .select('id, full_name, email, plan, role, avatar_url, session_version')
        .single();

      if (insertError || !newUser) {
        console.error('❌ Failed to create Google OAuth user:', insertError?.message);
        res.status(500).json({ error: 'Failed to create account. Please try again.' });
        return;
      }

      dbUser = newUser;
      console.log(`🆕 New Google user registered: ${email}`);
    }

    // 4. Sign our own PastQ JWT with the new session_version
    const jwtToken = jwt.sign(
      {
        id: dbUser.id,
        email: dbUser.email,
        plan: dbUser.plan,
        role: dbUser.role || 'student',
        session_version: dbUser.session_version,
      },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' } as jwt.SignOptions
    );

    res.status(200).json({
      token: jwtToken,
      user: {
        id: dbUser.id,
        full_name: dbUser.full_name,
        email: dbUser.email,
        plan: dbUser.plan,
        role: dbUser.role || 'student',
        avatar_url: dbUser.avatar_url,
      },
    });
  } catch (err: any) {
    console.error('❌ Google OAuth Error:', err);
    res.status(500).json({ error: 'Internal server error during Google login.' });
  }
});

export default router;

