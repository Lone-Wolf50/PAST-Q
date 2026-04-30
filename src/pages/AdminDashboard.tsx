import { useState } from 'react';
import { Users, FileText, BrainCircuit, TrendingUp, UserMinus, Menu, Bell, Search } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';

const STATS = [
  { label: 'Total Students', value: '3,421', change: '+12%', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { label: 'Active Plans', value: '842', change: '+5%', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { label: 'Total Papers', value: '1,245', change: '+8 this month', icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { label: 'AI Queries (30d)', value: '14.2k', change: '+22%', icon: BrainCircuit, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
];

const RECENT_SIGNUPS = [
  { id: 1, name: 'Kwame Mensah', email: 'kwame@upsa.edu.gh', plan: 'Pro', date: '2 mins ago' },
  { id: 2, name: 'Abena Osei', email: 'abena@upsa.edu.gh', plan: 'Free', date: '15 mins ago' },
  { id: 3, name: 'Kofi Annan', email: 'kofi@upsa.edu.gh', plan: 'Basic', date: '1 hour ago' },
  { id: 4, name: 'Akua Mansa', email: 'akua@upsa.edu.gh', plan: 'Plus', date: '3 hours ago' },
];

const DELETIONS = [
  { name: 'Yaw Boakye', reason: 'Graduated (Free Plan)' },
  { name: 'Ama Serwaa', reason: 'No longer needed (Plus)' },
];

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-transparent flex font-sans">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content - offset on large screens for fixed sidebar */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-transparent/80 backdrop-blur-xl border-b border-theme-border px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-theme-surface hover:bg-theme-surface-2 text-theme-secondary transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-theme-primary">Dashboard Overview</h1>
              <p className="text-xs text-theme-muted hidden md:block">Welcome back, Admin.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-xl bg-theme-surface hover:bg-theme-surface-2 text-theme-muted transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button className="hidden md:flex p-2 rounded-xl bg-theme-surface hover:bg-theme-surface-2 text-theme-muted transition-colors">
              <Search className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {STATS.map((stat) => (
              <div key={stat.label} className={`glass-card p-4 md:p-6 border ${stat.border} hover:scale-[1.02] transition-transform`}>
                <div className={`inline-flex p-2 md:p-3 rounded-xl ${stat.bg} mb-3 md:mb-4`}>
                  <stat.icon className={`w-5 h-5 md:w-6 md:h-6 ${stat.color}`} />
                </div>
                <p className="text-xs md:text-sm text-theme-muted mb-1 truncate">{stat.label}</p>
                <h3 className="text-2xl md:text-3xl font-bold text-theme-primary">{stat.value}</h3>
                <p className="text-xs text-emerald-400 mt-1">{stat.change}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Recent Signups */}
            <div className="xl:col-span-2 glass-card p-4 md:p-6 border-theme-border">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-theme-primary">Recent Signups</h2>
                <button className="text-sm text-indigo-400 hover:text-indigo-300">View All</button>
              </div>
              
              {/* Mobile: Card list | Desktop: Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-theme-border text-xs text-theme-muted uppercase tracking-wider">
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Email</th>
                      <th className="pb-3 font-medium">Plan</th>
                      <th className="pb-3 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_SIGNUPS.map((user) => (
                      <tr key={user.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface transition-colors">
                        <td className="py-3 text-sm text-theme-primary font-medium">{user.name}</td>
                        <td className="py-3 text-sm text-theme-muted">{user.email}</td>
                        <td className="py-3 text-sm">
                          <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                            user.plan === 'Pro' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' :
                            user.plan === 'Plus' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' :
                            user.plan === 'Basic' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20' :
                            'bg-white/10 text-gray-300 border border-white/10'
                          }`}>
                            {user.plan}
                          </span>
                        </td>
                        <td className="py-3 text-sm text-theme-muted">{user.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="flex flex-col gap-3 md:hidden">
                {RECENT_SIGNUPS.map((user) => (
                  <div key={user.id} className="flex items-center justify-between py-2 border-b border-theme-border">
                    <div>
                      <p className="text-sm text-theme-primary font-medium">{user.name}</p>
                      <p className="text-xs text-theme-muted">{user.date}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                      user.plan === 'Pro' ? 'bg-orange-500/20 text-orange-400' :
                      user.plan === 'Plus' ? 'bg-indigo-500/20 text-indigo-400' :
                      user.plan === 'Basic' ? 'bg-cyan-500/20 text-cyan-400' :
                      'bg-white/10 text-gray-300'
                    }`}>
                      {user.plan}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Deletions */}
            <div className="glass-card p-4 md:p-6 border-theme-border">
              <h2 className="text-lg font-semibold text-theme-primary mb-6">Recent Deletions</h2>
              <div className="flex flex-col gap-3">
                {DELETIONS.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                    <div className="p-2 rounded-lg bg-red-500/10 text-red-400 shrink-0">
                      <UserMinus className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-theme-primary truncate">{d.name}</p>
                      <p className="text-xs text-theme-muted">{d.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-6 py-2 text-sm text-theme-muted hover:text-theme-primary transition-colors border border-theme-border rounded-lg hover:bg-theme-surface">
                View All
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
