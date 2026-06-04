import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';

const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const BASE_URL = VITE_API_URL.endsWith('/api') ? VITE_API_URL : `${VITE_API_URL.replace(/\/$/, '')}/api`;

interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  plan: string;
  role: string;
  avatar_url?: string;
  plan_expires?: string;
  ai_usage_count?: number;
  pdf_downloads_count?: number;
  pdf_views_count?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoggedIn: boolean;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Helper to check if running as installed app/PWA
const isApp = () => {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync token refreshes and sessions across tabs via events
  useEffect(() => {
    const handleTokenRefreshed = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setToken(customEvent.detail.token);
        setUser(customEvent.detail.user);
      }
    };

    const handleSessionExpired = () => {
      logout();
    };

    window.addEventListener('token_refreshed', handleTokenRefreshed);
    window.addEventListener('session_expired', handleSessionExpired);
    
    return () => {
      window.removeEventListener('token_refreshed', handleTokenRefreshed);
      window.removeEventListener('session_expired', handleSessionExpired);
    };
  }, []);

  // App-Load Token Validation (Silent Refresh on mount)
  useEffect(() => {
    const initAuth = async () => {
      const storage = localStorage;
      if (isApp()) {
        const lastVisit = storage.getItem('last_visit');
        if (lastVisit) {
          const timeSince = Date.now() - parseInt(lastVisit, 10);
          if (timeSince > 7 * 24 * 60 * 60 * 1000) {
            // More than 7 days, clear session and storage
            try {
              await fetch(`${BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
            } catch {}
            storage.removeItem('last_visit');
            setLoading(false);
            return;
          }
        }
        storage.setItem('last_visit', Date.now().toString());
      }

      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.token && data.user) {
            setToken(data.token);
            setUser(data.user);
          }
        }
      } catch (err) {
        console.error('Silent refresh failed on startup:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Ping streak once per browser session when user is logged in
  useEffect(() => {
    if (!token) return;
    if (sessionStorage.getItem('streak_pinged')) return;
    sessionStorage.setItem('streak_pinged', '1');

    fetch(`${BASE_URL}/streaks/ping`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.streak !== undefined) {
          sessionStorage.setItem('streak_count', String(data.streak));
        }
      })
      .catch(() => {});
  }, [token]);

  const login = (newToken: string, newUser: AuthUser) => {
    const storage = localStorage;
    sessionStorage.removeItem('streak_pinged');
    sessionStorage.removeItem('streak_count');

    if (isApp()) {
      storage.setItem('last_visit', Date.now().toString());
    }
    
    setToken(newToken);
    setUser(newUser);
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    if (!user) return;
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const logout = async () => {
    // Clear student local storage / session storage
    sessionStorage.clear();
    localStorage.removeItem('dismissed_banner');
    
    // Clear AI chat related storage keys
    localStorage.removeItem('pastq_ai_messages');
    localStorage.removeItem('pastq_ai_active_conv');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('pastq_paper_conv_')) {
        localStorage.removeItem(key);
      }
    });

    // Clear Supabase session (OAuth)
    supabase.auth.signOut().catch(() => {});
    
    setToken(null);
    setUser(null);

    // Call server endpoint to remove httpOnly cookie
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout request failed:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoggedIn: !!token && !!user, loading, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
