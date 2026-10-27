import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';

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

  // Re-sync theme when path changes (for SPA navigation)
  useEffect(() => {
    const checkPath = () => {
      const currentIsAdmin = window.location.pathname.startsWith('/hq-portal');
      const currentKey = currentIsAdmin ? 'pastq-admin-theme' : 'pastq-theme';
      const savedTheme = (localStorage.getItem(currentKey) as Theme) || 'dark';
      setTheme(savedTheme);
    };

    window.addEventListener('popstate', checkPath);
    
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

  // Apply theme synchronously before paint for an instant, zero-delay switch
  useLayoutEffect(() => {
    const root = document.documentElement;

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
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
