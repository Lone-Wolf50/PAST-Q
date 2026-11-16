import { useState, useEffect, type MouseEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, BookOpen, AlertCircle, CheckCircle2, Loader2, BellOff, CreditCard, Bell, CheckCheck, Trash2 } from 'lucide-react';
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
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await apiFetch('/profile/notifications/read-all', { method: 'PATCH', token: token! });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      window.dispatchEvent(new CustomEvent('notifications_updated'));
    } catch (err) {

    } finally {
      setMarkingAll(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await apiFetch(`/profile/notifications/${id}/read`, { method: 'PATCH', token: token! });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      window.dispatchEvent(new CustomEvent('notifications_updated'));
    } catch (err) {

    }
  };

  const deleteNotification = async (e: MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (deletingId === id) return;
    setDeletingId(id);
    try {
      await apiFetch(`/profile/notifications/${id}`, { method: 'DELETE', token: token! });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      window.dispatchEvent(new CustomEvent('notifications_updated'));
    } catch (err) {

    } finally {
      setDeletingId(null);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'ai': return Sparkles;
      case 'paper': return BookOpen;
      case 'success': return CheckCircle2;
      case 'payment': return CreditCard;
      case 'system': return Bell;
      default: return AlertCircle;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'ai': return 'text-purple-400';
      case 'paper': return 'text-indigo-400';
      case 'success': return 'text-emerald-400';
      case 'payment': return 'text-emerald-400';
      case 'system': return 'text-blue-400';
      default: return 'text-amber-400';
    }
  };

  const getBg = (type: string) => {
    switch (type) {
      case 'ai': return 'bg-purple-500/10';
      case 'paper': return 'bg-indigo-500/10';
      case 'success': return 'bg-emerald-500/10';
      case 'payment': return 'bg-emerald-500/10';
      case 'system': return 'bg-blue-500/10';
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-theme-primary mb-2">Notifications</h1>
            <p className="text-theme-muted">Stay updated with your account and new features.</p>
          </div>
          {notifications.some(n => !n.is_read) && (
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={markingAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/35 text-indigo-400 text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 cursor-pointer shrink-0 disabled:opacity-50"
            >
              {markingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              <span>{markingAll ? 'Marking...' : 'Mark all as read'}</span>
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
          <div className="py-16 flex flex-col items-center justify-center text-center gap-4 glass-card border-theme-border">
            <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-400">
              <BellOff className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-semibold text-theme-primary mb-1">No notifications yet</h3>
              <p className="text-sm text-theme-muted max-w-xs">
                You'll see updates here when you upgrade your plan, use AI features, or access papers.
              </p>
            </div>
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
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-start gap-3 mb-1">
                    <h3 className={`font-semibold ${!notif.is_read ? 'text-theme-primary' : 'text-theme-secondary'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-xs text-theme-muted whitespace-nowrap shrink-0">
                      {timeAgo(new Date(notif.created_at))}
                    </span>
                  </div>
                  <p className="text-sm text-theme-muted whitespace-pre-line leading-relaxed">{notif.description || notif.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-start">
                  {!notif.is_read && (
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.5)]" title="Unread" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => deleteNotification(e, notif.id)}
                    disabled={deletingId === notif.id}
                    title="Delete notification"
                    aria-label="Delete notification"
                    className="p-2 rounded-xl bg-theme-surface hover:bg-red-500/15 border border-theme-border hover:border-red-500/30 text-theme-muted hover:text-red-400 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {deletingId === notif.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default StudentNotificationsPage;
