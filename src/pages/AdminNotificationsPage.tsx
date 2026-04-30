import { useState } from 'react';
import { Bell, Check, Trash2, Menu } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';

const MOCK_NOTIFICATIONS = [
  { id: 1, title: 'New User Registration', message: 'John Doe just created a new account.', time: '2 mins ago', read: false },
  { id: 2, title: 'Subscription Upgraded', message: 'Jane Smith upgraded to Premium.', time: '1 hour ago', read: false },
  { id: 3, title: 'System Alert', message: 'Database backup completed successfully.', time: '5 hours ago', read: true },
];

const AdminNotificationsPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const markAsRead = (id: number) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const deleteNotification = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id));
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
              className="flex items-center gap-2 px-4 py-2 bg-theme-surface hover:bg-theme-surface-2 border border-theme-border text-theme-primary rounded-xl transition-colors text-sm font-medium"
              onClick={() => setNotifications(notifications.map(n => ({ ...n, read: true })))}
            >
              <Check className="w-4 h-4" />
              Mark all read
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {notifications.length === 0 ? (
              <div className="glass-card p-8 text-center text-theme-muted border-theme-border">
                <Bell className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No notifications right now.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className={`glass-card p-4 border-white/5 flex items-start gap-4 transition-colors ${!notif.read ? 'bg-indigo-500/5 border-indigo-500/20' : ''}`}>
                  <div className={`p-2 rounded-lg shrink-0 mt-1 ${!notif.read ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-gray-400'}`}>
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className={`font-semibold ${!notif.read ? 'text-white' : 'text-gray-300'}`}>{notif.title}</h3>
                        <p className="text-sm text-theme-muted mt-1">{notif.message}</p>
                        <p className="text-xs text-theme-muted mt-2">{notif.time}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!notif.read && (
                          <button onClick={() => markAsRead(notif.id)} className="p-1.5 rounded-lg bg-theme-surface hover:bg-theme-surface-2 text-emerald-400 transition-colors" title="Mark as read">
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => deleteNotification(notif.id)} className="p-1.5 rounded-lg bg-theme-surface hover:bg-red-500/10 text-theme-muted hover:text-red-400 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminNotificationsPage;
