import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Loader2, Paperclip, Sparkles,
  RotateCcw, Menu, X, Trash2, Plus,
  Search, BookOpen, Copy, Check, PanelLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx } from 'clsx';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../lib/api';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AlertModal } from '../components/ui/AlertModal';

// ─── Types ───────────────────────────────────────────────────────────────────

type Plan = 'Free' | 'Basic' | 'Plus' | 'Pro';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachmentName?: string;
  isErrorFallback?: boolean;
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
  Free: 3,
  Basic: 10,
  Plus: Infinity,
  Pro: Infinity,
};

const getCleanFirstName = (fullName: string | null | undefined): string => {
  if (!fullName) return 'Student';
  let name = fullName.split('@')[0];
  name = name.replace(/[._\-0-9]+/g, ' ').trim();
  const words = name.split(/\s+/);
  const firstWord = words.find(w => /[a-zA-Z]/.test(w));
  if (!firstWord) return 'Student';
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
};
type CortanaEmotion = 'laugh' | 'happy' | 'supportive' | 'thinking' | 'tutor';

interface EmotionConfig {
  emoji: string;
  label: string;
  class: string;
}

const detectMessageEmotion = (content: string): CortanaEmotion => {
  if (!content) return 'tutor';

  // 1. EMOJI-FIRST SCANNING (Prioritize exact emotional icons output by Cortana)
  if (/😂|🤣|😆|😅/.test(content)) return 'laugh';
  if (/😊|😄|🥳|👏|🎉|🌟/.test(content)) return 'happy';
  if (/🥺|😢|😭|😔|💔/.test(content)) return 'supportive';
  if (/🤔|🧐|💡/.test(content)) return 'thinking';

  // 2. TIGHT & SAFE KEYWORD FALLBACKS (Extremely restricted to avoid false positives)
  const lower = content.toLowerCase();
  if (/\b(congrats|excellent|well done)\b/.test(lower)) return 'happy';
  if (/\b(unfortunately)\b/.test(lower)) return 'supportive';

  // 3. DEFAULT STATE
  return 'tutor';
};

const EMOTION_MAP: Record<CortanaEmotion, EmotionConfig> = {
  laugh: {
    emoji: '😆',
    label: 'Laughing',
    class: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-amber-500/5',
  },
  happy: {
    emoji: '😊',
    label: 'Happy',
    class: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-emerald-500/5',
  },
  supportive: {
    emoji: '🥺',
    label: 'Empathetic',
    class: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400 shadow-blue-500/5',
  },
  thinking: {
    emoji: '🤔',
    label: 'Analyzing',
    class: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400 shadow-purple-500/5',
  },
  tutor: {
    emoji: '✨',
    label: 'Tutor',
    class: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-indigo-500/5',
  },
};

const getWelcomeMessage = (username: string): Message => {
  const greetings = [
    `Welcome back, ${username}! Ready to ace it? 🚀✨`,
    `Hey ${username}, let's tackle some past questions together! 📚💪`,
    `Good to see you, ${username}! Time to study smart 🧠💡`,
    `Welcome, ${username}! Your next A grade starts here 🎯🏆`,
    `Let's go, ${username}! Past questions await! 📝🔥`,
    `Hey ${username}, ready to pass with flying colours? 🌈🎓`,
  ];
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
  return {
    id: 'welcome',
    role: 'assistant',
    content: `${randomGreeting}\n\nI'm **Cortana**, your personal academic tutor. 🎓✨ I can help you understand concepts from past papers, summarize complex topics, and guide your exam preparation to success!\n\nWhat exciting topic would you like to study today? 💡`,
    timestamp: Date.now(),
  };
};

const INITIAL_MESSAGES: Message[] = [];

const STARTER_QUESTIONS = [
  "Explain the Second Law of Thermodynamics",
  "Help me summarize key accounting principles",
  "Walk me through solving this calculus problem step by step",
  "Give me an outline for a Business Law essay on contracts",
];

// ─── Main Page ────────────────────────────────────────────────────────────────

// Strip any PDF-reading alert blockquotes that may have been persisted in
// localStorage or the Supabase conversation history from a previous server version.
function cleanAlertText(content: string): string {
  if (typeof content !== 'string') return content;
  return content
    // Matches the blockquote alert block greedily until two blank lines or end of string
    .replace(/>\s*⚠️\s*\*\*(?:Exam Paper Access Alert|Document Reading Alert)\*\*:[\s\S]*?(?=\n\n[^>]|\n\n$|$)/g, '')
    // Fallback: catch any remaining > ⚠️ lines (including multi-line blockquotes)
    .replace(/(?:>\s*⚠️[^\n]*\n?)+/g, '')
    .trimStart();
}

/**
 * Preprocess AI markdown to enforce a prose-first rendering style:
 *  - Convert markdown headers (##, ###, ####) into plain bold text lines
 *  - Collapse sub-bullet elaborations into flowing sentences
 *  - Leave top-level short-fact bullets intact
 */
