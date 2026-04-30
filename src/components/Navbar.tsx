import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, BookOpen, Sparkles, Search, User, Lock, Tag, BrainCircuit, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { clsx } from 'clsx';
import { Fragment, useState } from 'react';

const Navbar = () => {
  const location = useLocation();
  // Mock authentication state - set to true to see the full dashboard navbar
  const [isLoggedIn] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const desktopNavLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Papers', path: '/papers', icon: FileText },
    { name: 'Journal', path: '/journal', icon: BookOpen },
  ];

  const mobileNavLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Papers', path: '/papers', icon: FileText },
    { name: 'Pricing', path: '/pricing', icon: Tag },
    { name: 'Account', path: '/profile', icon: User },
  ];

  return (
    <Fragment>
      {/* Top Navbar */}
      <nav className="w-full flex items-center justify-between px-4 md:px-8 py-4 md:py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-theme-surface-2 border border-theme-border group-hover:border-indigo-400/50 transition-colors">
              <Lock className="w-4 h-4 text-emerald-400" />
              <div className="absolute inset-0 bg-emerald-400/20 blur-md rounded-lg -z-10" />
            </div>
            <span className="text-xl font-bold tracking-tight text-theme-primary">Past<span className="text-indigo-400">Q</span></span>
          </Link>

          {isLoggedIn && (
            <div className="hidden md:flex items-center gap-1">
              {desktopNavLinks.map((link) => {
                const isActive = location.pathname === link.path;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                      isActive 
                        ? "text-theme-primary bg-theme-surface-2" 
                        : "text-theme-muted hover:text-theme-primary hover:bg-theme-surface"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {link.name}
                  </Link>
                );
              })}
              
              <Link
                to="/ask-ai"
                className="flex items-center gap-2 px-5 py-2 ml-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]"
              >
                <Sparkles className="w-4 h-4" />
                Ask AI
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <button onClick={toggleTheme} className="flex items-center justify-center w-10 h-10 rounded-full bg-theme-surface border border-theme-border hover:bg-theme-surface-2 transition-colors text-theme-secondary hover:text-theme-primary">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button className="flex items-center justify-center w-10 h-10 rounded-full bg-theme-surface border border-theme-border hover:bg-theme-surface-2 transition-colors text-theme-secondary hover:text-theme-primary">
                <Search className="w-5 h-5" />
              </button>
              <button className="hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-theme-surface border border-theme-border hover:bg-theme-surface-2 transition-colors text-theme-secondary hover:text-theme-primary">
                <User className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 md:gap-4">
              <button onClick={toggleTheme} className="flex items-center justify-center w-10 h-10 rounded-full text-theme-secondary hover:text-theme-primary hover:bg-theme-surface transition-colors">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <Link 
                to="/login" 
                className="px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors"
              >
                Log in
              </Link>
              <Link 
                to="/register" 
                className="px-4 py-2 rounded-full text-sm font-medium text-theme-primary bg-theme-surface-2 hover:bg-theme-surface-2 border border-theme-border transition-colors"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Navigation - Only show if logged in */}
      {isLoggedIn && (
        <div className="md:hidden fixed bottom-0 left-0 w-full z-50 px-4 pb-4 pt-6 pointer-events-none">
          <div className="glass-card flex items-center justify-between px-2 sm:px-6 py-2 relative shadow-2xl bg-theme-surface/95 backdrop-blur-xl border-theme-border pointer-events-auto">
            {/* Ask AI Center Button */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-6 flex flex-col items-center">
              <div className="bg-transparent p-1.5 rounded-full mb-1">
                <Link 
                  to="/ask-ai"
                  className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-[0_0_20px_rgba(99,102,241,0.5)] hover:scale-105 transition-transform"
                >
                  <BrainCircuit className="w-7 h-7 text-theme-primary" />
                </Link>
              </div>
              <span className="text-[10px] font-medium text-indigo-300">Ask AI</span>
            </div>

            <div className="flex items-center justify-between w-full">
              {/* Left side items */}
              <div className="flex items-center justify-around w-[40%]">
                {mobileNavLinks.slice(0, 2).map((link) => {
                  const isActive = location.pathname === link.path;
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.name}
                      to={link.path}
                      className={clsx(
                        "flex flex-col items-center gap-1 p-2 transition-colors",
                        isActive ? "text-indigo-400" : "text-theme-muted hover:text-theme-secondary"
                      )}
                    >
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-[10px] font-medium">{link.name}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Spacer for center button */}
              <div className="w-[20%]"></div>

              {/* Right side items */}
              <div className="flex items-center justify-around w-[40%]">
                {mobileNavLinks.slice(2, 4).map((link) => {
                  const isActive = location.pathname === link.path;
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.name}
                      to={link.path}
                      className={clsx(
                        "flex flex-col items-center gap-1 p-2 transition-colors",
                        isActive ? "text-indigo-400" : "text-theme-muted hover:text-theme-secondary"
                      )}
                    >
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-[10px] font-medium">{link.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </Fragment>
  );
};

export default Navbar;


