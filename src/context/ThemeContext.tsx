import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const isAdminPath = window.location.pathname.startsWith('/hq-portal');
  const storageKey = isAdminPath ? 'pastq-admin-theme' : 'pastq-theme';

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem(storageKey) as Theme) || 'dark';
  });
  const isFirstRender = useRef(true);

  // Re-sync theme when path changes (for SPA navigation)
  useEffect(() => {
    const checkPath = () => {
      const currentIsAdmin = window.location.pathname.startsWith('/hq-portal');
      const currentKey = currentIsAdmin ? 'pastq-admin-theme' : 'pastq-theme';
      const savedTheme = (localStorage.getItem(currentKey) as Theme) || 'dark';
      setTheme(savedTheme);
    };

    // We can't use useLocation here because ThemeProvider is usually above the Router,
    // so we listen for popstate or set up an interval to check path changes.
    window.addEventListener('popstate', checkPath);
    
    // Also intercept pushState to detect internal navigation
    const originalPushState = window.history.pushState;
    window.history.pushState = function() {
      originalPushState.apply(this, arguments as any);
      checkPath();
    };

    return () => {
      window.removeEventListener('popstate', checkPath);
      window.history.pushState = originalPushState;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    // Use rAF so the browser has committed the current frame before we add
    // the transitioning class. This gives the GPU a chance to promote layers
    // before the property changes start, eliminating the first-frame stutter.
    let rafId: number;
    let timeout: ReturnType<typeof setTimeout>;

    if (!isFirstRender.current) {
      rafId = requestAnimationFrame(() => {
        root.classList.add('theme-transitioning');
      });
    } else {
      isFirstRender.current = false;
    }

    if (theme === 'light') {
      root.classList.add('light');
      root.style.colorScheme = 'light';
    } else {
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    }
    
    const currentIsAdmin = window.location.pathname.startsWith('/hq-portal');
    const currentKey = currentIsAdmin ? 'pastq-admin-theme' : 'pastq-theme';
    localStorage.setItem(currentKey, theme);

    // Remove transitioning class after transition finishes (slightly > 300ms)
    timeout = setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 350);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeout);
    };
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