function formatAIContentForProse(raw: string): string {
  if (typeof raw !== 'string') return raw;

  // Replace literal <br> tags (case insensitive, with or without slash/space) with newlines
  let text = raw.replace(/<br\s*\/?>/gi, '\n');

  // Normalise line endings (CRLF → LF)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Collapse nested sub-bullets (indented bullets that elaborate on a
  //    parent point) into prose by joining them into the preceding line.
  //    A nested bullet is any line starting with 2+ spaces/tabs then - or *.
  //    We join these onto the previous line separated by ". " so they read
  //    as connected sentences rather than fragmented sub-items.
  const lines = text.split('\n');
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Fix list markers preceding a heading (e.g. "- ### Title" -> "### Title")
    line = line.replace(/^(\s*[-*+]\s+|>\s*[-*+]\s+)#{1,4}\s*/, (_, prefix) => {
      // If it starts with a blockquote indicator, preserve it: "> ### "
      return prefix.includes('>') ? '> ### ' : '### ';
    });

    // Fix missing space after heading markers (e.g. "###Title" -> "### Title")
    line = line.replace(/^(>?\s*)#{1,4}([^\s#].*)$/, '$1### $2');

    const nestedBulletMatch = line.match(/^(\s{2,}|\t+)[-*+]\s+(.+)/);
    if (nestedBulletMatch && result.length > 0) {
      // Append to previous line as a continuation sentence
      const content = nestedBulletMatch[2].trim();
      const prev = result[result.length - 1];
      const separator = /[.!?:;]\s*$/.test(prev) ? ' ' : '. ';
      result[result.length - 1] = prev + separator + content;
    } else {
      result.push(line);
    }
  }

  // Ensure every markdown heading (# / ## / ### / ####) has a blank line
  // before it. CommonMark requires this, and react-markdown won't parse a
  // heading that directly follows a non-blank line.
  const processed: string[] = [];
  for (let i = 0; i < result.length; i++) {
    const line = result[i];
    const trimmed = line.trimStart();
    const isHeading = /^#{1,4}\s/.test(trimmed) || /^>\s*#{1,4}\s/.test(trimmed);
    if (isHeading && i > 0) {
      const prevLine = result[i - 1];
      if (prevLine.trim() !== '') {
        // If both current and previous lines are blockquotes, insert a blockquote blank line
        if (trimmed.startsWith('>') && prevLine.trimStart().startsWith('>')) {
          processed.push('>');
        } else {
          processed.push('');
        }
      }
    }
    processed.push(line);
  }

  return processed.join('\n');
}

const getChildrenText = (children: any): string => {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(getChildrenText).join('');
  if (children && children.props && children.props.children) {
    return getChildrenText(children.props.children);
  }
  return '';
};

const getContentCategory = (text: string): 'blue' | 'green' | 'none' => {
  const lower = text.toLowerCase().trim();
  // Blue categories: Questions, Subheadings, Section Titles
  if (
    lower.startsWith('question') ||
    lower.includes('question') ||
    lower.startsWith('q:') ||
    lower.startsWith('q.') ||
    lower.startsWith('problem') ||
    lower.endsWith('?') ||
    lower.startsWith('what is') ||
    lower.startsWith('what are') ||
    lower.startsWith('why do') ||
    lower.startsWith('why does') ||
    lower.startsWith('why are') ||
    lower.startsWith('how to') ||
    lower.startsWith('how do') ||
    lower.startsWith('how does') ||
    lower.startsWith('explain') ||
    lower.startsWith('define') ||
    lower.startsWith('describe') ||
    lower.includes('importance of') ||
    lower.includes('importances of') ||
    lower.startsWith('importance') ||
    lower.startsWith('roles') ||
    lower.includes('roles of') ||
    lower.includes('benefits of') ||
    lower.includes('types of') ||
    lower.includes('reasons why') ||
    lower.startsWith('summary') ||
    lower.startsWith('overview') ||
    lower.startsWith('conclusion') ||
    lower.startsWith('introduction')
  ) {
    return 'blue';
  }
  // Green categories: explicit points/takeaways
  if (
    lower.startsWith('main point') ||
    lower.startsWith('key point') ||
    lower.startsWith('point') ||
    lower.startsWith('takeaway') ||
    lower.startsWith('key focus') ||
    lower.startsWith('concept')
  ) {
    return 'green';
  }
  return 'none';
};

