import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  FileText, 
  Users, 
  CreditCard, 
  Bell, 
  LogOut,
  Lock,
  X,
  ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

const AdminSidebar = ({ open, onClose }: AdminSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const links = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Subjects', path: '/admin/subjects', icon: BookOpen },
    { name: 'Papers', path: '/admin/papers', icon: FileText },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Payments', path: '/admin/payments', icon: CreditCard },
    { name: 'Notifications', path: '/admin/notifications', icon: Bell },
  ];

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  return (
    <>
      {/* Mobile Overlay */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        "fixed top-0 left-0 h-full w-64 bg-theme-surface border-r border-theme-border flex flex-col z-40 transition-transform duration-300 ease-in-out",
        "lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="p-5 border-b border-theme-border flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2" onClick={onClose}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-theme-surface-2 border border-theme-border">
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-theme-primary">Past<span className="text-indigo-400">Q</span></span>
              <div className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider leading-none">Admin Panel</div>
            </div>
          </Link>
          <button 
            onClick={onClose} 
            className="lg:hidden p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-grow py-4 px-3 flex flex-col gap-1 overflow-y-auto">
          <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2 px-3">Main Menu</div>
          {links.map((link) => {
            const isActive = link.path === '/admin' 
              ? location.pathname === '/admin' 
              : location.pathname.startsWith(link.path);
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={onClose}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                  isActive 
                    ? "text-white bg-indigo-500/20 border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.1)]" 
                    : "text-theme-muted hover:text-white hover:bg-theme-surface border border-transparent"
                )}
              >
                <Icon className={clsx("w-4 h-4 shrink-0", isActive ? "text-indigo-400" : "text-theme-muted group-hover:text-theme-secondary")} />
                <span className="flex-grow">{link.name}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-theme-border space-y-2">
          <Link 
            to="/"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-theme-surface text-theme-muted hover:text-theme-secondary transition-colors text-sm"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span>Back to Site</span>
          </Link>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-500/10 text-theme-muted hover:text-red-400 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
