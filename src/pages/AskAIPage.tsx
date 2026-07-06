import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Loader2, Paperclip, Sparkles,
  RotateCcw, Menu, X, Trash2, Plus, Clock
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
    const freshWelcome = getWelcomeMessage(username);
    setMessages([freshWelcome]);
    setInput('');
    setSelectedFile(null);
    setSelectedFileName('');
    setSidebarOpen(false);
    localStorage.setItem('pastq_ai_messages', JSON.stringify([freshWelcome]));
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
          paperId: activePaperId || undefined,
          conversationId: convId || undefined,
        },
      });

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
    localStorage.setItem('pastq_ai_messages', JSON.stringify([freshWelcome]));
    localStorage.removeItem('pastq_ai_active_conv');
    setShowConfirmReset(false);
  };

  const limit = PLAN_LIMITS[plan];

  return (
    <div className="w-full h-[calc(100dvh-72px)] flex overflow-hidden bg-theme-base">

      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={clsx(
        "fixed md:static inset-y-0 left-0 w-72 shrink-0 flex flex-col gap-3 p-3 z-50 transition-transform duration-300 shadow-2xl md:shadow-none border-r border-theme-border/60 bg-[var(--glass-sidebar-bg)] backdrop-blur-2xl",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 hidden md:flex"
      )}>
        {/* Top Info Card */}
        <div className="glass-panel-premium p-3.5 shadow-md shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center border border-theme-border/60">
                <img src="/lumio.jpg" alt="Cortana" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-lg font-black tracking-tight text-theme-primary">Cortana AI</h1>
            </div>
            <button className="md:hidden p-2 text-theme-muted hover:text-theme-primary hover:bg-theme-surface-2 rounded-xl transition-all" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-theme-border/40">
            <div className="w-10 h-10 rounded-full bg-theme-surface border-2 border-theme-border/80 shadow-inner flex items-center justify-center overflow-hidden">
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
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold transition-all active:scale-95 shadow-md shadow-indigo-500/10 border border-indigo-400/20 shrink-0 cursor-pointer"
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
                    "w-full text-left p-2.5 rounded-xl border transition-all group relative cursor-pointer backdrop-blur-md",
                    activeConversationId === conv.id
                      ? "bg-indigo-500/10 border-indigo-500/30 shadow-[0_4px_16px_rgba(99,102,241,0.08)]"
                      : "bg-theme-surface-2/20 border-theme-border/30 hover:border-indigo-500/30 hover:bg-theme-surface-2/50"
                  )}
                >
                  <p className={clsx(
                    "text-xs font-semibold truncate pr-6 transition-colors",
                    activeConversationId === conv.id ? "text-indigo-500 dark:text-indigo-400" : "text-theme-secondary group-hover:text-theme-primary"
                  )}>
                    {conv.title}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[9px] text-theme-muted font-medium">{relativeTime(conv.last_message_at)}</span>
                    <div className="flex items-center gap-1 text-[9px] text-theme-muted bg-theme-surface/60 px-1.5 py-0.5 rounded-md border border-theme-border/30">
                      <Clock size={8} />
                      <span>{daysUntilExpiry(conv.expires_at)}d</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(e, conv.id)}
                    disabled={deletingId === conv.id}
                    className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 text-theme-muted transition-all cursor-pointer"
                  >
                    {deletingId === conv.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Usage Card */}
        <div className="glass-panel-premium p-3.5 shadow-md shrink-0">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
              {plan} Plan
            </span>
            {plan !== 'Pro' && (
              <Link to="/pricing" className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 dark:hover:text-indigo-300">
                Upgrade
              </Link>
            )}
          </div>

          <div className="w-full bg-theme-surface/50 h-1.5 rounded-full overflow-hidden mb-2 border border-theme-border/30">
            <motion.div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full shadow-[0_0_8px_rgba(79,70,229,0.3)]"
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
              className="p-1.5 text-theme-muted hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-theme-surface/50 rounded-lg border border-transparent hover:border-theme-border/30 transition-all cursor-pointer"
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
        <header className="px-5 py-3.5 border-b border-theme-border/60 flex justify-between items-center bg-[var(--glass-header-bg)] backdrop-blur-xl z-10 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 -ml-2 text-theme-muted hover:bg-theme-surface-2 rounded-xl transition-colors cursor-pointer" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div>
              <h2 className="font-bold text-lg text-theme-primary">Cortana AI Tutor</h2>
              <p className="text-xs text-theme-muted font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Ready to help with your studies
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(plan === 'Plus' || plan === 'Pro') && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-bold border border-amber-500/20 shadow-sm">
                <Sparkles size={14} />
                <span>{plan}</span>
              </div>
            )}
            <Link to="/papers" className="px-4 py-2 glass-panel-premium glass-panel-premium-hover rounded-xl text-xs font-bold shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all text-theme-primary">Past Papers</Link>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-8 scroll-smooth">
          <AnimatePresence initial={false}>
            {messages.length === 1 && !isLoading && !input.trim() && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-2xl mx-auto mt-12 text-center"
              >
                <motion.div
                  whileHover={{
                    scale: 1.08,
                    y: -4,
                    boxShadow: "0 20px 30px rgba(99, 102, 241, 0.2)",
                    borderColor: "rgba(99, 102, 241, 0.6)"
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="w-20 h-20 rounded-[1.8rem] shadow-lg flex items-center justify-center mx-auto mb-8 relative group overflow-hidden border-2 border-indigo-500/30 cursor-pointer"
                >
                  <img src="/lumio.jpg" alt="Cortana" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </motion.div>
                <h3 className="text-3xl font-extrabold text-theme-primary mb-3 tracking-tight">How can I help you today?</h3>
                <p className="text-theme-muted max-w-sm mx-auto mb-10 text-sm font-medium leading-relaxed">
                  Choose a topic below or type your own assignment or concept question to get started.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
                  {STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="p-5 glass-panel-premium glass-panel-premium-hover rounded-2xl text-left text-xs font-semibold text-theme-secondary hover:border-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm group cursor-pointer"
                    >
                      <span className="group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors leading-relaxed">{q}</span>
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
                  "max-w-[85%] p-5 rounded-2xl shadow-sm transition-all",
                  message.role === 'user'
                    ? "glass-bubble-user rounded-tr-none"
                    : "glass-bubble-ai rounded-tl-none"
                )}>
                  {message.attachmentName && (
                    <div className="mb-3 flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl text-[11px] font-bold text-indigo-500 dark:text-indigo-400">
                      <Paperclip size={14} />
                      <span className="truncate max-w-[200px]">{message.attachmentName}</span>
                    </div>
                  )}
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed">{message.content}</p>
                  ) : (
                    <>
                      {(() => {
                        const emotion = detectMessageEmotion(message.content);
                        const config = EMOTION_MAP[emotion];
                        return (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.85, y: -2 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.05 }}
                            className={clsx(
                              "mb-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border w-max flex items-center gap-1.5 backdrop-blur-md shadow-sm transition-all duration-300 select-none",
                              config.class
                            )}
                          >
                            <span className="text-xs leading-none">{config.emoji}</span>
                            <span className="leading-none">{config.label}</span>
                          </motion.div>
                        );
                      })()}
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
                                customStyle = { fontWeight: isDark ? 850 : 700 };
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
                    </>
                  )}
                </div>
                <div className={clsx(
                  "text-[10px] text-theme-muted mt-2 font-bold uppercase tracking-wider flex items-center gap-1.5",
                  message.role === 'user' ? "mr-1" : "ml-1"
                )}>
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {message.role === 'assistant' && <span className="opacity-50">• Cortana</span>}
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start"
              >
                <div className="glass-panel-premium p-4 rounded-2xl rounded-tl-none shadow-md flex items-center gap-3 text-indigo-500 dark:text-indigo-400 text-xs font-bold italic">
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
        <footer className="p-4 md:p-6 pb-28 md:pb-6 bg-[var(--glass-footer-bg)] border-t border-theme-border/60 backdrop-blur-xl shrink-0">
          <div className="max-w-4xl mx-auto w-full">
            {selectedFileName && (
              <div className="mb-3 flex items-center gap-2 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg w-max text-xs font-semibold">
                <Paperclip size={14} />
                <span className="truncate max-w-[200px] md:max-w-[300px]">{selectedFileName}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedFileName(''); setSelectedFile(null); }}
                  className="hover:text-red-400 ml-1 transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <form
              onSubmit={handleSubmit}
              className={clsx(
                "relative flex items-end group",
                !canSend && "opacity-50 pointer-events-none"
              )}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={canSend ? "Ask your academic question..." : "Limit reached."}
                rows={1}
                className="w-full glass-panel-premium ai-chat-input py-3.5 pl-4 pr-[100px] rounded-2xl text-sm text-theme-primary font-medium placeholder:text-theme-muted transition-all resize-none min-h-[52px] max-h-[200px] overflow-y-auto scrollbar-hide align-bottom focus:outline-none"
                disabled={!canSend || isLoading}
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
              />

              <div className="absolute right-2.5 bottom-2 flex items-center gap-1">
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
                    "h-9 w-9 flex items-center justify-center transition-all rounded-xl cursor-pointer",
                    selectedFileName ? "text-indigo-500 bg-indigo-500/10 hidden" : "text-theme-muted hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-theme-surface-2",
                    plan === 'Free' && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-theme-muted"
                  )}
                  title={plan === 'Free' ? "Upload blocked on Free plan" : "Attach File"}
                >
                  <Paperclip size={18} />
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || !canSend || isLoading}
                  className={clsx(
                    "h-9 w-9 flex items-center justify-center rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-40 cursor-pointer",
                    input.trim() && canSend && !isLoading
                      ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-indigo-500/15"
                      : "bg-theme-surface/50 border border-theme-border/30 text-theme-muted"
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
                  {plan} Session • {limit === Infinity ? 'Unlimited Queries' : `${limit - usageCount} Queries Remaining`} • <span className="text-indigo-500 dark:text-indigo-400">Cortana AI v3.0</span>
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
