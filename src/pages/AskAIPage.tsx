import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Loader2, Paperclip, Sparkles, GraduationCap,
  RotateCcw, Menu, X, Trash2, Plus, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import { clsx } from 'clsx';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { ConfirmModal } from '../components/ui/ConfirmModal';

// ─── Types ───────────────────────────────────────────────────────────────────

type Plan = 'Free' | 'Basic' | 'Plus' | 'Pro';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachmentName?: string;
}

interface Conversation {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
  expires_at: string;
}

// ─── Plan Config ─────────────────────────────────────────────────────────────

const PLAN_LIMITS: Record<Plan, number> = {
  Free: 5,
  Basic: 10,
  Plus: Infinity,
  Pro: Infinity,
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: "Hello! I'm **PastQ Advanced AI**, your personal academic tutor. I can help you understand concepts from past papers, summarize topics, and guide your exam preparation.\n\nWhat would you like to study today?",
    timestamp: Date.now(),
  }
];

const STARTER_QUESTIONS = [
  "Explain the Second Law of Thermodynamics",
  "Help me summarize key accounting principles",
  "Walk me through solving this calculus problem step by step",
  "Give me an outline for a Business Law essay on contracts",
];

// ─── Main Page ────────────────────────────────────────────────────────────────

const AskAIPage = () => {
  const LOADING_MESSAGES = [
    "Analyzing your question...",
    "Scanning course materials...",
    "Reviewing past papers...",
    "Connecting concepts...",
    "Formulating the best response...",
    "Organizing the answer..."
  ];

  const { user, token, updateUser } = useAuth();
  const rawPlan = user?.plan || 'Free';
  const plan = (rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1).toLowerCase()) as Plan;

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('pastq_ai_messages');
      return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
    } catch {
      return INITIAL_MESSAGES;
    }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [usageCount, setUsageCount] = useState(0);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  // History state (Plus/Pro only)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    // If we arrived with a paperId, prefer the paper-specific conv over the generic last-conv
    const paperId = new URLSearchParams(window.location.search).get('paperId');
    if (paperId) {
      const paperConv = localStorage.getItem(`pastq_paper_conv_${paperId}`);
      if (paperConv) return paperConv;
    }
    return localStorage.getItem('pastq_ai_active_conv');
  });
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchParams] = useSearchParams();
  const initialPaperId = searchParams.get('paperId');

  const [activePaperId, setActivePaperId] = useState<string | null>(initialPaperId);

  useEffect(() => {
    if (initialPaperId && token) {
      const fetchPaperMeta = async () => {
        try {
          const res = await apiFetch(`/papers/${initialPaperId}`, { token });
          setSelectedFileName(res.paper.title);
        } catch (err) {

        }
      };
      fetchPaperMeta();

      // For Plus/Pro: auto-restore existing conversation for this paper
      const existingConvId = localStorage.getItem(`pastq_paper_conv_${initialPaperId}`);
      if (existingConvId && (plan === 'Plus' || plan === 'Pro')) {
        setActiveConversationId(existingConvId);
        // Load the messages for that conversation
        apiFetch(`/ai/conversations/${existingConvId}`, { token })
          .then((res) => {
            const loaded: Message[] = (res.messages ?? []).map((m: any) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              timestamp: new Date(m.created_at).getTime(),
            }));
            if (loaded.length) setMessages(loaded);
          })
          .catch(() => {
            // Conversation may have expired — clear the mapping
            localStorage.removeItem(`pastq_paper_conv_${initialPaperId}`);
            setActiveConversationId(null);
            setMessages(INITIAL_MESSAGES);
          });
      } else {
        // If there is no existing conversation for this new paper, we must reset the chat state
        // Otherwise, it will keep the messages from the previously viewed paper!
        setActiveConversationId(null);
        setMessages(INITIAL_MESSAGES);
      }
    }
  }, [initialPaperId, token, plan]);

  // Keep activePaperId in sync with the URL
  useEffect(() => {
    setActivePaperId(initialPaperId);
  }, [initialPaperId]);

  // Sync user plan on mount (to handle upgrades without re-login)
  useEffect(() => {
    const refreshProfile = async () => {
      if (!token) return;
      try {
        const { user: latestUser } = await apiFetch('/profile/me', { token });
        if (latestUser.plan !== user?.plan) {
          updateUser({ plan: latestUser.plan });
        }
      } catch (err) {

      }
    };
    refreshProfile();
  }, [token, user?.plan, updateUser]);

  // Persist messages to localStorage
  useEffect(() => {
    localStorage.setItem('pastq_ai_messages', JSON.stringify(messages));
  }, [messages]);

  // Persist active conversation to localStorage
  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem('pastq_ai_active_conv', activeConversationId);
    } else {
      localStorage.removeItem('pastq_ai_active_conv');
    }
  }, [activeConversationId]);

  // Sync usage count on mount
  useEffect(() => {
    const fetchUsage = async () => {
      if (!token) return;
      try {
        const res = await apiFetch('/ai/usage', { token });
        setUsageCount(res.usageCount);
      } catch (err) {

      }
    };
    fetchUsage();
  }, [token]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Rotate loading text
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
    } else {
      setLoadingMsgIdx(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Initial access check
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const res = await apiFetch('/ai/status', { token: token! });
        if (res.isMaintenance) {
          setIsMaintenance(true);
          setMaintenanceMsg(res.message);
        }
      } catch (err: any) {
        const errBody = err?.body;
        if (errBody?.isMaintenance) {
          setIsMaintenance(true);
          setMaintenanceMsg(errBody.message);
        }
      }
    };
    if (token) checkAccess();
  }, [token]);

  // Load conversation history for Plus/Pro
  const fetchConversations = useCallback(async () => {
    if (!token) return;
    setIsHistoryLoading(true);
    try {
      const res = await apiFetch('/ai/conversations', { token });
      setConversations(res.conversations ?? []);
    } catch (err: any) {
      // If history is unavailable (Free/Basic), we just set an empty list
      if (err?.status === 403 || err?.body?.error === 'history_unavailable') {
        setConversations([]);
      } else {

      }
    } finally {
      setIsHistoryLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const loadConversation = async (conv: Conversation) => {
    setActiveConversationId(conv.id);
    setSidebarOpen(false);
    try {
      const res = await apiFetch(`/ai/conversations/${conv.id}`, { token: token! });
      const loaded: Message[] = (res.messages ?? []).map((m: any) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at).getTime(),
      }));
      setMessages(loaded.length ? loaded : INITIAL_MESSAGES);
    } catch {
      setMessages(INITIAL_MESSAGES);
    }
  };

  const deleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    setDeletingId(convId);
    try {
      await apiFetch(`/ai/conversations/${convId}`, { method: 'DELETE', token: token! });
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        setMessages(INITIAL_MESSAGES);
        // Also clear any paper→conv mapping that pointed to this conversation
        if (activePaperId) {
          localStorage.removeItem(`pastq_paper_conv_${activePaperId}`);
        }
      }
    } catch {
      // silently ignore
    } finally {
      setDeletingId(null);
    }
  };

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages(INITIAL_MESSAGES);
    setInput('');
    setSelectedFile(null);
    setSelectedFileName('');
    setSidebarOpen(false);
    localStorage.removeItem('pastq_ai_messages');
    localStorage.removeItem('pastq_ai_active_conv');
    // Clear the paper-specific conv mapping so the next visit creates a fresh conversation
    if (activePaperId) {
      localStorage.removeItem(`pastq_paper_conv_${activePaperId}`);
    }
  };

  // Helpers
  const daysUntilExpiry = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const relativeTime = (iso: string | null) => {
    if (!iso) return 'Just now';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return 'Just now';
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? 'Yesterday' : `${days}d ago`;
  };

  // (Optional) Could use effect to auto-reset usage based on limits, etc.

  const canSend =
    !isMaintenance && (
      (plan === 'Free' && usageCount < 5) ||
      (plan === 'Basic' && usageCount < 10) ||
      plan === 'Plus' ||
      plan === 'Pro'
    );

  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading || !canSend) return;

    setIsLoading(true);
    let fileDataStr = '';
    let mimeTypeStr = '';
    let convId = activeConversationId;

    try {
      if (selectedFile) {
        const reader = new FileReader();
        const fileReadPromise = new Promise<void>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const parts = result.split(',');
            if (parts.length === 2) {
              fileDataStr = parts[1];
              mimeTypeStr = selectedFile.type || 'application/pdf';
            }
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
        await fileReadPromise;
      }

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
        attachmentName: selectedFileName || undefined,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput('');
      setUsageCount(prev => prev + 1);

      // Only send actual conversation history (not the welcome message)
      const history = updatedMessages
        .filter(m => m.id !== 'welcome')
        .slice(0, -1) // exclude the message we just added (it's passed as `message`)
        .map(m => ({ role: m.role, content: m.content }));

      // Clear the file selection UI immediately after reading it into memory
      setSelectedFile(null);
      setSelectedFileName('');

      // If Plus/Pro and no active conversation yet, create one now
      if ((plan === 'Plus' || plan === 'Pro') && !convId) {
        try {
          const newConv = await apiFetch('/ai/conversations', {
            method: 'POST',
            token: token!,
            body: { title: content.slice(0, 80) },
          });
          convId = newConv.id;
          setActiveConversationId(convId);
          // Add to local state instantly for responsiveness
          setConversations(prev => [newConv, ...prev]);
          // If this chat was started from a paper, remember the conv for that paper
          if (activePaperId) {
            localStorage.setItem(`pastq_paper_conv_${activePaperId}`, convId!);
          }
        } catch (err) {

          // If creation fails, we still allow the chat but it won't be saved
        }
      }

      const res = await apiFetch('/ai/chat', {
        method: 'POST',
        token: token!,
        body: {
          message: content,
          history,
          fileData: fileDataStr || undefined,
          fileMimeType: mimeTypeStr || undefined,
          paperId: activePaperId || undefined,
          conversationId: convId || undefined,
        },
      });

      // Backend signals a quota error via structured JSON (not an exception)
      if (res?.error === 'quota_exceeded') {
        if (res.isMaintenance) {
          setIsMaintenance(true);
          setMaintenanceMsg(res.message);
          return;
        }
        const quotaMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: res.message ||
            '⚠️ The AI service is temporarily unavailable due to quota limits. Please try again later.',
          timestamp: Date.now(),
        };
        setUsageCount(prev => prev - 1);
        setMessages(prev => [...prev, quotaMsg]);
        return;
      }

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.reply || 'Sorry, I was unable to process that.',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMsg]);
      // Refresh conversation list so title/timestamp updates in sidebar
      if (convId && (plan === 'Plus' || plan === 'Pro')) {
        fetchConversations();
      }
    } catch (err: any) {
      // Refund usage and restore input on network / unexpected errors
      setUsageCount(prev => prev - 1);
      setInput(content);
      setMessages(messages);

      // Try to show a friendly inline message rather than a raw alert
      const errBody = err?.body ?? err?.response;
      if (errBody?.error === 'quota_exceeded' || errBody?.error === 'ai_disabled') {
        if (errBody.isMaintenance) {
          setIsMaintenance(true);
          setMaintenanceMsg(errBody.message);
        } else {
          const alertMsg: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: errBody.message || '⚠️ Your AI access has been temporarily restricted.',
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, alertMsg]);
        }
      } else {
        const friendly: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            '❌ I was unable to connect to the AI service right now. Please check your connection and try again.',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, friendly]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input.trim());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (plan === 'Free') {
      alert("Upgrade to Basic to upload and analyze files with AI!");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert("File is too large. Limit is 10MB.");
        return;
      }
      setSelectedFile(file);
      setSelectedFileName(file.name);
    }
  };

  const handleReset = () => {
    setShowConfirmReset(true);
  };

  const confirmReset = () => {
    setMessages(INITIAL_MESSAGES);
    localStorage.removeItem('pastq_ai_messages');
    localStorage.removeItem('pastq_ai_active_conv');
    setShowConfirmReset(false);
  };

  const limit = PLAN_LIMITS[plan];

  return (
    <div className="w-full h-[calc(100dvh-72px)] flex overflow-hidden bg-theme-base">

      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={clsx(
        "fixed md:static inset-y-0 left-0 w-72 shrink-0 flex flex-col gap-3 p-3 bg-theme-surface/50 backdrop-blur-xl z-50 transition-transform duration-300 shadow-2xl md:shadow-none border-r border-theme-border",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 hidden md:flex"
      )}>
        {/* Top Info Card */}
        <div className="bg-theme-surface-2 border border-theme-border rounded-xl p-3 shadow-sm shrink-0">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                Q
              </div>
              <h1 className="text-lg font-bold tracking-tight text-theme-primary">PastQ Advanced AI</h1>
            </div>
            <button className="md:hidden p-2 text-theme-muted" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-theme-surface border-2 border-theme-border shadow-inner flex items-center justify-center overflow-hidden">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                  {user?.full_name?.charAt(0).toUpperCase() || 'S'}
                </div>
              )}
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-sm text-theme-primary truncate">{user?.full_name || 'Student'}</p>
              <p className="text-[10px] text-theme-muted uppercase font-bold tracking-wider">{plan} Member</p>
            </div>
          </div>
        </div>

        {(plan === 'Plus' || plan === 'Pro') && (
          <button
            onClick={startNewChat}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/25 shrink-0"
          >
            <Plus size={16} />
            New Conversation
          </button>
        )}

        {/* History Area */}
        {(plan === 'Plus' || plan === 'Pro') && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <label className="text-[10px] uppercase font-bold text-theme-muted tracking-wider">
                Recent Chats
              </label>
              {isHistoryLoading && <Loader2 size={12} className="animate-spin text-theme-muted" />}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
              {conversations.length === 0 && !isHistoryLoading && (
                <div className="py-8 px-4 text-center bg-theme-surface-2/30 rounded-2xl border border-dashed border-theme-border/50">
                  <p className="text-[10px] text-theme-muted font-medium leading-relaxed">
                    No recent chats found. Start a new one above!
                  </p>
                </div>
              )}
              {conversations.map((conv) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => loadConversation(conv)}
                  onKeyDown={(e) => e.key === 'Enter' && loadConversation(conv)}
                  tabIndex={0}
                  role="button"
                  className={clsx(
                    "w-full text-left p-2.5 rounded-xl border transition-all group relative cursor-pointer",
                    activeConversationId === conv.id
                      ? "bg-indigo-600/10 border-indigo-500/40 shadow-sm"
                      : "bg-theme-surface-2/50 border-theme-border/50 hover:border-indigo-500/30 hover:bg-theme-surface-2"
                  )}
                >
                  <p className={clsx(
                    "text-xs font-semibold truncate pr-6 transition-colors",
                    activeConversationId === conv.id ? "text-indigo-400" : "text-theme-secondary group-hover:text-theme-primary"
                  )}>
                    {conv.title}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[9px] text-theme-muted font-medium">{relativeTime(conv.last_message_at)}</span>
                    <div className="flex items-center gap-1 text-[9px] text-theme-muted bg-theme-surface px-1.5 py-0.5 rounded-md border border-theme-border/50">
                      <Clock size={8} />
                      <span>{daysUntilExpiry(conv.expires_at)}d</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(e, conv.id)}
                    disabled={deletingId === conv.id}
                    className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 text-theme-muted transition-all"
                  >
                    {deletingId === conv.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Usage Card */}
        <div className="bg-theme-surface-2 border border-theme-border rounded-xl p-3 shadow-sm shrink-0">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
              {plan} Plan
            </span>
            {plan !== 'Pro' && (
              <Link to="/pricing" className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400">
                Upgrade
              </Link>
            )}
          </div>

          <div className="w-full bg-theme-surface h-1.5 rounded-full overflow-hidden mb-2 border border-theme-border/50">
            <motion.div
              className="bg-indigo-600 h-full shadow-[0_0_8px_rgba(79,70,229,0.5)]"
              initial={{ width: 0 }}
              animate={{
                width: limit === Infinity ? '100%' : `${Math.min((usageCount / limit) * 100, 100)}%`
              }}
            />
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[10px] text-theme-muted font-bold">
              <span className="text-theme-primary">{usageCount}/{limit === Infinity ? '∞' : limit}</span> queries
            </p>
            <button
              onClick={handleReset}
              className="p-1.5 text-theme-muted hover:text-indigo-400 hover:bg-theme-surface rounded-lg border border-transparent hover:border-theme-border transition-all"
              title="Reset session"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>

      </aside>

      {/* ── Chat Area ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-theme-base">

        {/* Header */}
        <header className="px-5 py-3 md:py-4 border-b border-theme-border flex justify-between items-center bg-theme-surface/50 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 -ml-2 text-theme-muted hover:bg-theme-surface-2 rounded-xl transition-colors" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div>
              <h2 className="font-bold text-lg text-theme-primary">Academic Tutor</h2>
              <p className="text-xs text-theme-muted font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Ready to help with your studies
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(plan === 'Plus' || plan === 'Pro') && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-500 rounded-xl text-xs font-bold border border-amber-500/20 shadow-sm">
                <Sparkles size={14} />
                <span>{plan}</span>
              </div>
            )}
            <Link to="/papers" className="px-4 py-2 bg-theme-surface-2 rounded-xl text-xs font-bold border border-theme-border shadow-sm hover:bg-theme-surface transition-colors text-theme-primary">Past Papers</Link>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-8 scroll-smooth">
          <AnimatePresence initial={false}>
            {messages.length === 1 && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto mt-12 text-center"
              >
                <div className="w-20 h-20 glass-card rounded-[2rem] shadow-lg border border-theme-border flex items-center justify-center mx-auto mb-8 animate-bounce">
                  <GraduationCap className="text-indigo-500" size={40} />
                </div>
                <h3 className="text-3xl font-bold text-theme-primary mb-3 tracking-tight">How can I help you today?</h3>
                <p className="text-theme-muted max-w-sm mx-auto mb-10 text-sm font-medium leading-relaxed">
                  Choose a topic below or type your own assignment or concept question to get started.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
                  {STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="p-5 glass-card border-theme-border rounded-2xl text-left text-xs font-semibold text-theme-secondary hover:border-indigo-400 hover:bg-theme-surface-2 transition-all shadow-sm group"
                    >
                      <span className="group-hover:text-indigo-400 transition-colors">{q}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {messages.filter(m => m.id !== 'welcome').map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={clsx(
                  "flex flex-col group",
                  message.role === 'user' ? "items-end" : "items-start"
                )}
              >
                <div className={clsx(
                  "max-w-[85%] p-5 rounded-2xl shadow-md transition-all",
                  message.role === 'user'
                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-tr-none shadow-indigo-500/20"
                    : "glass-card border-theme-border rounded-tl-none text-theme-secondary"
                )}>
                  {message.attachmentName && (
                    <div className="mb-3 flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-2 rounded-xl text-[11px] font-bold">
                      <Paperclip size={14} />
                      <span className="truncate max-w-[200px]">{message.attachmentName}</span>
                    </div>
                  )}
                  <div className={clsx(
                    message.role === 'user'
                      ? "text-white whitespace-pre-wrap text-sm font-medium"
                      : "prose prose-sm max-w-none prose-headings:text-theme-primary prose-strong:text-theme-primary prose-code:bg-theme-surface-2 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-indigo-400 prose-code:font-bold dark:prose-invert text-theme-secondary"
                  )}>
                    {message.role === 'user' ? message.content : <Markdown>{message.content}</Markdown>}
                  </div>
                </div>
                <div className={clsx(
                  "text-[10px] text-theme-muted mt-2 font-bold uppercase tracking-wider flex items-center gap-1.5",
                  message.role === 'user' ? "mr-1" : "ml-1"
                )}>
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {message.role === 'assistant' && <span className="opacity-50">• PastQ AI</span>}
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start"
              >
                <div className="glass-card border-theme-border p-4 rounded-2xl rounded-tl-none shadow-md flex items-center gap-3 text-indigo-400 text-xs font-bold italic">
                  <Loader2 size={16} className="animate-spin" />
                  <motion.span
                    key={loadingMsgIdx}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="inline-block"
                  >
                    {LOADING_MESSAGES[loadingMsgIdx]}
                  </motion.span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input */}
        <footer className="p-4 md:p-6 bg-theme-base border-t border-theme-border shrink-0">
          <div className="max-w-4xl mx-auto w-full">
            {selectedFileName && (
              <div className="mb-3 flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg w-max text-xs font-semibold">
                <Paperclip size={14} />
                <span className="truncate max-w-[200px] md:max-w-[300px]">{selectedFileName}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedFileName(''); setSelectedFile(null); }}
                  className="hover:text-red-400 ml-1 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <form
              onSubmit={handleSubmit}
              className={clsx(
                "relative flex items-center group",
                !canSend && "opacity-50 pointer-events-none"
              )}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={canSend ? "Ask your academic question..." : "Limit reached."}
                className="w-full bg-theme-surface-2 border border-theme-border p-4 pr-16 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-theme-primary font-medium placeholder:text-theme-muted transition-all"
                disabled={!canSend || isLoading}
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
              />

              <div className="absolute right-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={clsx("p-2 transition-colors rounded-xl", selectedFileName ? "text-indigo-400 bg-indigo-500/10 hidden" : "text-theme-muted hover:text-indigo-400")}
                  title="Attach File"
                >
                  <Paperclip size={18} />
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || !canSend || isLoading}
                  className={clsx(
                    "p-3 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50",
                    input.trim() && canSend && !isLoading
                      ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/30"
                      : "bg-theme-surface border border-theme-border text-theme-muted shadow-none"
                  )}
                >
                  <Send size={18} />
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-col items-center gap-1">
              {!canSend ? (
                <Link to="/pricing" className="text-[10px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20 backdrop-blur-sm hover:underline">
                  Limit Reached • Upgrade to Continue
                </Link>
              ) : (
                <p className="text-[10px] text-theme-muted uppercase tracking-widest font-bold">
                  {plan} Session • {limit === Infinity ? 'Unlimited Queries' : `${limit - usageCount} Queries Remaining`} • <span className="text-emerald-400">PastQ Advanced AI v2.0</span>
                </p>
              )}
            </div>
          </div>
        </footer>
      </main>

      {/* Maintenance Modal */}
      <AnimatePresence>
        {isMaintenance && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-md w-full bg-theme-surface border border-theme-border rounded-[2.5rem] p-8 md:p-12 text-center shadow-2xl relative overflow-hidden"
            >
              {/* Glow effect */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 blur-[100px] rounded-full"></div>
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 blur-[100px] rounded-full"></div>

              <div className="relative">
                <div className="w-24 h-24 bg-theme-surface-2 border border-theme-border rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <div className="relative">
                    <Sparkles className="text-indigo-500 animate-pulse" size={48} />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full border-4 border-theme-surface"></div>
                  </div>
                </div>

                <h2 className="text-3xl font-black text-theme-primary mb-4 tracking-tight">System Maintenance</h2>

                <div className="p-6 bg-theme-surface-2 border border-theme-border rounded-2xl mb-8">
                  <p className="text-sm text-theme-secondary font-medium leading-relaxed">
                    {maintenanceMsg || "Our AI Tutor is currently recharging and performing routine maintenance to better serve you."}
                  </p>
                </div>

                <div className="space-y-4">
                  <Link
                    to="/papers"
                    className="flex items-center justify-center gap-2 w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
                  >
                    Explore Past Papers
                  </Link>
                  <Link
                    to="/"
                    className="flex items-center justify-center gap-2 w-full py-3 bg-theme-surface-2 hover:bg-theme-surface border border-theme-border text-theme-secondary rounded-2xl font-bold transition-all active:scale-95 text-sm"
                  >
                    Go to Home
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={showConfirmReset}
        onClose={() => setShowConfirmReset(false)}
        onConfirm={confirmReset}
        title="Reset Chat"
        message="Are you sure you want to start a fresh study session? This will clear your current conversation history."
        confirmText="Clear Chat"
        variant="warning"
      />
    </div>
  );
};

export default AskAIPage;
