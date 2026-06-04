import { useState, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { Send, Mail, AlertTriangle, CheckCircle2, Loader2, Users, FileText, Type, AlignLeft, User, X, Plus, Save, Trash2, Bell } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../lib/api';

const AdminBroadcastPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize state from localStorage draft if present
  const [subject, setSubject] = useState(() => localStorage.getItem('broadcast_draft_subject') || '');
  const [title, setTitle] = useState(() => localStorage.getItem('broadcast_draft_title') || '');
  const [body, setBody] = useState(() => localStorage.getItem('broadcast_draft_body') || '');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ total: number; sent: number; failed: number; errors?: string[] } | null>(null);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendInAppNotification, setSendInAppNotification] = useState(false);

  // Individual mode
  const [mode, setMode] = useState<'broadcast' | 'individual'>(() => 
    (localStorage.getItem('broadcast_draft_mode') as 'broadcast' | 'individual') || 'broadcast'
  );
  const [recipientInput, setRecipientInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('broadcast_draft_recipients');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [blockerOpen, setBlockerOpen] = useState(false);

  const isDirty = !!(subject.trim() || title.trim() || body.trim() || recipients.length > 0);

  // Auto-save changes to localStorage
  useEffect(() => {
    if (isDirty) {
      localStorage.setItem('broadcast_draft_subject', subject);
      localStorage.setItem('broadcast_draft_title', title);
      localStorage.setItem('broadcast_draft_body', body);
      localStorage.setItem('broadcast_draft_mode', mode);
      localStorage.setItem('broadcast_draft_recipients', JSON.stringify(recipients));
    } else {
      localStorage.removeItem('broadcast_draft_subject');
      localStorage.removeItem('broadcast_draft_title');
      localStorage.removeItem('broadcast_draft_body');
      localStorage.removeItem('broadcast_draft_mode');
      localStorage.removeItem('broadcast_draft_recipients');
    }
  }, [subject, title, body, mode, recipients, isDirty]);

  // Window unload warning (browser close / tab refresh)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Client-side router navigation blocker
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setBlockerOpen(true);
    }
  }, [blocker.state]);

  const handleSaveDraft = () => {
    localStorage.setItem('broadcast_draft_subject', subject);
    localStorage.setItem('broadcast_draft_title', title);
    localStorage.setItem('broadcast_draft_body', body);
    localStorage.setItem('broadcast_draft_mode', mode);
    localStorage.setItem('broadcast_draft_recipients', JSON.stringify(recipients));
    setBlockerOpen(false);
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  };

  const handleClearAll = () => {
    setSubject('');
    setTitle('');
    setBody('');
    setRecipients([]);
    localStorage.removeItem('broadcast_draft_subject');
    localStorage.removeItem('broadcast_draft_title');
    localStorage.removeItem('broadcast_draft_body');
    localStorage.removeItem('broadcast_draft_mode');
    localStorage.removeItem('broadcast_draft_recipients');
    setBlockerOpen(false);
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  };

  const handleStay = () => {
    setBlockerOpen(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  const addRecipient = () => {
    const email = recipientInput.trim().toLowerCase();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !recipients.includes(email)) {
      setRecipients([...recipients, email]);
      setRecipientInput('');
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addRecipient();
    }
  };

  const handleSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    setError('');
    setResult(null);

    try {
      const token = localStorage.getItem('admin_token')!;
      const payload: any = { subject, title, body, sendInAppNotification };
      if (mode === 'individual') {
        payload.recipients = recipients;
      }
      const data = await apiFetch('/hq-management/broadcast', {
        method: 'POST',
        token,
        body: payload,
      });
      setResult({ total: data.total, sent: data.sent, failed: data.failed, errors: data.errors });
      setSubject('');
      setTitle('');
      setBody('');
      setSendInAppNotification(false);
      if (mode === 'individual') setRecipients([]);
    } catch (err: any) {
      setError(err.message || 'Failed to send broadcast.');
    } finally {
      setSending(false);
    }
  };

  const canSend = subject.trim() && title.trim() && body.trim() && !sending && (mode === 'broadcast' || recipients.length > 0);

  return (
    <div className="min-h-screen bg-theme-base flex">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-64">
        {/* Top Bar */}
        <div className="sticky top-0 z-30 bg-theme-base/80 backdrop-blur-xl border-b border-theme-border">
          <div className="flex items-center gap-4 px-6 py-4 max-w-5xl mx-auto">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-theme-muted hover:text-theme-primary rounded-xl hover:bg-theme-surface transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-theme-primary">Broadcast Email</h1>
                <p className="text-xs text-theme-muted">Send a message to students</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

          {/* Mode Toggle */}
          <div className="bg-theme-surface/50 border border-theme-border rounded-2xl p-1.5 flex">
            <button
              onClick={() => setMode('broadcast')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                mode === 'broadcast'
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 shadow-sm'
                  : 'text-theme-secondary hover:text-theme-primary'
              }`}
            >
              <Users className="w-4 h-4" />
              All Students
            </button>
            <button
              onClick={() => setMode('individual')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                mode === 'individual'
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20 shadow-sm'
                  : 'text-theme-secondary hover:text-theme-primary'
              }`}
            >
              <User className="w-4 h-4" />
              Individual
            </button>
          </div>

          {/* Info Card */}
          <div className={`${mode === 'broadcast' ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-purple-500/5 border-purple-500/10'} border rounded-2xl p-5 flex items-start gap-4`}>
            {mode === 'broadcast' ? (
              <Users className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
            ) : (
              <User className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className={`text-sm ${mode === 'broadcast' ? 'text-indigo-300' : 'text-purple-300'} font-medium`}>
                {mode === 'broadcast'
                  ? "This message will be sent to every verified student's email address."
                  : 'Send a targeted email to specific recipients.'}
              </p>
              <p className="text-xs text-theme-muted mt-1">
                {mode === 'broadcast'
                  ? 'Emails are sent in batches to avoid rate limits. Large audiences may take a few minutes.'
                  : 'Add one or more email addresses below. Press Enter or comma to add.'}
              </p>
            </div>
          </div>

          {/* Recipients Input (Individual mode only) */}
          {mode === 'individual' && (
            <div className="bg-theme-surface/50 border border-theme-border rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-theme-border flex items-center gap-2">
                <User className="w-4 h-4 text-theme-secondary" />
                <span className="text-sm font-bold text-theme-secondary">Recipients</span>
                {recipients.length > 0 && (
                  <span className="ml-auto text-xs px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-full font-bold">{recipients.length}</span>
                )}
              </div>
              <div className="p-5 space-y-3">
                <div className="flex gap-2">
                  <input
                    id="recipient-input"
                    type="email"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter email address..."
                    className="flex-1 px-4 py-3 bg-theme-base/60 border border-theme-border rounded-xl text-theme-primary font-medium placeholder:text-theme-muted/70 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all text-sm"
                  />
                  <button
                    onClick={addRecipient}
                    disabled={!recipientInput.trim()}
                    className="px-4 py-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {recipients.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {recipients.map((email) => (
                      <span key={email} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/15 text-purple-300 rounded-lg text-xs font-medium">
                        {email}
                        <button onClick={() => removeRecipient(email)} className="text-purple-400/60 hover:text-red-400 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compose Form */}
          <div className="bg-theme-surface/50 border border-theme-border rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-theme-border flex items-center gap-2">
              <FileText className="w-4 h-4 text-theme-secondary" />
              <span className="text-sm font-bold text-theme-secondary">Compose Message</span>
              {isDirty && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-0.5 rounded-full animate-pulse">
                  <Save className="w-3.5 h-3.5" />
                  Draft auto-saved
                </span>
              )}
            </div>

            <div className="p-5 space-y-5">
              {/* Subject */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-theme-secondary uppercase tracking-wider">
                  <Type className="w-3.5 h-3.5" />
                  Email Subject
                </label>
                <input
                  id="broadcast-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Important Update from PastQ"
                  className="w-full px-4 py-3 bg-theme-base/60 border border-theme-border rounded-xl text-theme-primary font-medium placeholder:text-theme-muted/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all text-sm"
                />
              </div>

              {/* Title (header inside the email) */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-theme-secondary uppercase tracking-wider">
                  <Type className="w-3.5 h-3.5" />
                  Email Title
                </label>
                <input
                  id="broadcast-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. New Features Available"
                  className="w-full px-4 py-3 bg-theme-base/60 border border-theme-border rounded-xl text-theme-primary font-medium placeholder:text-theme-muted/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all text-sm"
                />
                <p className="text-[11px] text-theme-secondary font-medium">Shown in the email header banner alongside the PastQ logo.</p>
              </div>

              {/* Body */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-theme-secondary uppercase tracking-wider">
                  <AlignLeft className="w-3.5 h-3.5" />
                  Message Body
                </label>
                <textarea
                  id="broadcast-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message here. Line breaks will be preserved in the email..."
                  rows={8}
                  className="w-full px-4 py-3 bg-theme-base/60 border border-theme-border rounded-xl text-theme-primary font-medium placeholder:text-theme-muted/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all text-sm resize-none leading-relaxed"
                />
              </div>

              {/* Send In-App Notification Option */}
              <div className="flex items-center gap-3 pt-4 border-t border-theme-border/30">
                <input
                  id="broadcast-in-app-notification"
                  type="checkbox"
                  checked={sendInAppNotification}
                  onChange={(e) => setSendInAppNotification(e.target.checked)}
                  className="w-4 h-4 rounded border-theme-border bg-theme-base/60 text-indigo-500 focus:ring-indigo-500/30 transition-all cursor-pointer"
                />
                <label
                  htmlFor="broadcast-in-app-notification"
                  className="text-xs font-bold text-theme-secondary uppercase tracking-wider cursor-pointer select-none flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5 text-indigo-400" />
                  Also Send as In-App Notification (Student Dashboard)
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-theme-border flex items-center justify-between">
              <p className="text-xs text-theme-secondary font-bold">
                {canSend ? '✓ Ready to send' : mode === 'individual' && recipients.length === 0 ? 'Add at least one recipient' : 'Fill in all fields to continue'}
              </p>
              <button
                id="broadcast-send-btn"
                onClick={() => setConfirmOpen(true)}
                disabled={!canSend}
                className={`flex items-center gap-2 px-5 py-2.5 ${mode === 'individual' ? 'bg-purple-500 hover:bg-purple-600 shadow-purple-500/20 hover:shadow-purple-500/30' : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20 hover:shadow-indigo-500/30'} disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-all shadow-lg`}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {mode === 'individual' ? `Send to ${recipients.length || 0}` : 'Send Broadcast'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Confirmation Modal */}
          {confirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-theme-surface border border-theme-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-theme-primary">
                      {mode === 'individual' ? 'Confirm Email' : 'Confirm Broadcast'}
                    </h3>
                    <p className="text-xs text-theme-muted">This action cannot be undone</p>
                  </div>
                </div>
                <p className="text-sm text-theme-secondary mb-6 leading-relaxed">
                  {mode === 'individual' ? (
                    <>This will send an email to <strong className="text-purple-400">{recipients.length} recipient(s)</strong>. Are you sure?</>
                  ) : (
                    <>This will send an email to <strong className="text-indigo-400">all verified students</strong>. Are you sure you want to proceed?</>
                  )}
                </p>
                {mode === 'individual' && recipients.length > 0 && (
                  <div className="mb-4 bg-theme-base/50 border border-theme-border rounded-xl p-3 max-h-24 overflow-y-auto">
                    {recipients.map((e) => (
                      <p key={e} className="text-xs text-theme-muted font-mono">{e}</p>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 justify-end">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-theme-muted hover:text-theme-primary rounded-xl hover:bg-theme-base/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    className={`flex items-center gap-2 px-5 py-2.5 ${mode === 'individual' ? 'bg-purple-500 hover:bg-purple-600 shadow-purple-500/20' : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20'} text-white rounded-xl font-semibold text-sm transition-all shadow-lg`}
                  >
                    <Send className="w-4 h-4" />
                    {mode === 'individual' ? 'Yes, Send' : 'Yes, Send to All'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Unsaved Changes Blocker Modal */}
          {blockerOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-theme-surface border border-theme-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Save className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-theme-primary">Unsaved Email Changes</h3>
                    <p className="text-xs text-theme-muted">You are about to leave this page</p>
                  </div>
                </div>
                
                <p className="text-sm text-theme-secondary mb-6 leading-relaxed">
                  Would you like to save your composed message as a draft to resume later, discard the changes, or stay on this page?
                </p>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleSaveDraft}
                    className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Save as Draft & Leave
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl font-semibold text-sm transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear All & Leave
                  </button>
                  <button
                    onClick={handleStay}
                    className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-theme-base/60 hover:bg-theme-base border border-theme-border text-theme-muted hover:text-theme-primary rounded-xl font-semibold text-sm transition-all cursor-pointer"
                  >
                    Keep Editing (Stay)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-5 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-300">Send Failed</p>
                <p className="text-xs text-theme-muted mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    {mode === 'individual' ? 'Email Sent!' : 'Broadcast Complete!'}
                  </p>
                  <p className="text-xs text-theme-muted mt-1">Your message has been delivered.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-theme-base/50 border border-theme-border rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-theme-primary">{result.total}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted mt-1">Total</p>
                </div>
                <div className="bg-theme-base/50 border border-emerald-500/10 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{result.sent}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted mt-1">Sent</p>
                </div>
                <div className="bg-theme-base/50 border border-red-500/10 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-400">{result.failed}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted mt-1">Failed</p>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="mt-4 bg-red-500/5 border border-red-500/10 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-300 mb-2">Failed deliveries (first 10):</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-[11px] text-theme-muted font-mono">{e}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sending Progress Overlay */}
          {sending && (
            <div className="bg-theme-surface/50 border border-theme-border rounded-2xl p-8 text-center animate-in fade-in">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-4" />
              <p className="text-sm font-semibold text-theme-primary">Sending emails...</p>
              <p className="text-xs text-theme-muted mt-2">
                {mode === 'individual'
                  ? `Sending to ${recipients.length} recipient(s)...`
                  : 'This may take a few minutes depending on the number of students.'}
              </p>
              <div className="mt-4 w-48 mx-auto h-1 bg-theme-base rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminBroadcastPage;
