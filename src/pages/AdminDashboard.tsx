import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { Link } from 'react-router-dom';
import { Users, FileText, TrendingUp, UserMinus, UserX, Menu, Bell, Search, RotateCw, Trash2, AlertTriangle } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, AreaChart, Area } from 'recharts';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../lib/api';
import { clsx } from 'clsx';
import { ThemeToggle } from '../components/ui/ThemeToggle';

const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const AdminDashboard = () => {

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [recentSignups, setRecentSignups] = useState<any[]>([]);
  const [deletions, setDeletions] = useState<any[]>([]);
  const [failedAccounts, setFailedAccounts] = useState<any[]>([]);
  const [failedSearch, setFailedSearch] = useState('');
  const [dismissedFailedAccounts, setDismissedFailedAccounts] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pastq_dismissed_failed');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [dismissedDeletions, setDismissedDeletions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pastq_dismissed_deletions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [deletionsSearch, setDeletionsSearch] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState('monthly');
  const [globalAiBlock, setGlobalAiBlock] = useState(false);
  const [globalBanner, setGlobalBanner] = useState('');
  const [globalBannerActive, setGlobalBannerActive] = useState(false);
  const [isBannerSaving, setIsBannerSaving] = useState(false);
  const hasLoadedBanner = React.useRef(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const [statsData, usersData, deletionsData, notifData, aiConfigData, failedData] = await Promise.all([
        apiFetch(`/hq-management/stats?range=${timeRange}`, { token }),
        apiFetch('/hq-management/users', { token }),
        apiFetch('/hq-management/deletions', { token }),
        apiFetch('/hq-management/notifications', { token }),
        apiFetch('/hq-management/ai-config', { token }),
        apiFetch('/hq-management/failed-accounts', { token }),
      ]);

      setStats(statsData);
      setRecentSignups((usersData.users || []).slice(0, 5));
      setDeletions(deletionsData.deletions || []);
      setNotifications(notifData.notifications || []);
      setFailedAccounts(failedData.failedAccounts || []);
      if (aiConfigData) {
        setGlobalAiBlock(aiConfigData.globalAiBlock || false);
        setGlobalBannerActive(aiConfigData.globalBannerActive || false);
        if (!hasLoadedBanner.current) {
          setGlobalBanner(aiConfigData.globalBanner || '');
          hasLoadedBanner.current = true;
        }
      }
    } catch (err: any) {
      // Silently handle fetch errors — dashboard will retry on next interval
    }
  }, [timeRange]);

  const handleDismissDeletion = async (id: string | undefined, email: string) => {
    const identifier = id || email;
    if (!identifier) return;
    const updated = [...dismissedDeletions, identifier];
    setDismissedDeletions(updated);
    localStorage.setItem('pastq_dismissed_deletions', JSON.stringify(updated));
    if (id) {
      try {
        const token = localStorage.getItem('admin_token');
        await apiFetch(`/hq-management/deletions/${id}`, { method: 'DELETE', token: token ?? undefined });
      } catch { /* silently fail — already dismissed locally */ }
    }
  };

  const handleDismissFailed = async (id: string | undefined, email: string) => {
    const identifier = id || email;
    if (!identifier) return;
    const updated = [...dismissedFailedAccounts, identifier];
    setDismissedFailedAccounts(updated);
    localStorage.setItem('pastq_dismissed_failed', JSON.stringify(updated));
    if (id) {
      try {
        const token = localStorage.getItem('admin_token');
        await apiFetch(`/hq-management/failed-accounts/${id}`, { method: 'DELETE', token: token ?? undefined });
      } catch { /* silently fail */ }
    }
  };




  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const toggleGlobalAi = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const newState = !globalAiBlock;
      setGlobalAiBlock(newState); // optimistic
      await apiFetch('/hq-management/ai-config', {
        method: 'POST',
        token: token ?? undefined,
        body: { globalAiBlock: newState }
      });
    } catch (err) {
      setGlobalAiBlock(globalAiBlock); // revert on error using the closure's original value
    }
  };

  const saveGlobalBanner = async (isActive: boolean) => {
    try {
      setIsBannerSaving(true);
      const token = localStorage.getItem('admin_token');
      setGlobalBannerActive(isActive);
      await apiFetch('/hq-management/ai-config', {
        method: 'POST',
        token: token ?? undefined,
        body: { globalBanner, globalBannerActive: isActive }
      });
      setTimeout(() => setIsBannerSaving(false), 2000);
    } catch (err) {
      setGlobalBannerActive(!isActive); // revert
      setIsBannerSaving(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;


  const STATS_CARDS = useMemo(() => [
    { label: 'Total Students', value: stats?.totalStudents || 0, change: '', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
    { label: 'Active Subscriptions', value: stats?.activePlans || 0, change: '', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { label: 'Total Papers', value: stats?.totalPapers || 0, change: '', icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { label: 'Deleted Accounts', value: stats?.totalDeleted || 0, change: '', icon: UserMinus, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    { label: 'Failed Users', value: stats?.totalFailed || 0, change: '', icon: UserX, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  ], [stats]);

  const pieData = useMemo(() => [
    { name: 'Active Students', value: Number(stats?.totalStudents) || 0, color: '#6366f1' },
    { name: 'Deleted Accounts', value: Number(stats?.totalDeleted) || 0, color: '#f43f5e' },
  ], [stats]);

  const retentionTotal = useMemo(() => pieData.reduce((acc, item) => acc + item.value, 0), [pieData]);
  const retentionChartData = useMemo(
    () => retentionTotal > 0 ? pieData : [{ name: 'No Users Yet', value: 1, color: 'rgba(156, 163, 175, 0.2)', isPlaceholder: true }],
    [pieData, retentionTotal]
  );

  const revenueByPlanData = useMemo(() => [
    { name: 'Basic', value: Number(stats?.revenueByPlan?.basic) || 0, color: '#10b981' },
    { name: 'Plus', value: Number(stats?.revenueByPlan?.plus) || 0, color: '#6366f1' },
    { name: 'Pro', value: Number(stats?.revenueByPlan?.pro) || 0, color: '#f59e0b' },
  ], [stats]);

  const revenueByPlanTotal = useMemo(() => revenueByPlanData.reduce((acc, item) => acc + item.value, 0), [revenueByPlanData]);
  const revenuePieChartData = useMemo(
    () => revenueByPlanTotal > 0 ? revenueByPlanData : [{ name: 'No Revenue Yet', value: 1, color: 'rgba(156, 163, 175, 0.2)', isPlaceholder: true }],
    [revenueByPlanData, revenueByPlanTotal]
  );

  const aiUsageData = useMemo(() => [
    { name: 'Free', value: Number(stats?.aiUsageByPlan?.free) || 0, color: '#9ca3af' },
    { name: 'Basic', value: Number(stats?.aiUsageByPlan?.basic) || 0, color: '#10b981' },
    { name: 'Plus', value: Number(stats?.aiUsageByPlan?.plus) || 0, color: '#6366f1' },
    { name: 'Pro', value: Number(stats?.aiUsageByPlan?.pro) || 0, color: '#f59e0b' },
  ], [stats]);

  const aiUsageTotal = useMemo(() => aiUsageData.reduce((acc, item) => acc + item.value, 0), [aiUsageData]);
  const aiUsagePieChartData = useMemo(
    () => aiUsageTotal > 0 ? aiUsageData : [{ name: 'No Queries Yet', value: 1, color: 'rgba(156, 163, 175, 0.2)', isPlaceholder: true }],
    [aiUsageData, aiUsageTotal]
  );

  const defaultTimelineKeys = useMemo(() => {
    const now = new Date();
    const keys: string[] = [];
    if (timeRange === 'daily') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        keys.push(d.toISOString().split('T')[0]);
      }
    } else if (timeRange === 'weekly') {
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        keys.push(d.toISOString().split('T')[0]);
      }
    } else if (timeRange === 'yearly') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
      }
    } else {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        keys.push(d.toISOString().split('T')[0]);
      }
    }
    return keys;
  }, [timeRange]);

  const normalizeDateKey = useCallback((rawDate: string) => {
    if (!rawDate) return '';
    if (/^\d{4}-\d{2}$/.test(rawDate)) return `${rawDate}-01`;
    return rawDate;
  }, []);

  const salesChartData = useMemo(() => {
    const raw: any[] = stats?.salesChartData || [];
    const map = new Map<string, number>();
    defaultTimelineKeys.forEach(k => map.set(k, 0));
    raw.forEach(item => {
      const k = normalizeDateKey(String(item.date || ''));
      if (k) map.set(k, (map.get(k) || 0) + (Number(item.revenue) || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, revenue]) => ({ date, revenue }));
  }, [stats?.salesChartData, defaultTimelineKeys, normalizeDateKey]);

  const growthChartData = useMemo(() => {
    const raw: any[] = stats?.growthChartData || [];
    if (raw.length >= 2) {
      return raw.map(item => ({
        date: normalizeDateKey(String(item.date || '')),
        free: Number(item.free) || 0,
        basic: Number(item.basic) || 0,
        plus: Number(item.plus) || 0,
        pro: Number(item.pro) || 0,
      }));
    }
    const map = new Map<string, { free: number; basic: number; plus: number; pro: number }>();
    defaultTimelineKeys.forEach(k => map.set(k, { free: 0, basic: 0, plus: 0, pro: 0 }));
    raw.forEach(item => {
      const k = normalizeDateKey(String(item.date || ''));
      if (k) {
        map.set(k, {
          free: Number(item.free) || 0,
          basic: Number(item.basic) || 0,
          plus: Number(item.plus) || 0,
          pro: Number(item.pro) || 0,
        });
      }
    });
    let last = { free: 0, basic: 0, plus: 0, pro: 0 };
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => {
        if (counts.free || counts.basic || counts.plus || counts.pro) {
          last = counts;
        }
        return { date, ...last };
      });
  }, [stats?.growthChartData, defaultTimelineKeys, normalizeDateKey]);

  const formatAxisDate = useCallback((val: string) => {
    if (!val) return '';
    const normalized = /^\d{4}-\d{2}$/.test(val) ? `${val}-01` : val;
    const parts = normalized.split('-').map(Number);
    const d = parts.length === 3 && !parts.some(isNaN)
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return timeRange === 'yearly'
      ? d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }, [timeRange]);

  const formatTooltipDate = useCallback((val: any) => {
    if (!val) return '';
    const str = String(val);
    const normalized = /^\d{4}-\d{2}$/.test(str) ? `${str}-01` : str;
    const parts = normalized.split('-').map(Number);
    const d = parts.length === 3 && !parts.some(isNaN)
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date(str);
    if (isNaN(d.getTime())) return str;
    return timeRange === 'yearly'
      ? d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  }, [timeRange]);

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
            
            {/* Global AI Toggle */}
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-theme-surface border border-theme-border rounded-xl ml-4 shadow-sm">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-theme-primary">Global AI Status</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${globalAiBlock ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {globalAiBlock ? 'Offline (Blocked)' : 'Online (Active)'}
                </span>
              </div>
              <button
                onClick={toggleGlobalAi}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-theme-base ${globalAiBlock ? 'bg-theme-surface-2 border border-theme-border' : 'bg-emerald-500'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${globalAiBlock ? 'translate-x-1 shadow-sm' : 'translate-x-6'}`} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="mr-1"><ThemeToggle /></div>
            <button 
              onClick={() => fetchDashboardData()}
              className="p-2 rounded-xl bg-theme-surface hover:bg-theme-surface-2 text-theme-muted transition-colors group"
              title="Refresh Data"
            >
              <RotateCw className="w-5 h-5 group-active:rotate-180 transition-transform duration-500" />
            </button>
            <Link 
              to="/hq-portal/notifications"
              className="p-2 rounded-xl bg-theme-surface hover:bg-theme-surface-2 text-theme-muted transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-theme-surface">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <button className="hidden md:flex p-2 rounded-xl bg-theme-surface hover:bg-theme-surface-2 text-theme-muted transition-colors">
              <Search className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          
          {/* Global Announcement Banner Settings */}
          <div className="glass-card p-6 border-theme-border mb-8 border-indigo-500/20 bg-indigo-500/5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-theme-primary flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-400" />
                  Global Site Announcement
                </h2>
                <p className="text-xs text-theme-muted mt-1">This message will be prominently displayed at the top of every page to all students.</p>
              </div>
              
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${globalBannerActive ? 'text-emerald-500' : 'text-theme-muted'}`}>
                  {globalBannerActive ? 'Active & Visible' : 'Hidden'}
                </span>
                <button
                  onClick={() => saveGlobalBanner(!globalBannerActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${globalBannerActive ? 'bg-emerald-500' : 'bg-theme-surface-2 border border-theme-border'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${globalBannerActive ? 'translate-x-6' : 'translate-x-1 shadow-sm'}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="e.g. 📢 Scheduled maintenance on Sunday at 2 AM..."
                value={globalBanner}
                onChange={(e) => setGlobalBanner(e.target.value)}
                className="flex-1 bg-theme-surface border border-theme-border rounded-xl px-4 py-2 text-sm text-theme-primary focus:border-indigo-500/50 outline-none"
              />
              <button
                onClick={() => saveGlobalBanner(globalBannerActive)}
                className={`px-6 py-2 text-white text-sm font-bold rounded-xl transition-all shadow-md ${isBannerSaving ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-indigo-500 hover:bg-indigo-600'}`}
              >
                {isBannerSaving ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
            {STATS_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className={`glass-card p-6 border ${card.border} transition-all hover:scale-[1.02] duration-300`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl ${card.bg} ${card.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-theme-muted mb-1">{card.label}</p>
                    <h3 className="text-2xl font-bold text-theme-primary tracking-tight">{card.value}</h3>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* Sales Chart */}
            <div className="glass-card p-4 md:p-6 border-theme-border">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-theme-primary">Revenue Insights</h2>
                  <p className="text-sm text-theme-muted font-medium">Total: GH₵ {Number(stats?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                
                <div className="flex items-center p-1 bg-theme-surface-2 border border-theme-border rounded-xl">
                  {[
                    { label: 'Daily', value: 'daily' },
                    { label: 'Weekly', value: 'weekly' },
                    { label: 'Monthly', value: 'monthly' },
                    { label: 'Yearly', value: 'yearly' }
                  ].map(r => (
                    <button
                      key={r.value}
                      onClick={() => setTimeRange(r.value)}
                      className={clsx(
                        "px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap",
                        timeRange === r.value 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                          : "text-theme-muted hover:text-theme-secondary"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={salesChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.75}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="var(--text-muted)" 
                      fontSize={10} 
                      axisLine={false}
                      tickLine={false}
                      minTickGap={16}
                      tick={{ fill: 'var(--text-muted)' }}
                      tickFormatter={formatAxisDate}
                    />
                    <YAxis 
                      stroke="var(--text-muted)" 
                      fontSize={10} 
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      tick={{ fill: 'var(--text-muted)' }}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
                      contentStyle={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-main)', borderRadius: '1rem', color: 'var(--text-primary)', fontSize: '11px', fontWeight: 'bold', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2)' }}
                      itemStyle={{ color: '#6366f1' }}
                      labelFormatter={formatTooltipDate}
                      formatter={(val: any) => [`GH₵${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']}
                    />
                    <Bar 
                      dataKey="revenue" 
                      fill="url(#barGradient)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={timeRange === 'monthly' ? 14 : 28}
                    >
                      {salesChartData.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Retention Chart */}
            <div className="glass-card p-4 md:p-6 border-theme-border">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-theme-primary">Student Retention</h2>
                <p className="text-sm text-theme-muted">Active vs Deleted Accounts</p>
              </div>
              <div className="h-64 w-full min-w-0 relative">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-theme-primary">{retentionTotal.toLocaleString()}</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-theme-muted">Total Users</span>
                </div>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={retentionChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={54}
                      outerRadius={82}
                      paddingAngle={retentionTotal > 0 ? 3 : 0}
                      dataKey="value"
                      stroke="none"
                    >
                      {retentionChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    {retentionTotal > 0 && (
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-main)', borderRadius: '1rem', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2)' }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                      />
                    )}
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                  <span className="text-xs text-theme-secondary">Active ({pieData[0].value})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className="text-xs text-theme-secondary">Deleted ({pieData[1].value})</span>
                </div>
              </div>
            </div>

            {/* Revenue Distribution */}
            <div className="glass-card p-4 md:p-6 border-theme-border">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-theme-primary">Revenue Breakdown</h2>
                <p className="text-sm text-theme-muted">GH₵ by Subscription Tier</p>
              </div>
              <div className="h-64 w-full min-w-0 relative">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-bold text-theme-primary">GH₵{revenueByPlanTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-theme-muted">Tier Total</span>
                </div>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={revenuePieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={54}
                      outerRadius={82}
                      paddingAngle={revenueByPlanTotal > 0 ? 3 : 0}
                      dataKey="value"
                      stroke="none"
                    >
                      {revenuePieChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    {revenueByPlanTotal > 0 && (
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-main)', borderRadius: '1rem', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                        formatter={(val: any) => `GH₵${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      />
                    )}
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {revenueByPlanData.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                    <span className="text-xs text-theme-secondary">{p.name} (GH₵{Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Usage Distribution */}
            <div className="glass-card p-4 md:p-6 border-theme-border">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-theme-primary">AI Query Distribution</h2>
                <p className="text-sm text-theme-muted">Total queries by Tier</p>
              </div>
              <div className="h-64 w-full min-w-0 relative">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-theme-primary">{aiUsageTotal.toLocaleString()}</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-theme-muted">AI Queries</span>
                </div>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={aiUsagePieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={54}
                      outerRadius={82}
                      paddingAngle={aiUsageTotal > 0 ? 3 : 0}
                      dataKey="value"
                      stroke="none"
                    >
                      {aiUsagePieChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    {aiUsageTotal > 0 && (
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-main)', borderRadius: '1rem', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                      />
                    )}
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {aiUsageData.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                    <span className="text-xs text-theme-secondary">{p.name} ({p.value.toLocaleString()})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Growth Chart (4 Lines) */}
          <div className="glass-card p-4 md:p-6 border-theme-border mb-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-theme-primary">User Acquisition by Plan</h2>
              <p className="text-sm text-theme-muted">Signups per subscription tier</p>
            </div>
            <div className="h-80 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={growthChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFree" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9ca3af" stopOpacity={0.2}/><stop offset="95%" stopColor="#9ca3af" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorBasic" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorPlus" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorPro" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="var(--text-muted)" 
                    fontSize={10} 
                    axisLine={false}
                    tickLine={false}
                    minTickGap={16}
                    tick={{ fill: 'var(--text-muted)' }}
                    tickFormatter={formatAxisDate}
                  />
                  <YAxis stroke="var(--text-muted)" fontSize={10} axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: 'var(--text-muted)' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-main)', borderRadius: '1rem', color: 'var(--text-primary)', fontSize: '11px' }}
                    itemStyle={{ fontWeight: 'bold' }}
                    labelFormatter={formatTooltipDate}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area type="monotone" name="Free" dataKey="free" stroke="#9ca3af" fillOpacity={1} fill="url(#colorFree)" strokeWidth={2.5} />
                  <Area type="monotone" name="Basic" dataKey="basic" stroke="#10b981" fillOpacity={1} fill="url(#colorBasic)" strokeWidth={2.5} />
                  <Area type="monotone" name="Plus" dataKey="plus" stroke="#6366f1" fillOpacity={1} fill="url(#colorPlus)" strokeWidth={2.5} />
                  <Area type="monotone" name="Pro" dataKey="pro" stroke="#f59e0b" fillOpacity={1} fill="url(#colorPro)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
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
                    {recentSignups.map((user) => (
                      <tr key={user.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface transition-colors">
                        <td className="py-3 text-sm text-theme-primary font-medium">{user.full_name}</td>
                        <td className="py-3 text-sm text-theme-muted">{user.email}</td>
                        <td className="py-3 text-sm">
                          <span className={`px-2 py-1 rounded-md text-xs font-semibold capitalize ${
                            user.plan === 'pro' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' :
                            user.plan === 'plus' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' :
                            user.plan === 'basic' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20' :
                            'bg-white/10 text-gray-300 border border-white/10'
                          }`}>
                            {user.plan}
                          </span>
                        </td>
                        <td className="py-3 text-sm text-theme-muted">{new Date(user.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="flex flex-col gap-3 md:hidden">
                {recentSignups.map((user) => (
                  <div key={user.id} className="flex items-center justify-between py-2 border-b border-theme-border">
                    <div>
                      <p className="text-sm text-theme-primary font-medium">{user.full_name}</p>
                      <p className="text-xs text-theme-muted">{new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold capitalize ${
                      user.plan === 'pro' ? 'bg-orange-500/20 text-orange-400' :
                      user.plan === 'plus' ? 'bg-indigo-500/20 text-indigo-400' :
                      user.plan === 'basic' ? 'bg-cyan-500/20 text-cyan-400' :
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
              <div className="flex items-center gap-2 mb-6">
                <div className="p-1.5 rounded-lg bg-rose-500/10">
                  <UserMinus className="w-4 h-4 text-rose-400" />
                </div>
                <h2 className="text-lg font-semibold text-theme-primary">Recent Deletions</h2>
              </div>
              <div className="relative mb-4 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted" />
                <input 
                  type="text" 
                  placeholder="Search deletions..." 
                  value={deletionsSearch}
                  onChange={(e) => setDeletionsSearch(e.target.value)}
                  className="w-full bg-theme-surface border border-theme-border rounded-lg py-1.5 pl-8 pr-3 text-xs text-theme-primary focus:outline-none focus:border-rose-500/50"
                />
              </div>
              <div className="flex flex-col gap-3">
                {(() => {
                  const items = deletions
                    .filter(d => !dismissedDeletions.includes(d.id?.toString() || d.email))
                    .filter(d => {
                      if (!deletionsSearch) return true;
                      const search = deletionsSearch.toLowerCase();
                      return (d.full_name?.toLowerCase().includes(search) || d.email?.toLowerCase().includes(search));
                    });
                  if (items.length === 0) {
                    return (
                      <p className="text-sm text-theme-muted text-center py-4">
                        {deletionsSearch ? `No matches for "${deletionsSearch}"` : 'No recent account deletions.'}
                      </p>
                    );
                  }
                  return items.slice(0, 5).map((d, i) => (
                    <div key={d.id || d.email || i} className="flex items-center justify-between p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 group transition-all hover:bg-rose-500/10">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 shrink-0">
                          <UserMinus className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-theme-primary truncate">{d.full_name}</p>
                          <p className="text-xs text-theme-muted">{d.plan} · {new Date(d.deleted_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDismissDeletion(d.id?.toString(), d.email)}
                        className="p-1.5 rounded-lg text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200"
                        title="Dismiss"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Failed Join Attempts */}
          <div className="grid grid-cols-1 gap-6 mt-6">
            <div className="glass-card p-4 md:p-6 border-theme-border">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <h2 className="text-lg font-semibold text-theme-primary">Failed Join Attempts</h2>
              </div>
              <div className="relative mb-4 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted" />
                <input 
                  type="text" 
                  placeholder="Search failed attempts..." 
                  value={failedSearch}
                  onChange={(e) => setFailedSearch(e.target.value)}
                  className="w-full bg-theme-surface border border-theme-border rounded-lg py-1.5 pl-8 pr-3 text-xs text-theme-primary focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div className="flex flex-col gap-3">
                {(() => {
                  const items = failedAccounts
                    .filter(f => !dismissedFailedAccounts.includes(f.id?.toString() || f.email))
                    .filter(f => {
                      if (!failedSearch) return true;
                      const search = failedSearch.toLowerCase();
                      return (f.full_name?.toLowerCase().includes(search) || f.email?.toLowerCase().includes(search) || f.reason?.toLowerCase().includes(search));
                    });
                  if (items.length === 0) {
                    return (
                      <p className="text-sm text-theme-muted text-center py-4">
                        {failedSearch ? `No matches for "${failedSearch}"` : 'No failed join attempts.'}
                      </p>
                    );
                  }
                  return items.slice(0, 5).map((f, i) => (
                    <div key={f.id || f.email || i} className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 group transition-all hover:bg-amber-500/10">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-theme-primary truncate">{f.full_name || 'No Name'}</p>
                          <p className="text-xs text-theme-muted truncate">{f.email} · <span className="text-amber-400 font-medium">{f.reason}</span> · {new Date(f.failed_at || f.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDismissFailed(f.id?.toString(), f.email)}
                        className="p-1.5 rounded-lg text-theme-muted hover:text-amber-400 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200"
                        title="Dismiss"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
