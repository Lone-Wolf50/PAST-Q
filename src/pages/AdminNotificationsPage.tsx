import { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Menu, Flag, Loader2, UserX, TriangleAlert } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../lib/api';

const AdminNotificationsPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      const res = await apiFetch('/hq-management/notifications', { token });
      setNotifications(res.notifications || []);
    } catch {
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    setMarkingId(id);
    try {
      await apiFetch(`/hq-management/notifications/${id}`, { method: 'PATCH', token: localStorage.getItem('admin_token')! });
      await fetchNotifications();
    } catch { /* console log removed */ } finally {
      setMarkingId(null);
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await apiFetch('/hq-management/notifications/read-all', { method: 'PATCH', token: localStorage.getItem('admin_token')! });
      await fetchNotifications();
    } catch { /* console log removed */ } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await apiFetch(`/hq-management/notifications/${id}`, { method: 'DELETE', token: localStorage.getItem('admin_token')! });
      fetchNotifications();
    } catch { /* console log removed */ }
  };

  return (
    <div className="min-h-screen bg-transparent flex font-sans">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col lg:ml-64">
        <header className="sticky top-0 z-20 bg-transparent/80 backdrop-blur-xl border-b border-theme-border px-4 md:px-8 py-4 flex items-center gap-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl bg-theme-surface text-theme-secondary">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-theme-primary">Notifications</h1>
        </header>
        
        <main className="flex-1 p-4 md:p-8 max-w-4xl">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-theme-primary mb-2">Notifications</h1>
              <p className="text-theme-muted">View and manage system alerts and user activity.</p>
            </div>
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-theme-surface hover:bg-theme-surface-2 border border-theme-border text-theme-primary rounded-xl transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={markAllRead}
              disabled={markingAll}
            >
              {markingAll
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Check className="w-4 h-4" />}
              {markingAll ? 'Marking...' : 'Mark all read'}
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {notifications.length === 0 ? (
              <div className="glass-card p-8 text-center text-theme-muted border-theme-border">
                <Bell className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No notifications right now.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isReport = notif.type === 'report';
                const isAlert = notif.type === 'alert';   // account deletion
                const isWarning = notif.type === 'warning'; // failed attempts

                const cardBg = isReport && !notif.is_read
                  ? 'bg-red-500/5 border-red-500/20'
                  : isAlert && !notif.is_read
                  ? 'bg-rose-500/8 border-rose-500/25'
                  : isWarning && !notif.is_read
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : !notif.is_read
                  ? 'bg-indigo-500/5 border-indigo-500/20'
                  : 'border-white/5';

                const iconBg = isReport
                  ? (!notif.is_read ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-red-400/50')
                  : isAlert
                  ? (!notif.is_read ? 'bg-rose-500/20 text-rose-400' : 'bg-white/5 text-rose-400/50')
                  : isWarning
                  ? (!notif.is_read ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-amber-400/50')
                  : (!notif.is_read ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-gray-400');

                const NotifIcon = isReport ? Flag : isAlert ? UserX : isWarning ? TriangleAlert : Bell;

                return (
                  <div key={notif.id} className={`glass-card p-4 flex items-start gap-4 transition-colors ${cardBg}`}>
                    <div className={`p-2 rounded-lg shrink-0 mt-1 ${iconBg}`}>
                      <NotifIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`font-semibold ${!notif.is_read ? 'text-white' : 'text-gray-300'}`}>{notif.title}</h3>
                            {isReport && (
                              <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-widest border border-red-500/20">
                                Content Report
                              </span>
                            )}
                            {isAlert && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-[9px] font-black uppercase tracking-widest border border-rose-500/20">
                                Account Deleted
                              </span>
                            )}
                            {isWarning && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[9px] font-black uppercase tracking-widest border border-amber-500/20">
                                Warning
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-theme-muted mt-1">{notif.message}</p>
                          <p className="text-xs text-theme-muted mt-2">{new Date(notif.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!notif.is_read && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              disabled={markingId === notif.id}
                              className="p-1.5 rounded-lg bg-theme-surface hover:bg-theme-surface-2 text-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Mark as read"
                            >
                              {markingId === notif.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Check className="w-4 h-4" />}
                            </button>
                          )}
                          <button onClick={() => deleteNotification(notif.id)} className="p-1.5 rounded-lg bg-theme-surface hover:bg-red-500/10 text-theme-muted hover:text-red-400 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminNotificationsPage;
