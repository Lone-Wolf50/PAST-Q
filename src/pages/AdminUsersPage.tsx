import { useState, useEffect } from 'react';
import { Search, Ban, CheckCircle2, UserX, Menu, Filter, User as UserIcon, Trash2, RotateCw } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../lib/api';
import { clsx } from 'clsx';

import { ThemeToggle } from '../components/ui/ThemeToggle';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AlertModal } from '../components/ui/AlertModal';

const AdminUsersPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'failed' | 'deleted' | 'limits'>('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState({ active: 0, failed: 0, deleted: 0 });

  // UI States
  const [alert, setAlert] = useState<{ show: boolean, title: string, message: string, variant: 'success' | 'error' | 'info' }>({
    show: false, title: '', message: '', variant: 'info'
  });
  const [confirm, setConfirm] = useState<{ show: boolean, id: string | null, action: string | null, status?: string }>({
    show: false, id: null, action: null
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset to page 1 when tab, plan, status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedPlan, selectedStatus]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        search: debouncedSearch,
        plan: selectedPlan,
        status: selectedStatus,
        panel: activeTab
      });

      const res = await apiFetch(`/hq-management/users?${queryParams}`, { token });
      setUsers(res.users || []);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.totalCount || 0);
      if (res.counts) {
        setCounts(res.counts);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, debouncedSearch, selectedPlan, selectedStatus, activeTab]);

  const updateUserStatus = async (id: string, status: string) => {
    const previousUsers = [...users];
    setUsers(users.map(u => u.id === id ? { ...u, status } : u));
    
    try {
      await apiFetch(`/hq-management/users/${id}/status`, {
        method: 'PATCH',
        body: { status },
        token: localStorage.getItem('admin_token')!
      });
    } catch (err: any) {
      setUsers(previousUsers); // Rollback on error
      setAlert({
        show: true,
        title: 'Update Failed',
        message: `Failed to update user status: ${err.message || 'Unknown error'}`,
        variant: 'error'
      });
    }
  };

  const updateUserPlan = async (id: string, plan: string) => {
    const previousUsers = [...users];
    setUsers(users.map(u => u.id === id ? { ...u, plan } : u));
    
    try {
      await apiFetch(`/hq-management/users/${id}/plan`, {
        method: 'PATCH',
        body: { plan },
        token: localStorage.getItem('admin_token')!
      });
    } catch (err: any) {
      setUsers(previousUsers); // Rollback
      setAlert({
        show: true,
        title: 'Update Failed',
        message: `Failed to update user plan: ${err.message || 'Unknown error'}`,
        variant: 'error'
      });
    }
  };

  const toggleAiAccess = async (id: string, enabled: boolean) => {
    const previousUsers = [...users];
    setUsers(users.map(u => u.id === id ? { ...u, ai_enabled: enabled } : u));
    
    try {
      await apiFetch(`/hq-management/users/${id}/ai-status`, {
        method: 'PATCH',
        body: { ai_enabled: enabled },
        token: localStorage.getItem('admin_token')!
      });
    } catch (err: any) {
      setUsers(previousUsers);
      setAlert({
        show: true,
        title: 'AI Update Failed',
        message: `Failed to update AI access: ${err.message || 'Unknown error'}`,
        variant: 'error'
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setConfirm({ show: true, id, action: 'delete' });
  };

  const handleConfirmAction = async () => {
    const { id, action } = confirm;
    if (!id || !action) return;

    setIsDeleting(true);
    try {
      if (action === 'delete') {
        if (activeTab === 'deleted') {
          await apiFetch(`/hq-management/deletions/${id}`, {
            method: 'DELETE',
            token: localStorage.getItem('admin_token')!
          });
          setConfirm({ show: false, id: null, action: null });
          setAlert({ show: true, title: 'Success', message: 'Deletion log dismissed.', variant: 'success' });
        } else if (activeTab === 'failed') {
          await apiFetch(`/hq-management/users/${id}`, {
            method: 'DELETE',
            token: localStorage.getItem('admin_token')!
          });
          setConfirm({ show: false, id: null, action: null });
          setAlert({ show: true, title: 'Success', message: 'Failed user account deleted.', variant: 'success' });
        } else {
          await apiFetch(`/hq-management/users/${id}`, {
            method: 'DELETE',
            token: localStorage.getItem('admin_token')!
          });
          setConfirm({ show: false, id: null, action: null });
          setAlert({ show: true, title: 'Success', message: 'User successfully deleted.', variant: 'success' });
        }
        fetchUsers();
      }
    } catch (err: any) {
      setAlert({
        show: true,
        title: 'Action Failed',
        message: err.message || 'The requested action could not be completed.',
        variant: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderAiGauge = (user: any) => {
    const plan = (user.plan || 'Free').toLowerCase();
    
    if (plan === 'plus' || plan === 'pro') {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-500/20 shadow-sm shadow-blue-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
              Unlimited
            </span>
          </div>
          <span className="text-[10px] text-theme-muted font-mono">Total Queries: {user.total_ai_queries || 0}</span>
        </div>
      );
    }

    if (plan === 'basic') {
      const qCount = user.queries_30d || 0;
      const fCount = user.files_30d || 0;
      const qPct = Math.min((qCount / 10) * 100, 100);
      const fPct = Math.min((fCount / 5) * 100, 100);

      return (
        <div className="flex flex-col gap-2 min-w-[140px] max-w-[200px]">
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[9px] font-bold text-theme-secondary">
              <span>Queries</span>
              <span className={clsx(qCount >= 10 ? "text-red-400" : "text-theme-primary")}>{qCount}/10</span>
            </div>
            <div className="w-full bg-theme-surface rounded-full h-1 overflow-hidden border border-theme-border/20">
              <div 
                className={clsx(
                  "h-full rounded-full transition-all duration-500",
                  qCount >= 10 ? "bg-red-500" : 
                  qCount >= 8 ? "bg-amber-500" : 
                  "bg-blue-500"
                )}
                style={{ width: `${qPct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[9px] font-bold text-theme-secondary">
              <span>Files</span>
              <span className={clsx(fCount >= 5 ? "text-red-400" : "text-theme-primary")}>{fCount}/5</span>
            </div>
            <div className="w-full bg-theme-surface rounded-full h-1 overflow-hidden border border-theme-border/20">
              <div 
                className={clsx(
                  "h-full rounded-full transition-all duration-500",
                  fCount >= 5 ? "bg-red-500" : 
                  fCount >= 4 ? "bg-amber-500" : 
                  "bg-emerald-500"
                )}
                style={{ width: `${fPct}%` }}
              />
            </div>
          </div>
          <span className="text-[9px] text-theme-muted font-mono">Total Queries: {user.total_ai_queries || 0}</span>
        </div>
      );
    }

    const qCount = user.queries_10h || 0;
    const qPct = Math.min((qCount / 3) * 100, 100);

    return (
      <div className="flex flex-col gap-1 min-w-[140px] max-w-[200px]">
        <div className="flex justify-between text-[9px] font-bold text-theme-secondary">
          <span>Queries (10h)</span>
          <span className={clsx(qCount >= 3 ? "text-red-400" : "text-theme-primary")}>{qCount}/3</span>
        </div>
        <div className="w-full bg-theme-surface rounded-full h-1 overflow-hidden border border-theme-border/20">
          <div 
            className={clsx(
              "h-full rounded-full transition-all duration-500",
              qCount >= 3 ? "bg-red-500" : 
              qCount >= 2 ? "bg-amber-500" : 
              "bg-blue-500"
            )}
            style={{ width: `${qPct}%` }}
          />
        </div>
        <span className="text-[9px] text-theme-muted font-mono">Total Queries: {user.total_ai_queries || 0}</span>
      </div>
    );
  };

  const renderPdfGauge = (user: any) => {
    const plan = (user.plan || 'Free').toLowerCase();
    
    if (plan === 'plus' || plan === 'pro') {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/20 shadow-sm shadow-emerald-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Unlimited
            </span>
          </div>
          <span className="text-[10px] text-theme-muted font-mono">Downloads Blocked: No</span>
        </div>
      );
    }

    const pdfCount = user.pdf_downloads_count || 0;
    const limit = plan === 'basic' ? 20 : 4;
    const pct = Math.min((pdfCount / limit) * 100, 100);
    const limitReached = user.pdf_limit_reached;

    return (
      <div className="flex flex-col gap-1 min-w-[140px] max-w-[200px]">
        <div className="flex justify-between text-[9px] font-bold text-theme-secondary">
          <span>Downloads</span>
          <span className={clsx(limitReached ? "text-red-400" : "text-theme-primary")}>
            {pdfCount}/{limit}
          </span>
        </div>
        <div className="w-full bg-theme-surface rounded-full h-1 overflow-hidden border border-theme-border/20">
          <div 
            className={clsx(
              "h-full rounded-full transition-all duration-500",
              limitReached ? "bg-red-500" : 
              pdfCount >= (limit - 2) ? "bg-amber-500" : 
              "bg-emerald-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[9px] text-theme-muted font-mono">
          <span>Blocked: {limitReached ? 'Yes 🔴' : 'No 🟢'}</span>
          {limitReached && user.pdf_downloads_blocked_until && (
            <span className="text-red-400/80 font-bold scale-90">
              Until {new Date(user.pdf_downloads_blocked_until).toLocaleDateString(undefined, { dateStyle: 'short' })}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderUsageFlag = (user: any) => {
    const plan = (user.plan || 'Free').toLowerCase();
    if (plan === 'plus' || plan === 'pro') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">
          Unlimited Access
        </span>
      );
    }
    
    const isAiBlocked = user.ai_limit_reached;
    const isPdfBlocked = user.pdf_limit_reached;

    if (isAiBlocked || isPdfBlocked) {
      let msg = 'Blocked';
      if (isAiBlocked && isPdfBlocked) msg = 'AI & PDF Blocked';
      else if (isAiBlocked) msg = 'AI Blocked';
      else msg = 'PDF Blocked';
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse whitespace-nowrap">
          {msg}
        </span>
      );
    }

    const isAiNearing = (plan === 'free' && user.queries_10h >= 2) || (plan === 'basic' && (user.queries_30d >= 8 || user.files_30d >= 4));
    const isPdfNearing = (plan === 'free' && user.pdf_downloads_count >= 3) || (plan === 'basic' && user.pdf_downloads_count >= 16);

    if (isAiNearing || isPdfNearing) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
          Nearing Limit
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
        Active Quota
      </span>
    );
  };

  const displayUsers = users;

  return (
    <div className="min-h-screen bg-transparent flex font-sans">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col lg:ml-64">
        <header className="sticky top-0 z-20 bg-transparent/80 backdrop-blur-xl border-b border-theme-border px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl bg-theme-surface text-theme-secondary">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-theme-primary">User Management</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="mr-1"><ThemeToggle /></div>
            <button 
              onClick={() => fetchUsers()} 
              className="p-2 rounded-xl bg-theme-surface hover:bg-theme-surface-2 text-theme-muted transition-colors group"
              title="Refresh Users"
            >
              <RotateCw className="w-5 h-5 group-active:rotate-180 transition-transform duration-500" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-theme-primary mb-2">User Management</h1>
            <p className="text-theme-muted">Monitor user activity, manage subscriptions, and moderate accounts.</p>
          </div>

          {/* Premium Glassmorphic Tab Switcher */}
          <div className="flex flex-wrap border-b border-theme-border mb-8 gap-6">
            <button
              onClick={() => setActiveTab('active')}
              className={clsx(
                "pb-3.5 text-sm font-bold transition-all relative outline-none flex items-center gap-2",
                activeTab === 'active' 
                  ? "text-blue-400 border-b-2 border-blue-500 font-extrabold" 
                  : "text-theme-muted hover:text-theme-secondary"
              )}
            >
              Active Students
              <span className="bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 px-2 py-0.5 rounded-full">
                {counts.active}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('failed')}
              className={clsx(
                "pb-3.5 text-sm font-bold transition-all relative outline-none flex items-center gap-2",
                activeTab === 'failed' 
                  ? "text-amber-400 border-b-2 border-amber-500 font-extrabold" 
                  : "text-theme-muted hover:text-theme-secondary"
              )}
            >
              Failed Users
              <span className="bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400 px-2 py-0.5 rounded-full">
                {counts.failed}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('deleted')}
              className={clsx(
                "pb-3.5 text-sm font-bold transition-all relative outline-none flex items-center gap-2",
                activeTab === 'deleted' 
                  ? "text-rose-400 border-b-2 border-rose-500 font-extrabold" 
                  : "text-theme-muted hover:text-theme-secondary"
              )}
            >
              Deleted Accounts
              <span className="bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-400 px-2 py-0.5 rounded-full">
                {counts.deleted}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('limits')}
              className={clsx(
                "pb-3.5 text-sm font-bold transition-all relative flex items-center gap-2 outline-none",
                activeTab === 'limits' 
                  ? "text-blue-400 border-b-2 border-blue-500 font-extrabold" 
                  : "text-theme-muted hover:text-theme-secondary"
              )}
            >
              AI & PDF Quotas
              <span className="bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                Monitor
              </span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="glass-card p-4 md:p-6 mb-8 border-theme-border flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <input 
                type="text" 
                placeholder={activeTab === 'deleted' ? "Search deleted accounts..." : "Search name or email..."} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-theme-primary focus:outline-none focus:border-blue-500/50"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <Filter className="w-4 h-4 text-theme-muted" />
              <select 
                value={selectedPlan} 
                onChange={(e) => setSelectedPlan(e.target.value)} 
                className="theme-select text-sm py-2 px-3"
              >
                <option value="">All Plans</option>
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="plus">Plus</option>
                <option value="pro">Pro</option>
              </select>
              {activeTab !== 'deleted' && activeTab !== 'failed' && (
                <select 
                  value={selectedStatus} 
                  onChange={(e) => setSelectedStatus(e.target.value)} 
                  className="theme-select text-sm py-2 px-3"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              )}
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {loading ? (
              <div className="glass-card p-12 text-center text-theme-muted">Loading user database...</div>
            ) : displayUsers.length === 0 ? (
              <div className="glass-card p-12 text-center text-theme-muted">No users found.</div>
            ) : activeTab === 'active' ? (
              /* ACTIVE MOBILE CARDS */
              <div key="active-mobile" className="flex flex-col gap-4 animate-fade-in w-full">
                {displayUsers.map((user) => (
                  <div key={user.id} className="glass-card p-5 border-theme-border flex flex-col gap-4 relative overflow-hidden">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-inner">
                        <UserIcon className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-theme-primary">{user.full_name}</span>
                        <span className="text-[10px] text-theme-muted font-mono tracking-tighter line-clamp-1">{user.email}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-theme-border/50">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-theme-muted uppercase tracking-[0.1em]">Subscription</span>
                        <select
                          value={user.plan}
                          onChange={(e) => updateUserPlan(user.id, e.target.value)}
                          className={clsx(
                            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase border cursor-pointer outline-none transition-colors w-full",
                            user.plan === 'pro' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                            user.plan === 'plus' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                            user.plan === 'basic' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            "bg-theme-surface text-theme-muted border-theme-border"
                          )}
                        >
                          <option value="free" className="text-theme-primary bg-theme-base">FREE</option>
                          <option value="basic" className="text-theme-primary bg-theme-base">BASIC</option>
                          <option value="plus" className="text-theme-primary bg-theme-base">PLUS</option>
                          <option value="pro" className="text-theme-primary bg-theme-base">PRO</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5 items-end">
                        <span className="text-[9px] font-bold text-theme-muted uppercase tracking-[0.1em]">AI Tutor</span>
                        <button
                          onClick={() => toggleAiAccess(user.id, !(user.ai_enabled ?? true))}
                          className={clsx(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                            (user.ai_enabled ?? true) ? "bg-blue-600" : "bg-gray-700"
                          )}
                        >
                          <span
                            className={clsx(
                              "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                              (user.ai_enabled ?? true) ? "translate-x-4.5" : "translate-x-1"
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          {user.status === 'active' ? (
                            <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" /> ACTIVE
                            </span>
                          ) : user.status === 'suspended' ? (
                            <span className="flex items-center gap-1 text-amber-400 text-[10px] font-bold">
                              <Ban className="w-3 h-3" /> SUSPENDED
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-400 text-[10px] font-bold">
                              <UserX className="w-3 h-3" /> INACTIVE
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-theme-muted font-bold">
                          JOINED {new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          <span className="ml-1 text-theme-muted/70">{new Date(user.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {user.status === 'active' ? (
                          <button onClick={() => updateUserStatus(user.id, 'suspended')} className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20"><Ban className="w-4 h-4" /></button>
                        ) : (
                          <button onClick={() => updateUserStatus(user.id, 'active')} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-4 h-4" /></button>
                        )}
                        {user.status !== 'deactivated' && (
                          <button onClick={() => updateUserStatus(user.id, 'deactivated')} className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20"><UserX className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => handleDeleteClick(user.id)} className="p-2 rounded-lg bg-theme-surface border border-theme-border text-theme-muted hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activeTab === 'failed' ? (
              /* FAILED MOBILE CARDS */
              <div key="failed-mobile" className="flex flex-col gap-4 animate-fade-in w-full">
                {displayUsers.map((user) => (
                  <div key={user.id} className="glass-card p-5 border-theme-border flex flex-col gap-3 relative overflow-hidden">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-inner">
                        <UserIcon className="w-6 h-6 text-amber-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-theme-primary">{user.full_name}</span>
                        <span className="text-[10px] text-theme-muted font-mono tracking-tighter line-clamp-1">{user.email}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2 border-t border-theme-border/50">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-amber-400 font-semibold uppercase">
                          {user.reason || 'Pending OTP'}
                        </span>
                        <span className="text-[9px] text-theme-muted font-medium">
                          ATTEMPTED: {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <button onClick={() => handleDeleteClick(user.id)} className="p-2 rounded-lg bg-theme-surface border border-theme-border text-theme-muted hover:text-red-400 transition-colors" title="Dismiss Log">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : activeTab === 'deleted' ? (
              /* DELETED MOBILE CARDS */
              <div key="deleted-mobile" className="flex flex-col gap-4 animate-fade-in w-full">
                {displayUsers.map((user) => (
                  <div key={user.id} className="glass-card p-5 border-theme-border flex flex-col gap-3 relative overflow-hidden">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shadow-inner">
                        <UserX className="w-6 h-6 text-rose-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-theme-primary">{user.full_name}</span>
                        <span className="text-[10px] text-theme-muted font-mono tracking-tighter line-clamp-1">{user.email}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2 border-t border-theme-border/50">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-theme-muted font-bold">
                          TIER: {user.plan?.toUpperCase()}
                        </span>
                        <span className="text-[9px] text-rose-400 font-bold">
                          DELETED: {new Date(user.deleted_at || user.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <button onClick={() => handleDeleteClick(user.id)} className="p-2 rounded-lg bg-theme-surface border border-theme-border text-theme-muted hover:text-rose-400 transition-colors" title="Dismiss Log">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* AI & PDF LIMITS MOBILE CARDS */
              <div key="limits-mobile" className="flex flex-col gap-4 animate-fade-in w-full">
                {displayUsers.map((user) => (
                  <div key={user.id} className="glass-card p-5 border-theme-border flex flex-col gap-4 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                          <UserIcon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-theme-primary">{user.full_name}</span>
                          <span className="text-[10px] text-theme-muted font-mono tracking-tighter line-clamp-1">{user.email}</span>
                        </div>
                      </div>
                      <div>{renderUsageFlag(user)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-theme-border/50">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-theme-muted uppercase tracking-[0.1em]">AI Limit badge</span>
                        <span className={clsx(
                          "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase self-start border whitespace-nowrap",
                          user.plan === 'pro' || user.plan === 'plus' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          user.plan === 'basic' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-theme-surface text-theme-muted border-theme-border"
                        )}>
                          {user.ai_limit || '3 queries / 10h'}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5 items-end">
                        <span className="text-[9px] font-bold text-theme-muted uppercase tracking-[0.1em]">AI Access</span>
                        <button
                          onClick={() => toggleAiAccess(user.id, !(user.ai_enabled ?? true))}
                          className={clsx(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                            (user.ai_enabled ?? true) ? "bg-blue-600" : "bg-gray-700"
                          )}
                        >
                          <span
                            className={clsx(
                              "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                              (user.ai_enabled ?? true) ? "translate-x-4.5" : "translate-x-1"
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-theme-muted uppercase tracking-[0.1em]">AI Queries & Files Usage</span>
                        {renderAiGauge(user)}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-theme-muted uppercase tracking-[0.1em]">PDF Downloads Limit</span>
                        {renderPdfGauge(user)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table (Hidden on mobile) */}
          <div className="hidden lg:block glass-card border-theme-border overflow-hidden">
            <div className="overflow-x-auto">
              {activeTab === 'active' ? (
                /* ACTIVE STUDENTS TABLE */
                <table key="active-table" className="w-full text-left border-collapse min-w-[900px] animate-fade-in">
                  <thead>
                    <tr className="border-b border-theme-border text-[11px] text-theme-muted uppercase tracking-widest bg-theme-surface/30 font-bold whitespace-nowrap">
                      <th className="px-6 py-4">User Details</th>
                      <th className="px-6 py-4">Subscription</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-center">AI Access</th>
                      <th className="px-6 py-4">Joined Date</th>
                      <th className="px-6 py-4 text-right">Moderation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border">
                    {loading ? (
                      <tr><td colSpan={6} className="py-20 text-center text-theme-muted">Loading user database...</td></tr>
                    ) : displayUsers.length === 0 ? (
                      <tr><td colSpan={6} className="py-20 text-center text-theme-muted">No users found.</td></tr>
                    ) : (
                      displayUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-theme-surface/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                <UserIcon className="w-5 h-5 text-blue-400" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-theme-primary">{user.full_name}</span>
                                <span className="text-[11px] text-theme-muted font-mono">{user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={user.plan}
                              onChange={(e) => updateUserPlan(user.id, e.target.value)}
                              className={clsx(
                                "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border cursor-pointer outline-none transition-colors",
                                user.plan === 'pro' ? "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:border-orange-500/40" :
                                user.plan === 'plus' ? "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:border-blue-500/40" :
                                user.plan === 'basic' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40" :
                                "bg-theme-surface text-theme-muted border-theme-border hover:border-theme-primary/20"
                              )}
                            >
                              <option value="free" className="text-theme-primary bg-theme-base">FREE</option>
                              <option value="basic" className="text-theme-primary bg-theme-base">BASIC</option>
                              <option value="plus" className="text-theme-primary bg-theme-base">PLUS</option>
                              <option value="pro" className="text-theme-primary bg-theme-base">PRO</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              {user.status === 'active' ? (
                                <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Active
                                </span>
                              ) : user.status === 'suspended' ? (
                                <span className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
                                  <Ban className="w-3.5 h-3.5" /> Suspended
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-400 text-xs font-semibold">
                                  <UserX className="w-3.5 h-3.5" /> Deactivated
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <button
                                onClick={() => toggleAiAccess(user.id, !(user.ai_enabled ?? true))}
                                className={clsx(
                                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                  (user.ai_enabled ?? true) ? "bg-blue-600" : "bg-gray-700"
                                )}
                              >
                                <span
                                  className={clsx(
                                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                    (user.ai_enabled ?? true) ? "translate-x-6" : "translate-x-1"
                                  )}
                                />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-theme-muted">{new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
                            <p className="text-[10px] text-theme-muted/60 mt-0.5">{new Date(user.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {user.status === 'active' ? (
                                <button 
                                  onClick={() => updateUserStatus(user.id, 'suspended')} 
                                  title="Suspend User" 
                                  className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => updateUserStatus(user.id, 'active')} 
                                  title="Activate User" 
                                  className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                              
                              {user.status !== 'deactivated' && (
                                <button 
                                  onClick={() => updateUserStatus(user.id, 'deactivated')} 
                                  title="Deactivate User" 
                                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              )}

                              <button 
                                onClick={() => handleDeleteClick(user.id)} 
                                title="Delete Permanently" 
                                className="p-2 rounded-lg bg-theme-surface hover:bg-red-500/20 text-theme-muted hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : activeTab === 'failed' ? (
                /* FAILED USERS TABLE */
                <table key="failed-table" className="w-full text-left border-collapse min-w-[900px] animate-fade-in">
                  <thead>
                    <tr className="border-b border-theme-border text-[11px] text-theme-muted uppercase tracking-widest bg-theme-surface/30 font-bold whitespace-nowrap">
                      <th className="px-6 py-4">User Details</th>
                      <th className="px-6 py-4">Registration Status</th>
                      <th className="px-6 py-4">Registered Date</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border">
                    {loading ? (
                      <tr><td colSpan={4} className="py-20 text-center text-theme-muted">Loading failed users...</td></tr>
                    ) : displayUsers.length === 0 ? (
                      <tr><td colSpan={4} className="py-20 text-center text-theme-muted">No unverified failed users found.</td></tr>
                    ) : (
                      displayUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-theme-surface/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                <UserIcon className="w-5 h-5 text-amber-400" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-theme-primary">{user.full_name}</span>
                                <span className="text-[11px] text-theme-muted font-mono">{user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase">
                              {user.reason || 'Pending OTP'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-theme-muted">{new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
                            <p className="text-[10px] text-theme-muted/60 mt-0.5">{new Date(user.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => handleDeleteClick(user.id)} 
                                title="Delete Permanently" 
                                className="p-2 rounded-lg bg-theme-surface hover:bg-red-500/20 text-theme-muted hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : activeTab === 'deleted' ? (
                /* DELETED ACCOUNTS TABLE */
                <table key="deleted-table" className="w-full text-left border-collapse min-w-[900px] animate-fade-in">
                  <thead>
                    <tr className="border-b border-theme-border text-[11px] text-theme-muted uppercase tracking-widest bg-theme-surface/30 font-bold whitespace-nowrap">
                      <th className="px-6 py-4">User Details</th>
                      <th className="px-6 py-4">Archived Plan</th>
                      <th className="px-6 py-4">Deletion Date</th>
                      <th className="px-6 py-4 text-right">Dismiss</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border">
                    {loading ? (
                      <tr><td colSpan={4} className="py-20 text-center text-theme-muted">Loading deleted database...</td></tr>
                    ) : displayUsers.length === 0 ? (
                      <tr><td colSpan={4} className="py-20 text-center text-theme-muted">No deleted accounts on record.</td></tr>
                    ) : (
                      displayUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-theme-surface/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                                <UserX className="w-5 h-5 text-rose-400" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-theme-primary">{user.full_name}</span>
                                <span className="text-[11px] text-theme-muted font-mono">{user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-theme-secondary uppercase">
                            {user.plan || 'Free'}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-rose-400/80 font-bold">{new Date(user.deleted_at || user.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
                            <p className="text-[10px] text-rose-400/50 mt-0.5">{new Date(user.deleted_at || user.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => handleDeleteClick(user.id)} 
                                title="Dismiss deletion log record" 
                                className="p-2 rounded-lg bg-theme-surface hover:bg-rose-500/20 text-theme-muted hover:text-rose-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                /* AI & DOWNLOADS LIMITS PANEL */
                <table key="limits-table" className="w-full text-left border-collapse min-w-[900px] animate-fade-in">
                  <thead>
                    <tr className="border-b border-theme-border text-[11px] text-theme-muted uppercase tracking-widest bg-theme-surface/30 font-bold whitespace-nowrap">
                      <th className="px-6 py-4">User Details</th>
                      <th className="px-6 py-4">Status Flag</th>
                      <th className="px-6 py-4 text-center">AI Access</th>
                      <th className="px-6 py-4">AI Limit badge</th>
                      <th className="px-6 py-4">AI Queries & Files Gauge</th>
                      <th className="px-6 py-4">PDF Downloads Gauge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border">
                    {loading ? (
                      <tr><td colSpan={6} className="py-20 text-center text-theme-muted">Loading limit analytics...</td></tr>
                    ) : displayUsers.length === 0 ? (
                      <tr><td colSpan={6} className="py-20 text-center text-theme-muted">No users found.</td></tr>
                    ) : (
                      displayUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-theme-surface/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                <UserIcon className="w-5 h-5 text-blue-400" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-theme-primary">{user.full_name}</span>
                                <span className="text-[11px] text-theme-muted font-mono">{user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold">
                            {renderUsageFlag(user)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <button
                                onClick={() => toggleAiAccess(user.id, !(user.ai_enabled ?? true))}
                                className={clsx(
                                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                  (user.ai_enabled ?? true) ? "bg-blue-600" : "bg-gray-700"
                                )}
                              >
                                <span
                                  className={clsx(
                                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                    (user.ai_enabled ?? true) ? "translate-x-6" : "translate-x-1"
                                  )}
                                />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-theme-primary">
                            <span className={clsx(
                              "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border whitespace-nowrap",
                              user.plan === 'pro' || user.plan === 'plus' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                              user.plan === 'basic' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-theme-surface text-theme-muted border-theme-border"
                            )}>
                              {user.ai_limit || '3 queries / 10h'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs">
                            {renderAiGauge(user)}
                          </td>
                          <td className="px-6 py-4 text-xs">
                            {renderPdfGauge(user)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 bg-transparent/20 backdrop-blur-xl border border-theme-border rounded-2xl p-4 shadow-xl">
              <span className="text-xs text-theme-muted font-medium">
                Showing <span className="font-extrabold text-theme-primary">{Math.min((currentPage - 1) * 10 + 1, totalCount)}</span> to{' '}
                <span className="font-extrabold text-theme-primary">{Math.min(currentPage * 10, totalCount)}</span> of{' '}
                <span className="font-extrabold text-theme-primary">{totalCount}</span> entries
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1 || loading}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-theme-surface hover:bg-theme-surface-2 border border-theme-border text-theme-secondary hover:text-theme-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                  const isNear = Math.abs(p - currentPage) <= 1;
                  const isEdge = p === 1 || p === totalPages;
                  if (!isNear && !isEdge) {
                    if (p === 2 || p === totalPages - 1) {
                      return <span key={p} className="px-1 text-theme-muted font-black">...</span>;
                    }
                    return null;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      disabled={loading}
                      className={clsx(
                        "w-9 h-9 rounded-xl text-xs font-black border transition-all duration-200",
                        currentPage === p
                          ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20"
                          : "bg-theme-surface hover:bg-theme-surface-2 border-theme-border text-theme-secondary hover:text-theme-primary"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || loading}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-theme-surface hover:bg-theme-surface-2 border border-theme-border text-theme-secondary hover:text-theme-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Custom UI Modals ── */}
      <ConfirmModal 
        isOpen={confirm.show}
        onClose={() => { if (!isDeleting) setConfirm({ show: false, id: null, action: null }); }}
        onConfirm={handleConfirmAction}
        title={confirm.action === 'delete' ? (activeTab === 'deleted' ? "Dismiss Deletion Log" : "Delete User") : "Confirm Action"}
        message={confirm.action === 'delete' 
          ? (activeTab === 'deleted' 
              ? "Are you sure you want to dismiss this deleted account log entry?" 
              : "Are you sure you want to PERMANENTLY delete this user? This action cannot be undone and all their data will be wiped.")
          : "Are you sure you want to proceed with this action?"}
        confirmText={confirm.action === 'delete' ? (activeTab === 'deleted' ? "Dismiss Log" : "Delete Forever") : "Confirm"}
        variant={confirm.action === 'delete' ? "danger" : "warning"}
        isLoading={isDeleting}
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

export default AdminUsersPage;
