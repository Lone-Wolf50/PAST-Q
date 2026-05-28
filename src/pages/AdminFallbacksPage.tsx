import { useState, useEffect } from 'react';
import { 
  Shuffle, Trash2, Menu, CheckCircle2, XCircle, Search, 
  RefreshCw, ShieldAlert, ArrowRight, Activity, Cpu, 
  HelpCircle, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../lib/api';

interface Attempt {
  model_or_service: string;
  status: 'success' | 'failed';
  error_code?: string;
  error_message?: string;
  error_meaning?: string;
}

interface FallbackLog {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  metadata: {
    is_fallback: boolean;
    request_type: 'AI Chat' | 'OCR Pipeline' | 'Insights Generator';
    success: boolean;
    selected_model_or_service: string | null;
    attempts: Attempt[];
  };
}

const AdminFallbacksPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logs, setLogs] = useState<FallbackLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'AI Chat' | 'OCR Pipeline' | 'Insights Generator'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RESOLVED' | 'FAILED'>('ALL');
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token') ?? undefined;
      if (!token) return;
      const res = await apiFetch('/hq-management/fallbacks', { token });
      setLogs(res.fallbacks || []);
    } catch (err) {
      console.error('Failed to fetch fallback logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedLogs(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const deleteLog = async (id: string) => {
    setActionLoading(id);
    try {
      const token = localStorage.getItem('admin_token') ?? undefined;
      await apiFetch(`/hq-management/fallbacks/${id}`, { method: 'DELETE', token });
      setLogs(prev => prev.filter(log => log.id !== id));
    } catch (err) {
      console.error('Failed to delete fallback log:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const clearAllLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all model fallback logs? This action cannot be undone.')) return;
    setActionLoading('clear-all');
    try {
      const token = localStorage.getItem('admin_token') ?? undefined;
      await apiFetch('/hq-management/fallbacks', { method: 'DELETE', token });
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear fallback logs:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.metadata?.attempts?.some(a => 
        a.model_or_service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.error_message && a.error_message.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.error_meaning && a.error_meaning.toLowerCase().includes(searchQuery.toLowerCase()))
      );

    const matchesType = typeFilter === 'ALL' || log.metadata?.request_type === typeFilter;
    
    let matchesStatus = true;
    if (statusFilter === 'RESOLVED') {
      matchesStatus = log.metadata?.success === true;
    } else if (statusFilter === 'FAILED') {
      matchesStatus = log.metadata?.success === false;
    }

    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate statistics
  const totalEvents = logs.length;
  
  const chatLogs = logs.filter(l => l.metadata?.request_type === 'AI Chat');
  const chatSuccessCount = chatLogs.filter(l => l.metadata?.success === true).length;
  const chatResiliency = chatLogs.length > 0 
    ? Math.round((chatSuccessCount / chatLogs.length) * 100) 
    : 100;

  const ocrLogs = logs.filter(l => l.metadata?.request_type === 'OCR Pipeline');
  const ocrSuccessCount = ocrLogs.filter(l => l.metadata?.success === true).length;
  const ocrResiliency = ocrLogs.length > 0 
    ? Math.round((ocrSuccessCount / ocrLogs.length) * 100) 
    : 100;

  const quotaIssues = logs.filter(l => 
    l.metadata?.attempts?.some(a => a.error_code?.includes('429') || a.error_message?.includes('429'))
  ).length;

  return (
    <div className="min-h-screen bg-transparent flex font-sans">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Mobile Header */}
        <header className="sticky top-0 z-20 bg-transparent/85 backdrop-blur-xl border-b border-theme-border px-4 md:px-8 py-4 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl bg-theme-surface text-theme-secondary">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-theme-primary">Fallback Monitor</h1>
          </div>
        </header>
        
        <main className="flex-1 p-4 md:p-8 max-w-7xl">
          {/* Top Title and Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-theme-primary flex items-center gap-3">
                <Shuffle className="w-8 h-8 text-indigo-400 animate-pulse" />
                Model Fallback Monitor
              </h1>
              <p className="text-theme-muted mt-1">Track and inspect AI routing, API failovers, and cloud OCR resilience in real-time.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={fetchLogs} 
                className="p-2.5 rounded-xl bg-theme-surface hover:bg-theme-surface-2 border border-theme-border text-theme-primary hover:text-indigo-400 transition-all active:scale-95"
                title="Refresh Logs"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              
              <button 
                onClick={clearAllLogs}
                disabled={actionLoading === 'clear-all' || logs.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-xl transition-all font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Clear Logs
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Total Fallbacks */}
            <div className="glass-card p-6 border-theme-border relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-theme-muted">Total Fallback Events</span>
                  <h3 className="text-3xl font-bold text-theme-primary mt-2">{totalEvents}</h3>
                </div>
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
            </div>

            {/* Chat Resiliency */}
            <div className="glass-card p-6 border-theme-border relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-theme-muted">Chat Resiliency</span>
                  <h3 className="text-3xl font-bold text-theme-primary mt-2">{chatResiliency}%</h3>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Cpu className="w-5 h-5" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
            </div>

            {/* OCR Resiliency */}
            <div className="glass-card p-6 border-theme-border relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-theme-muted">OCR Resiliency</span>
                  <h3 className="text-3xl font-bold text-theme-primary mt-2">{ocrResiliency}%</h3>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
            </div>

            {/* Quota Exceeded Outages */}
            <div className="glass-card p-6 border-theme-border relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-theme-muted">Rate Limits Hit</span>
                  <h3 className="text-3xl font-bold text-theme-primary mt-2">{quotaIssues}</h3>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
            </div>
          </div>

          {/* Filter Bar */}
          <div className="glass-card p-4 border-theme-border mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models, errors, or codes..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-theme-surface border border-theme-border focus:border-indigo-500 text-sm text-theme-primary focus:outline-none transition-all placeholder:text-theme-muted"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 bg-theme-surface p-1 rounded-xl border border-theme-border">
                {(['ALL', 'AI Chat', 'OCR Pipeline', 'Insights Generator'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      typeFilter === type
                        ? 'bg-indigo-500/10 text-indigo-400 shadow-sm'
                        : 'text-theme-muted hover:text-theme-primary'
                    }`}
                  >
                    {type === 'ALL' ? 'All Types' : type}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 bg-theme-surface p-1 rounded-xl border border-theme-border">
                {(['ALL', 'RESOLVED', 'FAILED'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      statusFilter === status
                        ? status === 'RESOLVED'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : status === 'FAILED'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-indigo-500/10 text-indigo-400'
                        : 'text-theme-muted hover:text-theme-primary'
                    }`}
                  >
                    {status === 'ALL' ? 'All Outcomes' : status === 'RESOLVED' ? 'Resolved' : 'Failed'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Logs List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-theme-muted">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mb-3" />
              <p className="font-medium">Loading fallback monitoring logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="glass-card p-12 text-center text-theme-muted border-theme-border">
              <HelpCircle className="w-12 h-12 mx-auto mb-4 text-indigo-400/50" />
              <h3 className="text-lg font-bold text-theme-primary mb-1">No Fallback Logs Found</h3>
              <p className="text-sm text-theme-muted max-w-md mx-auto">
                {logs.length === 0 
                  ? 'All services are functioning perfectly on primary models! No fallback events have been recorded yet.'
                  : 'No logs match your current search queries or filter settings. Try clearing your filters.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredLogs.map((log) => {
                const isExpanded = !!expandedLogs[log.id];
                const requestType = log.metadata?.request_type || 'AI Request';
                const isSuccess = log.metadata?.success !== false;
                const attempts = log.metadata?.attempts || [];
                
                return (
                  <div 
                    key={log.id} 
                    className={`glass-card border border-theme-border transition-all duration-300 ${
                      isExpanded ? 'bg-theme-surface/30' : 'hover:bg-theme-surface/10'
                    }`}
                  >
                    {/* Header Summary Row */}
                    <div 
                      onClick={() => toggleExpand(log.id)}
                      className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <div className={`p-2.5 rounded-xl shrink-0 ${
                          isSuccess
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                            : 'bg-red-500/10 text-red-400 border border-red-500/10'
                        }`}>
                          <Shuffle className="w-5 h-5" />
                        </div>
                        
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              requestType === 'AI Chat'
                                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/10'
                                : requestType === 'OCR Pipeline'
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/10'
                                : 'bg-violet-500/15 text-violet-400 border border-violet-500/10'
                            }`}>
                              {requestType}
                            </span>
                            <span className="text-xs text-theme-muted">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          
                          <h3 className="text-base font-bold text-theme-primary mt-1 truncate">{log.title}</h3>
                          <p className="text-sm text-theme-muted mt-0.5 truncate">{log.message}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-4">
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-theme-muted">Final Outcome</p>
                          <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                            {isSuccess ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span className="text-sm font-semibold text-emerald-400">Resolved</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 text-red-400" />
                                <span className="text-sm font-semibold text-red-400">Failed</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteLog(log.id);
                            }}
                            disabled={actionLoading === log.id}
                            className="p-2 rounded-xl bg-theme-surface hover:bg-red-500/10 text-theme-muted hover:text-red-400 border border-theme-border hover:border-red-500/25 transition-all"
                            title="Dismiss Log"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                          
                          <div className="p-2 text-theme-muted">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Fallback Steps */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-3 border-t border-theme-border/50 bg-theme-surface/5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-theme-muted mb-4">
                          Routing Execution Chain ({attempts.length} attempts)
                        </h4>
                        
                        <div className="flex flex-col gap-4 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-theme-border">
                          {attempts.map((attempt, index) => {
                            const isAttemptSuccess = attempt.status === 'success';
                            
                            return (
                              <div key={index} className="relative group">
                                {/* Bullet indicator */}
                                <div className={`absolute -left-6.5 top-1 w-3.5 h-3.5 rounded-full border-2 bg-theme-base z-10 transition-transform ${
                                  isAttemptSuccess 
                                    ? 'border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)] scale-110' 
                                    : 'border-red-400/50'
                                }`} />
                                
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-sm font-bold ${
                                        isAttemptSuccess ? 'text-emerald-400' : 'text-theme-secondary'
                                      }`}>
                                        Attempt #{index + 1}: {attempt.model_or_service}
                                      </span>
                                      
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                        isAttemptSuccess 
                                          ? 'bg-emerald-500/10 text-emerald-400' 
                                          : 'bg-red-500/10 text-red-400'
                                      }`}>
                                        {attempt.status}
                                      </span>
                                    </div>

                                    {/* Error Details */}
                                    {!isAttemptSuccess && (
                                      <div className="mt-2 pl-3 border-l-2 border-red-500/20 max-w-3xl">
                                        <div className="flex items-center gap-2">
                                          <span className="px-1.5 py-0.5 rounded bg-theme-surface border border-theme-border text-[10px] font-mono text-red-400 font-semibold">
                                            CODE: {attempt.error_code || 'UNKNOWN'}
                                          </span>
                                          <span className="text-xs font-semibold text-theme-primary">
                                            {attempt.error_meaning || 'Service connection error.'}
                                          </span>
                                        </div>
                                        {attempt.error_message && (
                                          <p className="text-[11px] font-mono text-theme-muted mt-1 select-all">
                                            {attempt.error_message}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {index < attempts.length - 1 && (
                                    <div className="text-[10px] font-black tracking-widest text-indigo-400 uppercase flex items-center gap-1 mt-1 md:mt-0 shrink-0">
                                      <span>Failover Route</span>
                                      <ArrowRight className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminFallbacksPage;
