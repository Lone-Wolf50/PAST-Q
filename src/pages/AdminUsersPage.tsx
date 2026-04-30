import { useState } from 'react';
import { Search, Ban, CheckCircle2, UserX, Menu } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';

const MOCK_USERS = [
  { id: 1, name: 'Kwame Mensah', email: 'kwame@upsa.edu.gh', plan: 'Pro', status: 'Active', joined: '2023-01-15' },
  { id: 2, name: 'Abena Osei', email: 'abena@upsa.edu.gh', plan: 'Free', status: 'Active', joined: '2023-02-20' },
  { id: 3, name: 'Kofi Annan', email: 'kofi@upsa.edu.gh', plan: 'Basic', status: 'Suspended', joined: '2023-03-10' },
  { id: 4, name: 'Akua Mansa', email: 'akua@upsa.edu.gh', plan: 'Plus', status: 'Active', joined: '2023-04-05' },
];

const AdminUsersPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-transparent flex font-sans">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col lg:ml-64">
        <header className="sticky top-0 z-20 bg-transparent/80 backdrop-blur-xl border-b border-theme-border px-4 md:px-8 py-4 flex items-center gap-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl bg-theme-surface text-theme-secondary">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-theme-primary">Users</h1>
        </header>
      <main className="flex-1 p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-theme-primary mb-2">Manage Users</h1>
            <p className="text-theme-muted">View user details, update plans, and manage accounts.</p>
          </div>
        </div>

        <div className="glass-card p-6 border-theme-border">
          <div className="flex justify-between items-center mb-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <input 
                type="text" 
                placeholder="Search users..." 
                className="w-full bg-theme-surface border border-theme-border rounded-xl py-2 pl-9 pr-4 text-sm text-theme-primary focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            
            <div className="flex gap-2 text-sm">
              <select className="bg-theme-surface border border-theme-border text-theme-primary rounded-lg px-3 py-2 outline-none">
                <option value="">All Plans</option>
                <option value="Free">Free</option>
                <option value="Basic">Basic</option>
                <option value="Plus">Plus</option>
                <option value="Pro">Pro</option>
              </select>
              <select className="bg-theme-surface border border-theme-border text-theme-primary rounded-lg px-3 py-2 outline-none">
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-theme-border text-sm text-theme-muted">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Joined</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_USERS.map((user) => (
                  <tr key={user.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface transition-colors">
                    <td className="py-4 text-sm text-theme-primary font-medium">{user.name}</td>
                    <td className="py-4 text-sm text-theme-muted">{user.email}</td>
                    <td className="py-4 text-sm">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                        user.plan === 'Pro' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' :
                        user.plan === 'Plus' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' :
                        user.plan === 'Basic' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20' :
                        'bg-white/10 text-gray-300 border border-white/10'
                      }`}>
                        {user.plan}
                      </span>
                    </td>
                    <td className="py-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        {user.status === 'Active' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-400">Active</span>
                          </>
                        ) : (
                          <>
                            <Ban className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-red-400">Suspended</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-4 text-sm text-theme-muted">{user.joined}</td>
                    <td className="py-4 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.status === 'Active' ? (
                          <button title="Suspend User" className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button title="Activate User" className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button title="Delete User" className="p-2 rounded-lg bg-theme-surface hover:bg-red-500/20 text-theme-muted hover:text-red-400 transition-colors">
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
};

export default AdminUsersPage;
