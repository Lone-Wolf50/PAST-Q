import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, Sparkles, User, Tag, BrainCircuit } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';
import { Fragment } from 'react';
import { ThemeToggle } from './ui/ThemeToggle';

const Navbar = () => {
  const location = useLocation();
  const { isLoggedIn, user } = useAuth();

  const desktopNavLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Papers', path: '/papers', icon: FileText },
    { name: 'Pricing', path: '/pricing', icon: Tag },
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
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden border border-indigo-400/30 group-hover:border-indigo-300 transition-all duration-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] bg-theme-surface">
              <img src="/pwa-icon-512.png" alt="PastQ Logo" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-xl -z-10 group-hover:bg-indigo-500/50 transition-all" />
            </div>
            <span className="text-xl font-bold tracking-tight text-theme-primary">Past<span className="text-indigo-400">Q</span></span>
          </Link>

          {isLoggedIn && (
            <ul className="hidden md:flex items-center gap-6 desktop-cool-nav ml-6">
              {desktopNavLinks.map((link) => {
                const isActive = location.pathname === link.path;
                const Icon = link.icon;

                let iColor = '#a955ff';
                let jColor = '#ea51ff';
                if (link.name === 'Papers') {
                  iColor = '#56CCF2';
                  jColor = '#2F80ED';
                } else if (link.name === 'Pricing') {
                  iColor = '#FF9966';
                  jColor = '#FF5E62';
                }

                return (
                  <li
                    key={link.name}
                    style={{ '--i': iColor, '--j': jColor } as React.CSSProperties}
                    className={clsx(
                      'nav-item',
                      isActive && 'active-item'
                    )}
                  >
                    <Link to={link.path} className="w-full h-full flex justify-center items-center">
                      <span className="icon-wrapper">
                        <Icon className={clsx("w-6 h-6", isActive ? "text-indigo-400" : "text-theme-secondary")} />
                      </span>
                      <span className="title">{link.name}</span>
                    </Link>
                  </li>
                );
              })}

              {/* Ask AI */}
              <li
                style={{ '--i': '#a855f7', '--j': '#7EE8FA' } as React.CSSProperties}
                className={clsx(
                  'nav-item',
                  location.pathname === '/ask-ai' && 'active-item'
                )}
              >
                <Link to="/ask-ai" className="w-full h-full flex justify-center items-center">
                  <span className="icon-wrapper">
                    <BrainCircuit className={clsx("w-6 h-6", location.pathname === '/ask-ai' ? "text-indigo-400" : "text-theme-secondary")} />
                  </span>
                  <span className="title">Cortana</span>
                </Link>
              </li>
            </ul>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <ThemeToggle />
              <Link
                to="/profile"
                className="hidden md:flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-theme-surface border border-theme-border hover:bg-theme-surface-2 transition-colors"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-theme-surface-2 flex items-center justify-center border border-theme-border">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-theme-secondary" />
                  )}
                </div>
                <span className="text-sm font-medium text-theme-primary max-w-[100px] truncate">
                  {user?.full_name || 'Account'}
                </span>
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden md:block"><ThemeToggle /></div>
              <Link to="/login" className="hidden md:block px-4 py-2 text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors">
                Log in
              </Link>
              <Link to="/register" className="hidden md:flex px-4 py-2 rounded-full text-sm font-medium text-theme-primary bg-theme-surface-2 hover:bg-theme-surface-2 border border-theme-border transition-colors">
                Register
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Navigation — fixed, stays in place while page scrolls */}
      {isLoggedIn && (
        <div className="md:hidden fixed bottom-0 left-0 w-full z-50 px-3 pb-4 pt-2">
          <div className="relative flex items-center justify-between px-2 py-2 rounded-2xl glass-nav-mobile">
            {/* Left two links */}
            <div className="flex items-center justify-around w-[38%]">
              {mobileNavLinks.slice(0, 2).map((link) => {
                const isActive = location.pathname === link.path;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={clsx(
                      'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all',
                      isActive
                        ? 'text-indigo-400'
                        : 'text-theme-muted hover:text-theme-secondary'
                    )}
                  >
                    <Icon className={clsx('w-5 h-5', isActive && 'drop-shadow-[0_0_6px_rgba(99,102,241,0.7)]')} />
                    <span className={clsx('text-[10px] font-semibold', isActive && 'text-indigo-300')}>{link.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Centre — Ask AI button */}
            <div className="flex flex-col items-center gap-0.5">
              <Link
                to="/ask-ai"
                className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 hover:scale-105 active:scale-95 transition-transform"
                style={{
                  boxShadow: '0 0 0 2px rgba(139,92,246,0.4), 0 0 20px rgba(99,102,241,0.6), 0 0 40px rgba(99,102,241,0.3)'
                }}
              >
                {/* pulsing halo */}
                <span
                  className="absolute inset-0 rounded-full animate-ping opacity-20"
                  style={{ background: 'radial-gradient(circle, #a855f7, #6366f1)' }}
                />
                <BrainCircuit className="w-7 h-7 text-white relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
              </Link>
              <span
                className="text-[10px] font-bold"
                style={{ color: '#c4b5fd', textShadow: '0 0 8px rgba(139,92,246,0.8)' }}
              >
                Cortana
              </span>
            </div>

            {/* Right two links */}
            <div className="flex items-center justify-around w-[38%]">
              {mobileNavLinks.slice(2, 4).map((link) => {
                const isActive = location.pathname === link.path;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={clsx(
                      'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all',
                      isActive
                        ? 'text-indigo-400'
                        : 'text-theme-muted hover:text-theme-secondary'
                    )}
                  >
                    {link.name === 'Account' && user?.avatar_url ? (
                      <div className={clsx(
                        "w-5 h-5 rounded-full overflow-hidden border",
                        isActive ? "border-indigo-400" : "border-theme-border"
                      )}>
                        <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <Icon className={clsx('w-5 h-5', isActive && 'drop-shadow-[0_0_6px_rgba(99,102,241,0.7)]')} />
                    )}
                    <span className={clsx('text-[10px] font-semibold', isActive && 'text-indigo-300')}>{link.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Fragment>
  );
};

export default Navbar;
