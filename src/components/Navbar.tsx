import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, User, Tag, BrainCircuit, HelpCircle, Trophy, Bell, FolderDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { clsx } from 'clsx';
import { Fragment, useState, useEffect } from 'react';
import { ThemeToggle } from './ui/ThemeToggle';
import { apiFetch } from '../lib/api';

const Navbar = () => {
  const location = useLocation();
  const { isLoggedIn, user, token } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!token) return;
    try {
      const res = await apiFetch('/profile/notifications', { token });
      if (res.notifications) {
        const unread = res.notifications.filter((n: any) => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    if (token) {
      fetchUnreadCount();
    } else {
      setUnreadCount(0);
    }

    const handleUpdate = () => {
      fetchUnreadCount();
    };

    window.addEventListener('notifications_updated', handleUpdate);
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => {
      window.removeEventListener('notifications_updated', handleUpdate);
      clearInterval(interval);
    };
  }, [token]);

  const desktopNavLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Papers', path: '/papers', icon: FileText },
    { name: 'Downloads', path: '/downloads', icon: FolderDown },
    { name: 'Quiz', path: '/quiz', icon: HelpCircle },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
    { name: 'Pricing', path: '/pricing', icon: Tag },
  ];

  const mobileNavLinks = [
    { name: 'Papers', path: '/papers', icon: FileText },
    { name: 'Downloads', path: '/downloads', icon: FolderDown },
    { name: 'Quiz', path: '/quiz', icon: HelpCircle },
    { name: 'Account', path: '/profile', icon: User },
  ];

  // Shared ThemeToggle-style classes for shells and inner thumbs
  const shellClass = isDark
    ? "bg-theme-surface/50 border-theme-border/50"
    : "bg-blue-100/50 border-white/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]";

  const thumbClass = isDark
    ? "bg-theme-surface-2/80 shadow-md border border-white/5"
    : "bg-white/60 shadow-sm border border-white/80";

  const activeThumbClass = isDark
    ? "bg-indigo-500/25 shadow-[0_0_12px_rgba(165,180,252,0.25)] border border-indigo-400/40"
    : "bg-white/90 shadow-[0_2px_8px_rgba(115,176,244,0.28)] border border-white";

  return (
    <Fragment>
      {/* Top Navbar — ThemeToggle glass style across Mobile, Tablet, and PC */}
      <div className="sticky top-0 z-50 w-full px-3 md:px-6 pt-2.5 pb-1.5">
        <nav
          className={clsx(
            "w-full flex items-center justify-between px-3.5 md:px-6 py-2.5 md:py-3 max-w-7xl mx-auto rounded-full transition-all duration-300",
            shellClass
          )}
          style={{
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderWidth: '1px',
          }}
        >
          <div className="flex items-center gap-4 lg:gap-8">
            {/* Logo inside a ThemeToggle-style capsule */}
            <Link
              to="/"
              className={clsx(
                "flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-all duration-300 group",
                thumbClass
              )}
            >
              <div className="relative flex items-center justify-center w-7 h-7 rounded-full overflow-hidden border border-indigo-400/30 group-hover:border-indigo-300 transition-all duration-500 shadow-[0_0_12px_rgba(165,180,252,0.35)] bg-theme-surface">
                <img src="/pwa-icon-512.png" alt="PastQ Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-base md:text-lg font-bold tracking-tight text-theme-primary">
                Past<span className={isDark ? "text-[#a5b4fc]" : "text-[#73b0f4]"}>Q</span>
              </span>
            </Link>

            {/* PC & Tablet Navigation Icons — ThemeToggle style */}
            {isLoggedIn && (
              <ul className="hidden md:flex items-center desktop-cool-nav">
                {desktopNavLinks.map((link) => {
                  const isActive = location.pathname === link.path;
                  const Icon = link.icon;

                  return (
                    <li
                      key={link.name}
                      className={clsx(
                        'nav-item',
                        isActive && 'active-item'
                      )}
                    >
                      <Link to={link.path} className="w-full h-full flex justify-center items-center">
                        <span className="icon-wrapper">
                          <Icon
                            className={clsx(
                              "w-4 h-4 transition-colors duration-300",
                              isActive
                                ? (isDark ? "text-[#a5b4fc]" : "text-[#5b9bd5]")
                                : (isDark ? "text-indigo-200/75" : "text-slate-600")
                            )}
                          />
                        </span>
                        <span className="title">{link.name}</span>
                      </Link>
                    </li>
                  );
                })}

                {/* Ask AI (Cortana) on PC & Tablet */}
                <li
                  className={clsx(
                    'nav-item',
                    location.pathname === '/ask-ai' && 'active-item'
                  )}
                >
                  <Link to="/ask-ai" className="w-full h-full flex justify-center items-center">
                    <span className="icon-wrapper">
                      <BrainCircuit
                        className={clsx(
                          "w-4 h-4 transition-colors duration-300",
                          location.pathname === '/ask-ai'
                            ? (isDark ? "text-[#a5b4fc]" : "text-[#5b9bd5]")
                            : (isDark ? "text-amber-400/90" : "text-indigo-500")
                        )}
                      />
                    </span>
                    <span className="title">Cortana</span>
                  </Link>
                </li>
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-2.5">
            <ThemeToggle />

            {isLoggedIn ? (
              <>
                {/* Notification Icon — Styled identically to ThemeToggle */}
                <Link
                  to="/notifications"
                  className={clsx(
                    "relative flex items-center justify-center w-11 h-8 rounded-full p-1 transition-all duration-300 hover:scale-105 active:scale-95",
                    shellClass
                  )}
                  style={{
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderWidth: '1px',
                  }}
                  title="Notifications"
                >
                  <div
                    className={clsx(
                      "flex items-center justify-center w-full h-6 rounded-full transition-all duration-300",
                      location.pathname === '/notifications' ? activeThumbClass : thumbClass
                    )}
                  >
                    <Bell
                      className={clsx(
                        "w-3.5 h-3.5 transition-colors duration-300",
                        location.pathname === '/notifications'
                          ? (isDark ? "text-[#a5b4fc]" : "text-[#5b9bd5]")
                          : (isDark ? "text-indigo-200" : "text-slate-600")
                      )}
                    />
                  </div>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-[9px] font-black text-white rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse z-20">
                      {unreadCount}
                    </span>
                  )}
                </Link>

                {/* Profile Button (PC & Tablet) — Styled like ThemeToggle */}
                <Link
                  to="/profile"
                  className={clsx(
                    "hidden md:flex items-center h-8 rounded-full p-1 transition-all duration-300 hover:scale-[1.02]",
                    shellClass
                  )}
                  style={{
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderWidth: '1px',
                  }}
                >
                  <div
                    className={clsx(
                      "flex items-center gap-2 h-6 pl-1 pr-2.5 rounded-full transition-all duration-300",
                      location.pathname === '/profile' ? activeThumbClass : thumbClass
                    )}
                  >
                    <div className="w-4 h-4 rounded-full overflow-hidden bg-theme-surface flex items-center justify-center border border-theme-border shrink-0">
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className={clsx("w-3 h-3", isDark ? "text-indigo-200" : "text-slate-600")} />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-theme-primary max-w-[90px] truncate">
                      {user?.full_name || 'Account'}
                    </span>
                  </div>
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className={clsx(
                    "flex items-center h-8 rounded-full p-1 transition-all duration-300 hover:scale-105",
                    shellClass
                  )}
                  style={{
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderWidth: '1px',
                  }}
                >
                  <span className={clsx("flex items-center h-6 px-3 rounded-full text-xs font-semibold text-theme-primary", thumbClass)}>
                    Log in
                  </span>
                </Link>
                <Link
                  to="/register"
                  className={clsx(
                    "hidden sm:flex items-center h-8 rounded-full p-1 transition-all duration-300 hover:scale-105",
                    shellClass
                  )}
                  style={{
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderWidth: '1px',
                  }}
                >
                  <span className={clsx("flex items-center h-6 px-3 rounded-full text-xs font-bold", activeThumbClass, isDark ? "text-[#a5b4fc]" : "text-[#4a89dc]")}>
                    Register
                  </span>
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Down (Bottom) Navigation — ThemeToggle glass shell & icon thumbs */}
      {isLoggedIn && (
        <div className="md:hidden fixed bottom-0 left-0 w-full z-50 px-3 pb-3.5 pt-2 pointer-events-none">
          <div
            className={clsx(
              "pointer-events-auto relative flex items-center justify-between px-2.5 py-2 rounded-full transition-all duration-300",
              shellClass
            )}
            style={{
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderWidth: '1px',
            }}
          >
            {/* Left two links */}
            <div className="flex items-center justify-around w-[40%] min-w-0 gap-1">
              {mobileNavLinks.slice(0, 2).map((link) => {
                const isActive = location.pathname === link.path;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className="flex flex-col items-center gap-0.5 min-w-0 group"
                  >
                    {/* ThemeToggle-style icon pill */}
                    <div
                      className={clsx(
                        "relative flex items-center justify-center w-12 h-7 rounded-full p-1 transition-all duration-300",
                        shellClass
                      )}
                      style={{ borderWidth: '1px' }}
                    >
                      <div
                        className={clsx(
                          "flex items-center justify-center w-full h-5 rounded-full transition-all duration-300",
                          isActive ? activeThumbClass : thumbClass
                        )}
                      >
                        <Icon
                          className={clsx(
                            "w-3.5 h-3.5 shrink-0 transition-colors duration-300",
                            isActive
                              ? (isDark ? "text-[#a5b4fc]" : "text-[#5b9bd5]")
                              : (isDark ? "text-indigo-200/75" : "text-slate-600")
                          )}
                        />
                      </div>
                    </div>
                    <span
                      className={clsx(
                        "text-[9px] min-[360px]:text-[10px] font-semibold tracking-tight whitespace-nowrap transition-colors",
                        isActive
                          ? (isDark ? "text-[#a5b4fc]" : "text-[#4a89dc]")
                          : "text-theme-secondary"
                      )}
                    >
                      {link.name}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Centre — Ask AI (Cortana) button in ThemeToggle glass style */}
            <div className="flex flex-col items-center gap-0.5 shrink-0 -mt-3">
              <Link
                to="/ask-ai"
                className={clsx(
                  "relative flex items-center justify-center w-14 h-10 rounded-full p-1 transition-all duration-300 hover:scale-105 active:scale-95",
                  shellClass
                )}
                style={{
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderWidth: '1px',
                }}
              >
                <div
                  className={clsx(
                    "flex items-center justify-center w-full h-full rounded-full transition-all duration-300",
                    location.pathname === '/ask-ai' ? activeThumbClass : thumbClass
                  )}
                >
                  <BrainCircuit
                    className={clsx(
                      "w-5 h-5 relative z-10 transition-colors duration-300",
                      location.pathname === '/ask-ai'
                        ? (isDark ? "text-[#a5b4fc]" : "text-[#5b9bd5]")
                        : (isDark ? "text-amber-400" : "text-indigo-500")
                    )}
                  />
                </div>
              </Link>
              <span
                className={clsx(
                  "text-[9px] min-[360px]:text-[10px] font-bold tracking-tight whitespace-nowrap",
                  isDark ? "text-[#c9d1ff]" : "text-[#4a89dc]"
                )}
              >
                Cortana
              </span>
            </div>

            {/* Right two links */}
            <div className="flex items-center justify-around w-[40%] min-w-0 gap-1">
              {mobileNavLinks.slice(2, 4).map((link) => {
                const isActive = location.pathname === link.path;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className="flex flex-col items-center gap-0.5 min-w-0 group"
                  >
                    {/* ThemeToggle-style icon pill */}
                    <div
                      className={clsx(
                        "relative flex items-center justify-center w-12 h-7 rounded-full p-1 transition-all duration-300",
                        shellClass
                      )}
                      style={{ borderWidth: '1px' }}
                    >
                      <div
                        className={clsx(
                          "flex items-center justify-center w-full h-5 rounded-full transition-all duration-300",
                          isActive ? activeThumbClass : thumbClass
                        )}
                      >
                        {link.name === 'Account' && user?.avatar_url ? (
                          <div className="w-4 h-4 rounded-full overflow-hidden border border-theme-border relative shrink-0">
                            <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <Icon
                            className={clsx(
                              "w-3.5 h-3.5 shrink-0 transition-colors duration-300",
                              isActive
                                ? (isDark ? "text-[#a5b4fc]" : "text-[#5b9bd5]")
                                : (isDark ? "text-indigo-200/75" : "text-slate-600")
                            )}
                          />
                        )}
                      </div>
                      {link.name === 'Account' && unreadCount > 0 && (
                        <span className="absolute -top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full border border-theme-surface animate-pulse" />
                      )}
                    </div>
                    <span
                      className={clsx(
                        "text-[9px] min-[360px]:text-[10px] font-semibold tracking-tight whitespace-nowrap transition-colors",
                        isActive
                          ? (isDark ? "text-[#a5b4fc]" : "text-[#4a89dc]")
                          : "text-theme-secondary"
                      )}
                    >
                      {link.name}
                    </span>
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