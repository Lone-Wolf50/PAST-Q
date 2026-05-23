import { useState, useEffect } from 'react';
import { Search, ArrowUpRight, CheckCircle2, XCircle, Menu, Filter, DollarSign, Users, AlertCircle, UserX, RotateCw } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../lib/api';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AlertModal } from '../components/ui/AlertModal';


const AdminPaymentsPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // UI States
  const [alert, setAlert] = useState<{ show: boolean, title: string, message: string, variant: 'success' | 'error' | 'info' }>({
    show: false, title: '', message: '', variant: 'info'
  });
  const [confirm, setConfirm] = useState<{ show: boolean, id: string | null }>({
    show: false, id: null
  });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      const [payRes, statRes] = await Promise.all([
        apiFetch('/hq-management/payments', { token }),
        apiFetch('/hq-management/stats', { token })
      ]);
      setPayments(payRes.transactions || []);
      setStats(statRes);
    } catch (err) {

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeactivateClick = (userId: string) => {
    setConfirm({ show: true, id: userId });
  };

  const handleConfirmDeactivate = async () => {
    const userId = confirm.id;
    if (!userId) return;

    try {
      await apiFetch(`/hq-management/users/${userId}/status`, {
        method: 'PATCH',
        body: { status: 'deactivated' },
        token: localStorage.getItem('admin_token')!
      });
      setConfirm({ show: false, id: null });
      setAlert({ show: true, title: 'User Deactivated', message: 'The user account has been successfully deactivated.', variant: 'success' });
      fetchData();
    } catch (err: any) {

      setAlert({
        show: true,
        title: 'Action Failed',
        message: err.message || 'Could not deactivate the user account.',
        variant: 'error'
      });
    }
  };

  const handleExportReport = () => {
    if (payments.length === 0) {
      setAlert({
        show: true,
        title: 'No Data',
        message: 'There are no transactions to export.',
        variant: 'info'
      });
      return;
    }

    const headers = ['Transaction ID', 'Student Name', 'Student Email', 'Plan', 'Amount (GHS)', 'Status', 'Date'];
    
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      headers.join(','),
      ...payments.map(p => [
        escapeCSV(p.reference),
        escapeCSV(p.upsa_users?.full_name),
        escapeCSV(p.upsa_users?.email),
        escapeCSV(p.plan),
        escapeCSV(p.amount),
        escapeCSV(p.status),
        escapeCSV(new Date(p.created_at).toLocaleDateString())
      ].join(','))
    ];

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `payment_report_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setAlert({
      show: true,
      title: 'Export Successful',
      message: `Successfully exported ${payments.length} transactions to CSV.`,
      variant: 'success'
    });
  };

  const filteredPayments = payments.filter(p => {
    const matchSearch = !searchTerm || 
      p.reference.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.upsa_users?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !selectedStatus || p.status === selectedStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen bg-transparent flex font-sans">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col lg:ml-64">
        <header className="sticky top-0 z-20 bg-transparent/80 backdrop-blur-xl border-b border-theme-border px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl bg-theme-surface text-theme-secondary">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-theme-primary">Payments</h1>
          </div>
          <button 
            onClick={() => fetchData()} 
            className="p-2 rounded-xl bg-theme-surface hover:bg-theme-surface-2 text-theme-muted transition-colors group"
            title="Refresh Data"
          >
            <RotateCw className="w-5 h-5 group-active:rotate-180 transition-transform duration-500" />
          </button>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h1 className="text-3xl font-bold text-theme-primary mb-2">Revenue & Transactions</h1>
              <p className="text-theme-muted text-sm">Monitor system financial health and manage subscriber statuses.</p>
            </div>
            <button 
              onClick={handleExportReport}
              className="flex items-center gap-2 px-5 py-2.5 bg-theme-surface border border-theme-border rounded-xl text-theme-primary font-bold hover:bg-theme-surface-2 transition-all"
            >
              <ArrowUpRight className="w-4 h-4" />
              Export Report
            </button>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="glass-card p-6 border-theme-border relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <DollarSign className="w-6 h-6 text-indigo-400" />
                </div>
                <p className="text-sm font-bold text-theme-muted uppercase tracking-wider">Total Revenue</p>
              </div>
              <h3 className="text-3xl font-bold text-theme-primary">GH₵{stats?.totalRevenue || 0}</h3>
              <div className="flex items-center gap-1.5 mt-4 text-[11px] font-bold text-emerald-400 uppercase">
                <CheckCircle2 className="w-3 h-3" />
                Updated Live
              </div>
            </div>

            <div className="glass-card p-6 border-theme-border relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <Users className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-sm font-bold text-theme-muted uppercase tracking-wider">Active Subs</p>
              </div>
              <h3 className="text-3xl font-bold text-theme-primary">{stats?.activeSubscribers || 0}</h3>
              <div className="flex items-center gap-1.5 mt-4 text-[11px] font-bold text-emerald-400 uppercase">
                <CheckCircle2 className="w-3 h-3" />
                Currently Paying
              </div>
            </div>

            <div className="glass-card p-6 border-theme-border relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-colors" />
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <p className="text-sm font-bold text-theme-muted uppercase tracking-wider">Failed Attempts</p>
              </div>
              <h3 className="text-3xl font-bold text-theme-primary">{stats?.failedTransactions || 0}</h3>
              <div className="flex items-center gap-1.5 mt-4 text-[11px] font-bold text-amber-400 uppercase">
                <AlertCircle className="w-3 h-3" />
                Action Required
              </div>
            </div>
          </div>

          {/* Mobile Cards View (Visible on mobile only) */}
          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {loading ? (
              <div className="glass-card p-12 text-center text-theme-muted">Loading transactions...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="glass-card p-12 text-center text-theme-muted">No records found.</div>
            ) : (
              filteredPayments.map((payment) => (
                <div key={payment.id} className="glass-card p-5 border-theme-border flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-theme-primary">{payment.upsa_users?.full_name}</span>
                      <span className="text-[10px] text-theme-muted font-mono tracking-tighter">{payment.reference}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-theme-primary">GH₵{payment.amount}</span>
                      <span className="text-[9px] font-bold uppercase text-indigo-400 tracking-wider">{payment.plan}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3 border-y border-theme-border/50">
                    <div className="flex items-center gap-3">
                      {payment.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20">
                          <CheckCircle2 className="w-2.5 h-2.5" /> SUCCESS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[9px] font-bold border border-red-500/20">
                          <XCircle className="w-2.5 h-2.5" /> FAILED
                        </span>
                      )}
                      <span className="text-[10px] text-theme-muted font-bold">
                        {new Date(payment.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </span>
                    </div>

                    {payment.status === 'failed' && payment.upsa_users?.status !== 'deactivated' ? (
                      <button 
                        onClick={() => handleDeactivateClick(payment.user_id)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-theme-muted text-[10px] font-bold uppercase tracking-widest">-</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (Hidden on mobile) */}
          <div className="hidden lg:block glass-card border-theme-border overflow-hidden">
            <div className="p-6 border-b border-theme-border flex flex-col lg:flex-row justify-between items-center gap-4">
              <div className="relative flex-1 w-full lg:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by ID or User..." 
                  className="w-full lg:w-80 bg-theme-surface border border-theme-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-theme-primary focus:border-indigo-500/50 outline-none"
                />
              </div>
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <Filter className="w-4 h-4 text-theme-muted" />
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="theme-select text-sm py-2 px-3"
                >
                  <option value="">All Statuses</option>
                  <option value="success">Successful</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-theme-border text-[11px] text-theme-muted uppercase tracking-widest bg-theme-surface/30 font-bold">
                    <th className="px-6 py-4">Transaction ID</th>
                    <th className="px-6 py-4">User Details</th>
                    <th className="px-6 py-4">Plan / Amount</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {loading ? (
                    <tr><td colSpan={6} className="py-20 text-center text-theme-muted">Loading transactions...</td></tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr><td colSpan={6} className="py-20 text-center text-theme-muted">No records matching your search.</td></tr>
                  ) : (
                    filteredPayments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-theme-surface/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-[11px] text-theme-muted">{payment.reference}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-theme-primary">{payment.upsa_users?.full_name}</span>
                            <span className="text-[10px] text-theme-muted">{payment.upsa_users?.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-theme-primary">GH₵{payment.amount}</span>
                            <span className="text-[10px] font-bold uppercase text-indigo-400">{payment.plan}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {payment.status === 'success' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> SUCCESSFUL
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20">
                              <XCircle className="w-3 h-3" /> FAILED
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-theme-muted font-medium">
                          {new Date(payment.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {payment.status === 'failed' && payment.upsa_users?.status !== 'deactivated' ? (
                            <button 
                              onClick={() => handleDeactivateClick(payment.user_id)}
                              title="Deactivate User Account"
                              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-theme-muted text-[10px] font-bold uppercase tracking-widest">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* ── Custom UI Modals ── */}
      <ConfirmModal 
        isOpen={confirm.show}
        onClose={() => setConfirm({ show: false, id: null })}
        onConfirm={handleConfirmDeactivate}
        title="Deactivate User"
        message="Are you sure you want to deactivate this user account? They will be blocked from accessing all paid features and the AI tutor."
        confirmText="Deactivate Account"
        variant="danger"
      />

      <AlertModal 
        isOpen={alert.show}
        onClose={() => setAlert({ ...alert, show: false })}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
      />
    </div>
  );
};

export default AdminPaymentsPage;