const colorKeyTermsInList = (children: React.ReactNode, isDark: boolean): React.ReactNode => {
  return React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      const anyChild = child as any;
      const typeStr = typeof anyChild.type === 'string' ? anyChild.type : anyChild.type?.name || '';
      const isStrong = typeStr === 'strong' ||
        (anyChild.props && (
          anyChild.props.node?.tagName === 'strong' ||
          anyChild.props.className?.includes('ai-strong')
        ));
      if (isStrong) {
        return React.cloneElement(anyChild, {
          style: {
            ...anyChild.props.style,
            color: isDark ? '#10b981' : '#059669',
            fontWeight: 800
          }
        });
      }
      if (anyChild.props && anyChild.props.children) {
        return React.cloneElement(anyChild, {
          children: colorKeyTermsInList(anyChild.props.children, isDark)
        });
      }
    }
    return child;
  });
};

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
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const rawPlan = user?.plan || 'Free';
  const plan = (rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1).toLowerCase()) as Plan;

  const username = getCleanFirstName(user?.full_name);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('pastq_ai_messages');
      if (saved) {
        const parsed: Message[] = JSON.parse(saved);
        return parsed.map(m =>
          m.role === 'assistant' ? { ...m, content: cleanAlertText(m.content) } : m
        );
      }
    } catch { }
    return [getWelcomeMessage(username)];
  });

  // Update welcome message if username becomes available after mount
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === 'welcome') {
      if (username !== 'Student' && messages[0].content.includes('Student')) {
        const freshWelcome = getWelcomeMessage(username);
        setMessages([freshWelcome]);
        localStorage.setItem('pastq_ai_messages', JSON.stringify([freshWelcome]));
      }
    }
  }, [username, messages]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [usageCount, setUsageCount] = useState(0);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileText, setUploadedFileText] = useState<string>(() => {
    try {
      return localStorage.getItem('pastq_ai_uploaded_file_text') || '';
    } catch {
      return '';
    }
  });
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
  const [avatarError, setAvatarError] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [hideUpgradeBanner, setHideUpgradeBanner] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatar_url]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [alert, setAlert] = useState<{ show: boolean; title: string; message: string; variant: 'success' | 'error' | 'info' }>({
    show: false,
    title: '',
    message: '',
    variant: 'info'
  });

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

      // Fetch verified questions if they exist
      apiFetch(`/papers/${initialPaperId}/questions`, { token })
        .then((qRes) => {
          if (qRes.verified && qRes.questions && qRes.questions.length > 0) {
            const formatSubparts = (subparts: any[], indent: string): string => {
              return subparts.map((sp: any) => {
                const marksStr = sp.marks ? ` (${sp.marks} marks)` : '';
                let nestedStr = '';
                if (Array.isArray(sp.sub_parts) && sp.sub_parts.length > 0) {
                  nestedStr = '\n' + formatSubparts(sp.sub_parts, indent + '  ');
                }
                return `${indent}- **${sp.label}**: ${sp.text}${marksStr}${nestedStr}`;
              }).join('\n');
            };

            const listStr = qRes.questions.map((q: any) => {
              const marksStr = q.marks ? ` (${q.marks} marks)` : '';
              let subpartsStr = '';
              if (Array.isArray(q.sub_parts) && q.sub_parts.length > 0) {
                subpartsStr = '\n' + formatSubparts(q.sub_parts, '   ');
              }
              return `- **Question ${q.question_no}**: ${q.body}${marksStr}${subpartsStr}`;
            }).join('\n\n');

            const customizedWelcome: Message = {
              id: 'welcome',
              role: 'assistant',
              content: `Welcome back, ${username}! Ready to study this paper? 🚀✨\n\nI have scanned and verified the questions in this exam paper. Here is what it covers:\n\n${listStr}\n\nWhich question would you like to study? You can type the question number or ask me any concept! 🎓`,
              timestamp: Date.now(),
            };

            setMessages(prev => {
              if (prev.length === 1 && prev[0].id === 'welcome') {
                return [customizedWelcome];
              }
              return prev.map(m => m.id === 'welcome' ? customizedWelcome : m);
            });
          }
        })
        .catch(() => {});

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
              content: m.role === 'assistant' ? cleanAlertText(m.content) : m.content,
              timestamp: new Date(m.created_at).getTime(),
            }));
            if (loaded.length) setMessages(loaded);
          })
          .catch(() => {
            // Conversation may have expired — clear the mapping
            localStorage.removeItem(`pastq_paper_conv_${initialPaperId}`);
            setActiveConversationId(null);
            setMessages([getWelcomeMessage(username)]);
          });
      } else {
        // If there is no existing conversation for this new paper, we must reset the chat state
        // Otherwise, it will keep the messages from the previously viewed paper!
        setActiveConversationId(null);
        setMessages([getWelcomeMessage(username)]);
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

  // Auto-resize textarea based on input content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, 52), 200)}px`;
    }
  }, [input]);

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
    const savedConvFileText = localStorage.getItem(`pastq_conv_file_text_${conv.id}`) || '';
    setUploadedFileText(savedConvFileText);
    if (savedConvFileText) {
      localStorage.setItem('pastq_ai_uploaded_file_text', savedConvFileText);
    } else {
      localStorage.removeItem('pastq_ai_uploaded_file_text');
    }
    try {
      const res = await apiFetch(`/ai/conversations/${conv.id}`, { token: token! });
      const loaded: Message[] = (res.messages ?? []).map((m: any) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.role === 'assistant' ? cleanAlertText(m.content) : m.content,
        timestamp: new Date(m.created_at).getTime(),
      }));
      setMessages(loaded.length ? loaded : [getWelcomeMessage(username)]);
    } catch {
      setMessages([getWelcomeMessage(username)]);
    }
  };

  const deleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    setDeletingId(convId);
    try {
      await apiFetch(`/ai/conversations/${convId}`, { method: 'DELETE', token: token! });
      setConversations(prev => prev.filter(c => c.id !== convId));
      localStorage.removeItem(`pastq_conv_file_text_${convId}`);
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        setMessages(INITIAL_MESSAGES);
        setUploadedFileText('');
        localStorage.removeItem('pastq_ai_uploaded_file_text');
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
    const freshWelcome = getWelcomeMessage(username);
    setMessages([freshWelcome]);
    setInput('');
    setSelectedFile(null);
    setSelectedFileName('');
    setUploadedFileText('');
    setSidebarOpen(false);
    localStorage.setItem('pastq_ai_messages', JSON.stringify([freshWelcome]));
    localStorage.removeItem('pastq_ai_active_conv');
    localStorage.removeItem('pastq_ai_uploaded_file_text');
    // Clear the paper-specific conv mapping so the next visit creates a fresh conversation
    if (activePaperId) {
      localStorage.removeItem(`pastq_paper_conv_${activePaperId}`);
    }
  };

  // Helpers
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
      (plan === 'Free' && usageCount < 3) ||
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
              const ext = selectedFile.name.split('.').pop()?.toLowerCase();
              mimeTypeStr = selectedFile.type || (
                ext === 'txt' ? 'text/plain' :
                ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                ext === 'doc' ? 'application/msword' :
                ext === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' :
                ext === 'ppt' ? 'application/vnd.ms-powerpoint' :
                'application/pdf'
              );
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
        .map(m => ({ role: m.role, content: cleanAlertText(m.content) }));

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
          uploadedFileText: (!fileDataStr && !activePaperId && uploadedFileText) ? uploadedFileText : undefined,
          paperId: activePaperId || undefined,
          conversationId: convId || undefined,
        },
      });

      if (res?.extractedFileText) {
        setUploadedFileText(res.extractedFileText);
        localStorage.setItem('pastq_ai_uploaded_file_text', res.extractedFileText);
        if (convId) {
          localStorage.setItem(`pastq_conv_file_text_${convId}`, res.extractedFileText);
        }
      }

      // Backend signals a quota or fallback failure error via structured JSON (not an exception)
      if (res?.error === 'quota_exceeded' || res?.error === 'all_engines_failed') {
        if (res.isMaintenance) {
          setIsMaintenance(true);
          setMaintenanceMsg(res.message);
          return;
        }
        const fallbackMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: res.message ||
            '⚠️ All AI services are temporarily unavailable due to high demand or rate limits. Please try again later.',
          timestamp: Date.now(),
          isErrorFallback: true,
        };
        setUsageCount(prev => prev - 1);
        setMessages(prev => [...prev, fallbackMsg]);
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
      const isKnownError = errBody?.error === 'quota_exceeded' ||
        errBody?.error === 'ai_disabled' ||
        errBody?.error === 'all_engines_failed' ||
        errBody?.error === 'file_blocked' ||
        errBody?.error === 'file_limit_reached' ||
        errBody?.error === 'server_error';

      if (isKnownError) {
        if (errBody.isMaintenance) {
          setIsMaintenance(true);
          setMaintenanceMsg(errBody.message);
        } else {
          const alertMsg: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: errBody.message || '⚠️ All AI services are temporarily unavailable due to high demand or rate limits.',
            timestamp: Date.now(),
            isErrorFallback: true,
          };
          setMessages(prev => [...prev, alertMsg]);
        }
      } else {
        const friendly: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            '❌ The AI service is currently experiencing connection issues or high load. While we work to restore full service, you can copy your question and continue studying on one of the external alternate servers below:',
          timestamp: Date.now(),
          isErrorFallback: true,
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
      setAlert({
        show: true,
        title: 'Upgrade Required',
        message: 'Upgrade to Basic to upload and analyze files with AI!',
        variant: 'info'
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setAlert({
          show: true,
          title: 'File Too Large',
          message: 'File is too large. Limit is 10MB.',
          variant: 'error'
        });
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
    const freshWelcome = getWelcomeMessage(username);
    setMessages([freshWelcome]);
    setUploadedFileText('');
    localStorage.setItem('pastq_ai_messages', JSON.stringify([freshWelcome]));
    localStorage.removeItem('pastq_ai_active_conv');
    localStorage.removeItem('pastq_ai_uploaded_file_text');
    setShowConfirmReset(false);
  };

  const limit = PLAN_LIMITS[plan];

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedMsgId(id);
      setTimeout(() => {
        setCopiedMsgId(prev => (prev === id ? null : prev));
      }, 1800);
    }).catch(() => {});
  };

  const filteredConversations = conversations.filter((conv) => {
    const q = chatSearchQuery.trim().toLowerCase();
    return !q || conv.title.toLowerCase().includes(q);
  });

  const activeConvTitle =
    conversations.find((c) => c.id === activeConversationId)?.title ||
    (activePaperId && selectedFileName ? selectedFileName : 'New chat');

  const visibleMessages = messages.filter((m) => m.id !== 'welcome');
  const welcomeMessage = messages.find((m) => m.id === 'welcome');
  const hasPaperWelcomeDetails =
    Boolean(welcomeMessage?.content?.includes('verified the questions in this exam paper'));

  return (
    <div className={clsx(
      "w-full flex-1 min-h-0 h-full relative flex overflow-hidden border-t",
      isDark ? "bg-[#212120] border-[#2c2c2a]" : "bg-[#fcfbf8] border-stone-200/80"
    )}>

      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Claude-Inspired Sidebar ─────────────────────────────────────── */}
      <aside className={clsx(
        "absolute md:static inset-y-0 left-0 h-full shrink-0 flex flex-col z-40 md:z-auto transition-all duration-200 border-r pb-20 md:pb-2",
        isDark
          ? "bg-[#191918] border-[#2c2c2a] text-[#ecece7]"
          : "bg-[#f5f3ee] border-stone-200 text-stone-900",
        sidebarOpen ? "w-72 translate-x-0 flex shadow-2xl" : "-translate-x-full hidden",
        desktopSidebarOpen ? "md:w-64 md:translate-x-0 md:flex md:shadow-none" : "md:hidden"
      )}>
        {/* Top Brand Row */}
        <div className="px-3.5 pt-3.5 pb-2 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-theme-border/60 shrink-0">
              <img src="/lumio.jpg" alt="Cortana" className="w-full h-full object-cover" />
            </div>
            <span className="text-[17px] font-bold tracking-tight truncate">Cortana</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setDesktopSidebarOpen(false);
            }}
            title="Collapse sidebar"
            className={clsx(
              "p-1.5 rounded-lg transition-colors cursor-pointer",
              isDark ? "text-stone-400 hover:text-stone-100 hover:bg-white/5" : "text-stone-500 hover:text-stone-900 hover:bg-black/5"
            )}
          >
            <PanelLeft size={17} className="hidden md:block" />
            <X size={18} className="md:hidden" />
          </button>
        </div>

        {/* Navigation Links (+ New chat, Search, Past Papers) */}
        <div className="px-2.5 py-1.5 space-y-0.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (plan === 'Plus' || plan === 'Pro') {
                startNewChat();
              } else {
                setSidebarOpen(false);
                handleReset();
              }
            }}
            className={clsx(
              "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer",
              isDark ? "hover:bg-white/5 text-[#e6e6e1]" : "hover:bg-black/5 text-stone-800"
            )}
          >
            <Plus size={16} className="opacity-80 shrink-0" />
            <span>New chat</span>
          </button>

          {(plan === 'Plus' || plan === 'Pro') && (
            <button
              type="button"
              onClick={() => {
                setShowChatSearch(prev => {
                  if (prev) setChatSearchQuery('');
                  return !prev;
                });
              }}
              className={clsx(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer",
                showChatSearch
                  ? (isDark ? "bg-white/10 text-white" : "bg-black/5 text-stone-900")
                  : (isDark ? "hover:bg-white/5 text-[#d4d4cf]" : "hover:bg-black/5 text-stone-700")
              )}
            >
              <Search size={15} className="opacity-75 shrink-0" />
              <span>Search</span>
            </button>
          )}

          {showChatSearch && (plan === 'Plus' || plan === 'Pro') && (
            <div className="px-1 pt-1 pb-1.5">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
                <input
                  type="text"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  placeholder="Filter conversations..."
                  autoFocus
                  className={clsx(
                    "w-full pl-8 pr-7 py-1.5 rounded-lg text-xs border focus:outline-none transition-colors",
                    isDark
                      ? "bg-[#242422] border-[#383835] text-stone-100 placeholder:text-stone-500 focus:border-indigo-400/60"
                      : "bg-white border-stone-200 text-stone-900 placeholder:text-stone-400 focus:border-indigo-400"
                  )}
                />
                {chatSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setChatSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-primary cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          <Link
            to="/papers"
            onClick={() => setSidebarOpen(false)}
            className={clsx(
              "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors",
              isDark ? "hover:bg-white/5 text-[#d4d4cf]" : "hover:bg-black/5 text-stone-700"
            )}
          >
            <BookOpen size={15} className="opacity-75 shrink-0" />
            <span>Past Papers</span>
          </Link>
        </div>

        {/* Recents List (Plus/Pro) or History Info (Free/Basic) */}
        <div className="flex-1 flex flex-col min-h-0 px-2.5 pt-3">
          <div className="flex items-center justify-between px-2.5 mb-1.5">
            <span className="text-[11px] font-semibold text-theme-muted">Recents</span>
            {isHistoryLoading && <Loader2 size={11} className="animate-spin text-theme-muted" />}
          </div>

          {(plan === 'Plus' || plan === 'Pro') ? (
            <div className="flex-1 overflow-y-auto overscroll-contain space-y-0.5 pr-0.5 scrollbar-hide">
              {filteredConversations.length === 0 && !isHistoryLoading ? (
                <div className="px-2.5 py-4 text-[11px] text-theme-muted leading-relaxed">
                  {chatSearchQuery.trim()
                    ? `No chats match "${chatSearchQuery}".`
                    : 'No saved chats yet. Start a conversation to keep it here.'}
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isActive = activeConversationId === conv.id;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => loadConversation(conv)}
                      onKeyDown={(e) => e.key === 'Enter' && loadConversation(conv)}
                      tabIndex={0}
                      role="button"
                      title={`${conv.title} • ${relativeTime(conv.last_message_at)}`}
                      className={clsx(
                        "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors group cursor-pointer",
                        isActive
                          ? (isDark ? "bg-white/10 text-white font-medium" : "bg-black/10 text-stone-950 font-medium")
                          : (isDark ? "text-[#c8c8c2] hover:bg-white/5 hover:text-white" : "text-stone-700 hover:bg-black/5 hover:text-stone-950")
                      )}
                    >
                      <span className="truncate flex-1">{conv.title}</span>
                      <button
                        type="button"
                        onClick={(e) => deleteConversation(e, conv.id)}
                        disabled={deletingId === conv.id}
                        aria-label="Delete conversation"
                        title="Delete conversation"
                        className="p-1 rounded opacity-70 md:opacity-0 md:group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-400 text-theme-muted transition-all shrink-0 cursor-pointer"
                      >
                        {deletingId === conv.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className={clsx(
              "mt-1 mx-1 p-3 rounded-xl border text-[11px] space-y-2",
              isDark ? "bg-[#222220] border-[#32322f] text-stone-400" : "bg-white/70 border-stone-200 text-stone-600"
            )}>
              <p className="leading-relaxed">
                Upgrade to <span className="font-semibold text-theme-primary">Plus</span> or <span className="font-semibold text-theme-primary">Pro</span> to save &amp; search past conversations forever.
              </p>
              <Link
                to="/pricing"
                className="inline-block text-[11px] font-semibold text-indigo-500 hover:text-indigo-400"
              >
                View plans →
              </Link>
            </div>
          )}
        </div>

        {/* Pinned Bottom User & Usage Footer */}
        <div className={clsx(
          "px-3 pt-2.5 pb-2 border-t shrink-0 space-y-2",
          isDark ? "border-[#2c2c2a]" : "border-stone-200"
        )}>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] font-semibold text-theme-muted">
              <span>{limit === Infinity ? `${usageCount} queries • ∞` : `${usageCount}/${limit} daily queries`}</span>
              {plan !== 'Pro' && (
                <Link to="/pricing" className="text-indigo-500 hover:underline">
                  Upgrade
                </Link>
              )}
            </div>
            <div className="w-full bg-theme-surface h-1 rounded-full overflow-hidden">
              <motion.div
                className="bg-indigo-500 h-full"
                initial={{ width: 0 }}
                animate={{
                  width: limit === Infinity ? '100%' : `${Math.min((usageCount / limit) * 100, 100)}%`
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-theme-surface border border-theme-border flex items-center justify-center overflow-hidden shrink-0">
                {user?.avatar_url && !avatarError ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name || 'Profile'}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    {user?.full_name?.charAt(0).toUpperCase() || 'S'}
                  </span>
                )}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-xs font-semibold truncate">{user?.full_name || 'Student'}</p>
                <p className="text-[10px] text-theme-muted">{plan} plan</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className={clsx(
                "p-1.5 rounded-lg text-theme-muted hover:text-theme-primary transition-colors cursor-pointer shrink-0",
                isDark ? "hover:bg-white/5" : "hover:bg-black/5"
              )}
              title="Reset current session"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Claude-Style Chat Canvas ────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full min-h-0 relative overflow-hidden">

        {/* Minimalist Top Bar */}
        <header className={clsx(
          "px-4 md:px-6 h-12 border-b flex justify-between items-center z-10 shrink-0",
          isDark ? "border-[#2c2c2a]/70 bg-[#212120]/95" : "border-stone-200/80 bg-[#fcfbf8]/95"
        )}>
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className={clsx(
                "md:hidden p-1.5 -ml-1 rounded-lg text-theme-muted hover:text-theme-primary transition-colors cursor-pointer",
                isDark ? "hover:bg-white/5" : "hover:bg-black/5"
              )}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={19} />
            </button>
            {!desktopSidebarOpen && (
              <button
                type="button"
                className={clsx(
                  "hidden md:flex p-1.5 -ml-1 rounded-lg text-theme-muted hover:text-theme-primary transition-colors cursor-pointer",
                  isDark ? "hover:bg-white/5" : "hover:bg-black/5"
                )}
                onClick={() => setDesktopSidebarOpen(true)}
                title="Open sidebar"
              >
                <PanelLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Cortana Online" />
              <h2 className="font-semibold text-sm text-theme-primary truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                {activeConvTitle}
              </h2>
            </div>
          </div>

          {/* Center Claude-Style Plan Pill */}
          {plan !== 'Pro' && !hideUpgradeBanner && (
            <div className={clsx(
              "hidden lg:flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-medium",
              isDark ? "bg-[#2a2a28] border-[#3a3a37] text-stone-300" : "bg-stone-100 border-stone-200 text-stone-700"
            )}>
              <span>{plan} plan</span>
              <span className="opacity-40">·</span>
              <Link to="/pricing" className="text-indigo-500 hover:underline font-semibold">
                Upgrade
              </Link>
              <button
                type="button"
                onClick={() => setHideUpgradeBanner(true)}
                aria-label="Dismiss upgrade banner"
                className="text-theme-muted hover:text-theme-primary ml-0.5 cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Right Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {(plan === 'Plus' || plan === 'Pro') && (
              <span className={clsx(
                "hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border",
                isDark ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-700"
              )}>
                <Sparkles size={12} />
                {plan}
              </span>
            )}
            <Link
              to="/papers"
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                isDark
                  ? "bg-[#2a2a28] border-[#3a3a37] text-stone-200 hover:bg-[#333330]"
                  : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
              )}
            >
              Past Papers
            </Link>
          </div>
        </header>

        {/* Scrollable Messages */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-8 py-6 scroll-smooth">
          <div className="max-w-3xl mx-auto w-full space-y-7">
            <AnimatePresence initial={false}>
              {visibleMessages.length === 0 && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="pt-4 md:pt-12 space-y-6"
                >
                  <div className="text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border border-indigo-500/30 shadow-md mx-auto">
                      <img src="/lumio.jpg" alt="Cortana" className="w-full h-full object-cover" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-theme-primary">
                      How can I help you today, {username}?
                    </h3>
                    <p className="text-theme-muted max-w-md mx-auto text-sm leading-relaxed">
                      Ask about concepts, upload lecture notes or past papers, or pick a prompt below.
                    </p>
                  </div>

                  {/* Verified Exam Paper Questions Preview when arriving from a Paper */}
                  {hasPaperWelcomeDetails && welcomeMessage && (
                    <div className={clsx(
                      "rounded-2xl border p-5 text-left",
                      isDark ? "bg-[#282826] border-[#383835]" : "bg-white border-stone-200 shadow-sm"
                    )}>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3">
                        <BookOpen size={14} />
                        <span>Paper Questions Loaded</span>
                      </div>
                      <div className="ai-prose text-sm">
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {formatAIContentForProse(welcomeMessage.content)}
                        </Markdown>
                      </div>
                    </div>
                  )}

                  {!input.trim() && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                      {STARTER_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => handleSend(q)}
                          className={clsx(
                            "p-4 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer group",
                            isDark
                              ? "bg-[#282826] border-[#363633] text-stone-300 hover:border-indigo-400/50 hover:bg-[#2f2f2c]"
                              : "bg-white border-stone-200 text-stone-700 hover:border-indigo-400 hover:bg-stone-50 shadow-sm"
                          )}
                        >
                          <span className="group-hover:text-theme-primary leading-relaxed">{q}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {visibleMessages.map((message, idx) => {
                const precedingUserMsg = [...visibleMessages.slice(0, idx)]
                  .reverse()
                  .find((m) => m.role === 'user');

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={clsx(
                      "flex flex-col group",
                      message.role === 'user' ? "items-end" : "items-start"
                    )}
                  >
                    {message.role === 'user' ? (
                      <div className={clsx(
                        "max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl",
                        isDark ? "bg-[#30302e] text-[#f3f3ee]" : "bg-[#efede6] text-stone-900"
                      )}>
                        {message.attachmentName && (
                          <div className="mb-2 flex items-center gap-1.5 bg-indigo-500/12 border border-indigo-500/20 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-indigo-400 w-max max-w-full">
                            <Paperclip size={12} />
                            <span className="truncate max-w-[200px]">{message.attachmentName}</span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{message.content}</p>
                      </div>
                    ) : (
                      <div className="w-full space-y-2.5">
                        {/* Subtle Emotion & Identity Tag */}
                        {(() => {
                          const emotion = detectMessageEmotion(message.content);
                          const config = EMOTION_MAP[emotion];
                          return (
                            <div className="flex items-center gap-2">
                              <div className={clsx(
                                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border w-max flex items-center gap-1.5 select-none",
                                config.class
                              )}>
                                <span className="text-xs leading-none">{config.emoji}</span>
                                <span className="leading-none">{config.label}</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Borderless Claude-Style Editorial Prose */}
                        <div className="ai-prose">
                          <Markdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ children }) => (
                                <p
                                  className="ai-section-title"
                                  style={{ color: isDark ? '#3b82f6' : '#2563eb', fontWeight: 800 }}
                                >
                                  {children}
                                </p>
                              ),
                              h2: ({ children }) => (
                                <p
                                  className="ai-section-title"
                                  style={{ color: isDark ? '#3b82f6' : '#2563eb', fontWeight: 800 }}
                                >
                                  {children}
                                </p>
                              ),
                              h3: ({ children }) => (
                                <p
                                  className="ai-section-title"
                                  style={{ color: isDark ? '#3b82f6' : '#2563eb', fontWeight: 800 }}
                                >
                                  {children}
                                </p>
                              ),
                              h4: ({ children }) => (
                                <p
                                  className="ai-section-title"
                                  style={{ color: isDark ? '#3b82f6' : '#2563eb', fontWeight: 800 }}
                                >
                                  {children}
                                </p>
                              ),
                              p: ({ children }) => <p className="ai-p">{children}</p>,
                              ul: ({ children }) => <ul className="ai-ul">{children}</ul>,
                              ol: ({ children }) => <ol className="ai-ol">{children}</ol>,
                              li: ({ children }) => <li className="ai-li">{colorKeyTermsInList(children, isDark)}</li>,
                              strong: ({ children }) => {
                                const text = getChildrenText(children);
                                const category = getContentCategory(text);
                                let customStyle = {};
                                if (category === 'green') {
                                  customStyle = { color: isDark ? '#10b981' : '#059669', fontWeight: 800 };
                                } else if (category === 'blue') {
                                  customStyle = { color: isDark ? '#3b82f6' : '#2563eb', fontWeight: 800 };
                                } else {
                                  customStyle = { fontWeight: 800 };
                                }
                                return (
                                  <strong
                                    className="ai-strong"
                                    style={customStyle}
                                  >
                                    {children}
                                  </strong>
                                );
                              },
                              em: ({ children }) => <em className="ai-em">{children}</em>,
                              blockquote: ({ children }) => (
                                <blockquote
                                  className="ai-blockquote"
                                  style={{
                                    borderLeftColor: isDark ? '#3b82f6' : '#2563eb',
                                    color: isDark ? '#60a5fa' : '#1d4ed8',
                                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.04)' : 'rgba(37, 99, 235, 0.03)'
                                  }}
                                >
                                  {children}
                                </blockquote>
                              ),
                              hr: () => <hr className="ai-hr" />,
                              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="ai-link">{children}</a>,
                              code: ({ className, children, ...props }) => {
                                const isBlock = className?.includes('language-');
                                return isBlock ? (
                                  <div className="ai-code-block-wrapper">
                                    {className && (
                                      <div className="ai-code-lang">{className.replace('language-', '')}</div>
                                    )}
                                    <pre className="ai-pre"><code className={className}>{children}</code></pre>
                                  </div>
                                ) : (
                                  <code className="ai-inline-code" {...props}>{children}</code>
                                );
                              },
                              pre: ({ children }) => <>{children}</>,
                              table: ({ children }) => (
                                <div className="ai-table-wrapper">
                                  <table className="ai-table">{children}</table>
                                </div>
                              ),
                              thead: ({ children }) => <thead className="ai-thead">{children}</thead>,
                              tbody: ({ children }) => <tbody>{children}</tbody>,
                              tr: ({ children }) => <tr className="ai-tr">{children}</tr>,
                              th: ({ children }) => <th className="ai-th">{children}</th>,
                              td: ({ children }) => <td className="ai-td">{children}</td>,
                            }}
                          >
                            {formatAIContentForProse(message.content)}
                          </Markdown>

                          {message.isErrorFallback && (
                            <div className="mt-4 pt-4 border-t border-theme-border/30">
                              <p className="text-[10px] text-theme-muted uppercase font-bold tracking-wider mb-2.5">
                                Suggested External AI Servers
                              </p>
                              <div className="flex flex-wrap gap-2.5">
                                <a
                                  href="https://chat.openai.com"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl text-xs font-bold transition-all border border-emerald-500/20 active:scale-95 shadow-sm"
                                >
                                  <span>ChatGPT</span>
                                </a>
                                <a
                                  href="https://claude.ai"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 rounded-xl text-xs font-bold transition-all border border-orange-500/20 active:scale-95 shadow-sm"
                                >
                                  <span>Claude</span>
                                </a>
                                <a
                                  href="https://gemini.google.com"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl text-xs font-bold transition-all border border-blue-500/20 active:scale-95 shadow-sm"
                                >
                                  <span>Gemini</span>
                                </a>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Claude-Style Action Row (Copy, Retry, Timestamp) */}
                        <div className="flex items-center gap-2 pt-1 text-theme-muted">
                          <button
                            type="button"
                            onClick={() => copyMessage(message.id, message.content)}
                            title="Copy response"
                            className={clsx(
                              "p-1.5 rounded-lg transition-colors cursor-pointer",
                              isDark ? "hover:bg-white/5 hover:text-stone-200" : "hover:bg-black/5 hover:text-stone-800"
                            )}
                          >
                            {copiedMsgId === message.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                          {precedingUserMsg && (
                            <button
                              type="button"
                              onClick={() => handleSend(precedingUserMsg.content)}
                              disabled={isLoading || !canSend}
                              title="Regenerate response"
                              className={clsx(
                                "p-1.5 rounded-lg transition-colors disabled:opacity-40 cursor-pointer",
                                isDark ? "hover:bg-white/5 hover:text-stone-200" : "hover:bg-black/5 hover:text-stone-800"
                              )}
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                          <span className="text-[11px] opacity-70 ml-1">
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2.5 text-sm text-indigo-400 font-medium py-2"
                >
                  <Loader2 size={16} className="animate-spin shrink-0" />
                  <motion.span
                    key={loadingMsgIdx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                  >
                    {LOADING_MESSAGES[loadingMsgIdx]}
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Claude-Style Centered Composer */}
        <footer className="px-4 md:px-8 pt-2 pb-24 md:pb-5 shrink-0">
          <div className="max-w-3xl mx-auto w-full">
            {selectedFileName && (
              <div className="mb-2 flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg w-max text-xs font-semibold">
                <Paperclip size={13} />
                <span className="truncate max-w-[200px] md:max-w-[320px]">{selectedFileName}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedFileName(''); setSelectedFile(null); }}
                  className="hover:text-red-400 ml-1 transition-colors cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className={clsx(
                "rounded-2xl border transition-all overflow-hidden",
                isDark
                  ? "bg-[#2b2b29] border-[#3d3d3a] focus-within:border-[#52524e]"
                  : "bg-white border-stone-200 shadow-sm focus-within:border-stone-400",
                !canSend && "opacity-55 pointer-events-none"
              )}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input.trim());
                  }
                }}
                placeholder={canSend ? "Reply to Cortana..." : "Daily query limit reached."}
                rows={1}
                className="w-full bg-transparent px-4 pt-3.5 pb-2 text-sm text-theme-primary font-normal placeholder:text-theme-muted focus:outline-none resize-none min-h-[46px] max-h-[180px] overflow-y-auto scrollbar-hide"
                disabled={!canSend || isLoading}
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
              />

              {/* Bottom Composer Toolbar */}
              <div className="px-3 pb-2.5 pt-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (plan === 'Free') {
                        setAlert({
                          show: true,
                          title: 'Upgrade Required',
                          message: 'Upgrade to Basic to upload and analyze files with AI!',
                          variant: 'info'
                        });
                        return;
                      }
                      fileInputRef.current?.click();
                    }}
                    className={clsx(
                      "h-8 px-2 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                      isDark ? "text-stone-400 hover:text-stone-200 hover:bg-white/5" : "text-stone-500 hover:text-stone-900 hover:bg-black/5",
                      plan === 'Free' && "opacity-45"
                    )}
                    title={plan === 'Free' ? "Upgrade to Basic to attach documents" : "Attach PDF, Word, PowerPoint, or TXT"}
                  >
                    <Plus size={16} />
                    <span className="hidden sm:inline">Attach</span>
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="hidden sm:inline text-[11px] font-medium text-theme-muted">
                    Cortana 3.0 · {plan}
                  </span>
                  <button
                    type="submit"
                    disabled={!input.trim() || !canSend || isLoading}
                    aria-label="Send message"
                    className={clsx(
                      "h-8 w-8 flex items-center justify-center rounded-lg transition-all active:scale-95 disabled:opacity-35 cursor-pointer",
                      input.trim() && canSend && !isLoading
                        ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm"
                        : (isDark ? "bg-[#383835] text-stone-400" : "bg-stone-100 text-stone-400")
                    )}
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-2 flex items-center justify-center">
              {!canSend ? (
                <Link to="/pricing" className="text-[11px] font-semibold text-amber-500 hover:underline">
                  Daily limit reached • Upgrade plan to continue
                </Link>
              ) : (
                <p className="text-[11px] text-theme-muted text-center">
                  Cortana is AI and can make mistakes · {limit === Infinity ? 'Unlimited Queries' : `${Math.max(limit - usageCount, 0)} queries left today`}
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
              className="max-w-md w-full glass-panel-premium rounded-[2.2rem] p-8 md:p-12 text-center shadow-2xl relative overflow-hidden"
            >
              {/* Glow effect */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/15 blur-[100px] rounded-full"></div>
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/15 blur-[100px] rounded-full"></div>

              <div className="relative">
                <div className="w-24 h-24 glass-panel-premium rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <div className="relative">
                    <Sparkles className="text-indigo-500 animate-pulse" size={48} />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full border-4 border-theme-surface"></div>
                  </div>
                </div>

                <h2 className="text-3xl font-black text-theme-primary mb-4 tracking-tight">System Maintenance</h2>

                <div className="p-6 glass-panel-premium rounded-2xl mb-8">
                  <p className="text-sm text-theme-secondary font-medium leading-relaxed">
                    {maintenanceMsg || "Our AI Tutor is currently recharging and performing routine maintenance to better serve you."}
                  </p>
                </div>

                <div className="space-y-4">
                  <Link
                    to="/papers"
                    className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/10 active:scale-95 cursor-pointer"
                  >
                    Explore Past Papers
                  </Link>
                  <Link
                    to="/"
                    className="flex items-center justify-center gap-2 w-full py-3 glass-panel-premium glass-panel-premium-hover text-theme-secondary rounded-2xl font-bold transition-all active:scale-95 text-sm cursor-pointer"
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

export default AskAIPage;
