import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, BookOpen, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
const timeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
};

const StudentNotificationsPage = () => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/profile/notifications', { token: token! });
      setNotifications(res.notifications || []);
    } catch (err) {

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchNotifications();
  }, [token]);

  const markAllAsRead = async () => {
    try {
      await apiFetch('/profile/notifications/read-all', { method: 'PATCH', token: token! });
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {

    }
  };

  const markAsRead = async (id: string) => {
    try {
      await apiFetch(`/profile/notifications/${id}/read`, { method: 'PATCH', token: token! });
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {

    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'ai': return Sparkles;
      case 'paper': return BookOpen;
      case 'success': return CheckCircle2;
      default: return AlertCircle;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'ai': return 'text-purple-400';
      case 'paper': return 'text-indigo-400';
      case 'success': return 'text-emerald-400';
      default: return 'text-amber-400';
    }
  };

  const getBg = (type: string) => {
    switch (type) {
      case 'ai': return 'bg-purple-500/10';
      case 'paper': return 'bg-indigo-500/10';
      case 'success': return 'bg-emerald-500/10';
      default: return 'bg-amber-500/10';
    }
  };

  return (
    <div className="w-full flex-grow flex flex-col items-center px-4 md:px-8 max-w-4xl mx-auto py-12">
      <div className="w-full mb-6">
        <Link to="/profile" className="flex items-center gap-2 text-sm text-theme-muted hover:text-theme-primary transition-colors w-fit mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Profile
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-theme-primary mb-2">Notifications</h1>
            <p className="text-theme-muted">Stay updated with your account and new features.</p>
          </div>
          {notifications.some(n => !n.is_read) && (
            <button onClick={markAllAsRead} className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
              Mark all as read
            </button>
          )}
        </div>
      </div>

      <div className="w-full flex flex-col gap-4">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-theme-muted gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p>Loading your updates...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center text-theme-muted glass-card border-theme-border">
            <p>No notifications yet.</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const Icon = getIcon(notif.type);
            return (
              <div 
                key={notif.id} 
                onClick={() => !notif.is_read && markAsRead(notif.id)}
                className={`glass-card p-4 md:p-6 flex items-start gap-4 transition-colors cursor-pointer ${!notif.is_read ? 'bg-theme-surface-2 border-indigo-500/20' : 'opacity-70'}`}
              >
                <div className={`p-3 rounded-xl ${getBg(notif.type)} ${getColor(notif.type)} shrink-0`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-semibold ${!notif.is_read ? 'text-theme-primary' : 'text-theme-secondary'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-xs text-theme-muted whitespace-nowrap ml-4">
                      {timeAgo(new Date(notif.created_at))}
                    </span>
                  </div>
                  <p className="text-sm text-theme-muted">{notif.message}</p>
                </div>
                {!notif.is_read && (
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 mt-2 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default StudentNotificationsPage;
