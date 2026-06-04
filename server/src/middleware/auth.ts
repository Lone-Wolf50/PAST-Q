import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase';
import { getCachedSession, setCachedSession } from '../lib/redis';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; plan: string; role: string };
}

/**
 * Middleware to verify JWT from Authorization header.
 * Attaches decoded user payload to req.user.
 */
export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;


  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn(`🔐 Auth failed: No Bearer token provided for ${req.method} ${req.originalUrl}`);
    res.status(401).json({ error: 'Not authorized. No token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET is NOT defined in environment variables!');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      email: string;
      plan: string;
      role: string;
      session_version?: number;
    };

    // Skip DB check for hardcoded admin account
    if (decoded.id === 'admin') {
      req.user = decoded;
      next();
      return;
    }

    // Verify user status in DB / Cache for real-time enforcement
    let user = await getCachedSession(decoded.id);
    let cacheHit = true;

    if (!user) {
      cacheHit = false;
      const { data: dbUser, error } = await supabase
        .from('upsa_users')
        .select('status, session_version, role')
        .eq('id', decoded.id)
        .single();

      if (error || !dbUser) {
        console.warn(`🔐 Auth failed: User account not found for ID ${decoded.id}`);
        res.status(401).json({ error: 'User account not found.' });
        return;
      }

      user = {
        status: dbUser.status || 'active',
        session_version: dbUser.session_version ?? 0,
        role: dbUser.role || 'student',
      };

      // Populate Cache asynchronously
      setCachedSession(decoded.id, user).catch(() => {});
    }

    if (cacheHit) {
      // Optional logging to verify cache hits in dev environment
      // console.log(`⚡ [Redis] Session cache HIT for user: ${decoded.email}`);
    }

    const isAdmin = decoded.id === 'admin' || decoded.role === 'admin' || user.role === 'admin';

    if (!isAdmin) {
      if (decoded.session_version === undefined || user.session_version === undefined || user.session_version === null || String(decoded.session_version) !== String(user.session_version)) {
        console.warn(`🔐 Auth failed: Session version mismatch or missing for user ${decoded.email}. Expected ${user.session_version}, got ${decoded.session_version}`);
        res.status(401).json({ code: 'SESSION_EXPIRED', error: 'Session expired' });
        return;
      }
    }

    if (user.status === 'suspended') {
      res.status(403).json({ error: 'Your account is suspended. Please contact support.' });
      return;
    }

    if (user.status === 'deactivated') {
      res.status(403).json({ error: 'This account has been deactivated.' });
      return;
    }

    req.user = decoded;
    next();
  } catch (err: any) {
    console.error(`🔐 JWT Verification Error for ${req.method} ${req.originalUrl}:`, err.message);
    res.status(401).json({ error: 'Not authorized. Token is invalid or expired.' });
  }
};

/**
 * Middleware to restrict access to admin-only routes.
 */
export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    return;
  }
  next();
};
