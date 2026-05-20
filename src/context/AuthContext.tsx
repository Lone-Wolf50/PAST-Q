import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  plan: string;
  role: string;
  avatar_url?: string;
  plan_expires?: string;
  ai_usage_count?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoggedIn: boolean;
  login: (token: string, user: AuthUser) => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Helper to check if running as installed app/PWA
const isApp = () => {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
};

// Returns the appropriate storage based on environment
const getStorage = () => isApp() ? localStorage : sessionStorage;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    const storage = getStorage();
    
    // If it's an app, enforce the 7-day rolling window
    if (isApp()) {
      const lastVisit = storage.getItem('last_visit');
      if (lastVisit) {
        const timeSince = Date.now() - parseInt(lastVisit, 10);
        if (timeSince > 7 * 24 * 60 * 60 * 1000) {
          // More than 7 days, clear storage
          storage.removeItem('token');
          storage.removeItem('user');
          storage.removeItem('last_visit');
          return null;
        }
      }
      // Update last visit timestamp
      storage.setItem('last_visit', Date.now().toString());
    }

    return storage.getItem('token');
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = getStorage().getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Sync login/logout state across tabs
      if (e.key === 'token') {
        if (!e.newValue) {
          setToken(null);
          setUser(null);
        } else {
          setToken(e.newValue);
          const storedUser = getStorage().getItem('user');
          if (storedUser) setUser(JSON.parse(storedUser));
        }
      }
    };

    const handleSessionExpired = () => {
      logout();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('session_expired', handleSessionExpired);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('session_expired', handleSessionExpired);
    };
  }, []);

  // App-Load Token Validation
  useEffect(() => {
    const currentToken = getStorage().getItem('token');
    if (!currentToken) return;

    fetch(`${import.meta.env.VITE_API_URL || ''}/api/profile/me`, {
      headers: { Authorization: `Bearer ${currentToken}` }
    })
      .then(res => {
        if (res.status === 401) {
          logout();
        }
      })
      .catch(() => {}); // Ignore network errors
  }, []);

  // Ping streak once per browser session when user is logged in
  useEffect(() => {
    if (!token) return;
    // Only ping once per browser session (not on every re-render)
    if (sessionStorage.getItem('streak_pinged')) return;
    sessionStorage.setItem('streak_pinged', '1');

    fetch(`${import.meta.env.VITE_API_URL || ''}/api/streaks/ping`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.streak !== undefined) {
          sessionStorage.setItem('streak_count', String(data.streak));
        }
      })
      .catch(() => {}); // Never crash the app over streak
  }, [token]);

  const login = (newToken: string, newUser: AuthUser) => {
    const storage = getStorage();
    storage.setItem('token', newToken);
    storage.setItem('user', JSON.stringify(newUser));
    
    if (isApp()) {
      storage.setItem('last_visit', Date.now().toString());
    }
    
    // The 'token' storage event will automatically sync the login to other tabs
    
    setToken(newToken);
    setUser(newUser);
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    getStorage().setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const logout = () => {
    const storage = getStorage();
    storage.removeItem('token');
    storage.removeItem('user');
    storage.removeItem('last_visit');
    
    // Optional: Also clear the other storage just in case they switch contexts
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('dismissed_banner');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('dismissed_banner');

    // Clear all AI chat related storage keys to prevent cross-account leakage
    localStorage.removeItem('pastq_ai_messages');
    localStorage.removeItem('pastq_ai_active_conv');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('pastq_paper_conv_')) {
        localStorage.removeItem(key);
      }
    });
    
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoggedIn: !!token && !!user, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
