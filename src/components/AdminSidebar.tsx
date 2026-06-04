import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, BookOpen, FileText, Users, CreditCard, 
  LogOut, X, Shield, ChevronRight, Bell, Shuffle, Mail
} from 'lucide-react';
import { clsx } from 'clsx';

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

const AdminSidebar = ({ open, onClose }: AdminSidebarProps) => {
  const location = useLocation();

  const menuItems = [
    { name: 'Dashboard', path: '/hq-portal', icon: LayoutDashboard },
    { name: 'Subjects', path: '/hq-portal/subjects', icon: BookOpen },
    { name: 'Papers', path: '/hq-portal/papers', icon: FileText },
    { name: 'Users', path: '/hq-portal/users', icon: Users },
    { name: 'Payments', path: '/hq-portal/payments', icon: CreditCard },
    { name: 'Notifications', path: '/hq-portal/notifications', icon: Bell },
    { name: 'Fallback Monitor', path: '/hq-portal/fallbacks', icon: Shuffle },
    { name: 'Broadcast', path: '/hq-portal/broadcast', icon: Mail },
  ];

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    window.location.href = '/hq-portal/login';
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity" 
          onClick={onClose}
        />
      )}

      <aside className={clsx(
        "fixed top-0 left-0 bottom-0 w-64 bg-theme-base/80 backdrop-blur-2xl border-r border-theme-border z-50 transition-transform duration-300 lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <div className="flex items-center justify-between mb-10 px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center relative overflow-hidden group">
                <Shield className="w-5 h-5 text-indigo-400 relative z-10" />
                <div className="absolute inset-0 bg-indigo-400/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-theme-primary">Past<span className="text-indigo-400">Q</span></span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-theme-muted">Admin Portal</span>
              </div>
            </div>
            <button onClick={onClose} className="lg:hidden p-2 text-theme-muted hover:text-theme-primary">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1.5">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={onClose}
                  className={clsx(
                    "group flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300",
                    isActive 
                      ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.1)]" 
                      : "text-theme-muted hover:text-theme-secondary hover:bg-theme-surface"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={clsx("w-5 h-5 transition-transform duration-300", isActive && "scale-110")} />
                    <span className={clsx("font-semibold text-sm", isActive && "text-indigo-300")}>{item.name}</span>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 animate-pulse" />}
                </Link>
              );
            })}
          </nav>

          {/* Footer Actions */}
          <div className="mt-auto pt-6 border-t border-theme-border space-y-2">

            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-semibold text-sm">Log Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
