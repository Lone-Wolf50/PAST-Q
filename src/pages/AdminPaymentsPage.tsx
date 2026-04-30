import { useState } from 'react';
import { Search, ArrowUpRight, CheckCircle2, XCircle, Menu } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';

const MOCK_PAYMENTS = [
  { id: 'PAY-1001', user: 'Kwame Mensah', email: 'kwame@upsa.edu.gh', amount: 'GH₵50.00', plan: 'Pro', status: 'Successful', date: '2023-04-10' },
  { id: 'PAY-1002', user: 'Akua Mansa', email: 'akua@upsa.edu.gh', amount: 'GH₵25.00', plan: 'Plus', status: 'Successful', date: '2023-04-12' },
  { id: 'PAY-1003', user: 'Kofi Annan', email: 'kofi@upsa.edu.gh', amount: 'GH₵10.00', plan: 'Basic', status: 'Failed', date: '2023-04-14' },
];

const AdminPaymentsPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-transparent flex font-sans">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Mobile Header */}
        <header className="sticky top-0 z-20 bg-transparent/80 backdrop-blur-xl border-b border-theme-border px-4 md:px-8 py-4 flex items-center gap-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl bg-theme-surface text-theme-secondary">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-theme-primary">Payments</h1>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-theme-primary mb-1">Payments & Subscriptions</h1>
              <p className="text-theme-muted text-sm">Track revenue, view transaction history, and manage subscriptions.</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-theme-surface-2 hover:bg-theme-surface-2 text-theme-primary rounded-xl transition-colors font-medium border border-theme-border shrink-0">
              <ArrowUpRight className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="glass-card p-4 md:p-6 border-theme-border">
              <p className="text-sm text-theme-muted mb-1">Total Revenue (30d)</p>
              <h3 className="text-2xl md:text-3xl font-bold text-theme-primary">GH₵12,450</h3>
              <p className="text-xs text-emerald-400 mt-2">+14% from last month</p>
            </div>
            <div className="glass-card p-4 md:p-6 border-theme-border">
              <p className="text-sm text-theme-muted mb-1">Active Subscribers</p>
              <h3 className="text-2xl md:text-3xl font-bold text-theme-primary">842</h3>
              <p className="text-xs text-emerald-400 mt-2">+5% from last month</p>
            </div>
            <div className="glass-card p-4 md:p-6 border-theme-border">
              <p className="text-sm text-theme-muted mb-1">Failed Transactions</p>
              <h3 className="text-2xl md:text-3xl font-bold text-theme-primary">12</h3>
              <p className="text-xs text-theme-muted mt-2">Requires attention</p>
            </div>
          </div>

          <div className="glass-card p-4 md:p-6 border-theme-border">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                <input 
                  type="text" 
                  placeholder="Search transactions..." 
                  className="w-full bg-theme-surface border border-theme-border rounded-xl py-2 pl-9 pr-4 text-sm text-theme-primary focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <select className="bg-theme-surface border border-theme-border text-theme-primary rounded-lg px-3 py-2 outline-none text-sm">
                <option value="">All Statuses</option>
                <option value="Successful">Successful</option>
                <option value="Failed">Failed</option>
              </select>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-theme-border text-xs text-theme-muted uppercase tracking-wider">
                    <th className="pb-3 font-medium">Transaction ID</th>
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Plan</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_PAYMENTS.map((payment) => (
                    <tr key={payment.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface transition-colors">
                      <td className="py-4 text-sm text-theme-muted font-mono">{payment.id}</td>
                      <td className="py-4 text-sm">
                        <div className="flex flex-col">
                          <span className="text-theme-primary font-medium">{payment.user}</span>
                          <span className="text-theme-muted text-xs">{payment.email}</span>
                        </div>
                      </td>
                      <td className="py-4 text-sm">
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          payment.plan === 'Pro' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' :
                          payment.plan === 'Plus' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' :
                          'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20'
                        }`}>
                          {payment.plan}
                        </span>
                      </td>
                      <td className="py-4 text-sm text-theme-primary font-medium">{payment.amount}</td>
                      <td className="py-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          {payment.status === 'Successful' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-400">Successful</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
                              <span className="text-red-400">Failed</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-sm text-theme-muted">{payment.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="flex flex-col gap-3 md:hidden">
              {MOCK_PAYMENTS.map((payment) => (
                <div key={payment.id} className="border border-theme-border rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm text-theme-primary font-medium">{payment.user}</p>
                      <p className="text-xs text-theme-muted font-mono">{payment.id}</p>
                    </div>
                    <span className="text-sm font-bold text-theme-primary">{payment.amount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {payment.status === 'Successful' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-xs text-emerald-400">Successful</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-xs text-red-400">Failed</span>
                        </>
                      )}
                    </div>
                    <span className="text-xs text-theme-muted">{payment.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPaymentsPage;
