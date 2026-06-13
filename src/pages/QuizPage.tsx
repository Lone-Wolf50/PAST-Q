import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { HelpCircle, AlertTriangle, Shield, Clock, ArrowRight, CheckCircle2, XCircle, Sparkles, BookOpen, Trophy, Bot, X, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Link, useSearchParams, useBlocker, useNavigate } from 'react-router-dom';

// Lazy-load ReactMarkdown for performance — only loaded when Cortana drawer opens
const ReactMarkdown = lazy(() => import('react-markdown'));

interface Question {
  id: string;
  body: string;
  category: string;
  difficulty: string;
  options: string[];
  time_limit_seconds: number;
}

const QuizPage = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionIdParam = searchParams.get('session_id');
  const navigate = useNavigate();
  
  // Quiz State
  const [questionNumber, setQuestionNumber] = useState(0);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(10);
  
  // Subject State
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Structured Quiz & Exit States
  const [sessionStats, setSessionStats] = useState<any>(null);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [confirmQuitOpen, setConfirmQuitOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalConfig, setUpgradeModalConfig] = useState({
    title: '',
    message: '',
    confirmText: 'View Plans',
    cancelText: 'Maybe Later'
  });
  const [showSubjectErrorModal, setShowSubjectErrorModal] = useState(false);
  const [subjectErrorConfig, setSubjectErrorConfig] = useState({
    title: '',
    message: ''
  });

  // Blocker for client-side navigation warning
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isQuizActive && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setConfirmQuitOpen(true);
    }
  }, [blocker.state]);

  const handleConfirmQuit = () => {
    handleQuit();
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  };

  const handleCancelQuit = () => {
    setConfirmQuitOpen(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  // Cortana Explainer state
  const [cortanaDrawerOpen, setCortanaDrawerOpen] = useState(false);
  const [cortanaExplanation, setCortanaExplanation] = useState('');
  const [cortanaLoading, setCortanaLoading] = useState(false);
  const [cortanaError, setCortanaError] = useState('');

  // Refs for Cleanup Auto-submit (leaving page detection)
  const quizActiveRef = useRef(false);
  const activeQuestionIdRef = useRef<string | null>(null);
  const currentTokenRef = useRef(token);

  useEffect(() => {
    quizActiveRef.current = isQuizActive;
  }, [isQuizActive]);

  useEffect(() => {
    activeQuestionIdRef.current = currentQuestion?.id || null;
  }, [currentQuestion]);

  useEffect(() => {
    currentTokenRef.current = token;
  }, [token]);

  // Handle auto-starting a custom session from URL
  useEffect(() => {
    if (!token || !sessionIdParam) return;
    
    const initCustomQuiz = async () => {
      setLoading(true);
      setError('');
      setQuestionNumber(0);
      setSessionStats(null);
      setIsQuizFinished(false);
      setActiveSessionId(sessionIdParam);
      try {
        setIsQuizActive(true);
        await loadNextQuestion(sessionIdParam);
      } catch (err: any) {
        setError(err.message || 'Error loading custom practice session.');
        setLoading(false);
      }
    };
    initCustomQuiz();
  }, [token, sessionIdParam]);

  // Load available subjects
  useEffect(() => {
    if (!token) return;
    const fetchSubjects = async () => {
      setLoadingSubjects(true);
      try {
        const res = await apiFetch('/papers/subjects/all', { token });
        if (res.subjects) {
          setSubjects(res.subjects);
          // Set default subject if subjects exist
          if (res.subjects.length > 0) {
            setSelectedSubject(res.subjects[0].name);
          }
        }
      } catch (err) {
        console.error('Error fetching subjects:', err);
      } finally {
        setLoadingSubjects(false);
      }
    };
    fetchSubjects();
  }, [token]);

  // Disable text select, context menu, and copy hotkeys
  useEffect(() => {
    if (!isQuizActive) return;

    const handleCopy = (e: ClipboardEvent) => e.preventDefault();
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && ['c', 'v', 'u', 'x'].includes(e.key.toLowerCase())) ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I')
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isQuizActive]);

  // Block page exit/reload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isQuizActive && currentQuestion) {
        e.preventDefault();
        e.returnValue = 'Leaving the quiz will count as an incorrect submission. Are you sure?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isQuizActive, currentQuestion]);

  // Auto-submit blank answer when unmounting / navigating away
  useEffect(() => {
    return () => {
      if (quizActiveRef.current && activeQuestionIdRef.current) {
        const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/quiz/submit`;
        const body = JSON.stringify({
          question_id: activeQuestionIdRef.current,
          submitted_answer: ''
        });

        // Use sendBeacon for background delivery
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        } else {
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${currentTokenRef.current}`
            },
            body
          }).catch(() => {});
        }
      }
    };
  }, []);

  // Timer Tick handler
  useEffect(() => {
    if (isQuizActive && currentQuestion && !result) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            // Auto submit when time runs out
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isQuizActive, currentQuestion, result]);

  const startQuiz = async () => {
    if (!selectedSubject) {
      setError('Please select a subject to enter the Quiz Arena.');
      return;
    }

    // Instant client-side validation: find exact matching subject from loaded list
    const trimmedSubject = selectedSubject.trim();
    const matchedSubject = subjects.find(
      (sub) => sub.name.toLowerCase() === trimmedSubject.toLowerCase()
    );

    if (!matchedSubject && subjects.length > 0) {
      setSubjectErrorConfig({
        title: '📚 Subject Not Found',
        message: `The subject "${trimmedSubject}" does not match any available subject. Please select a valid subject from the list.`
      });
      setShowSubjectErrorModal(true);
      return;
    }

    // Use the exact DB name to avoid casing mismatches
    const subjectToSend = matchedSubject ? matchedSubject.name : trimmedSubject;

    setLoading(true);
    setError('');
    setQuestionNumber(0);
    setSessionStats(null);
    setIsQuizFinished(false);
    setActiveSessionId(null);
    setTotalQuestions(10);
    try {
      const res = await apiFetch('/quiz/session', {
        method: 'POST',
        token: token || undefined,
        body: { subject: subjectToSend }
      });
      if (res.session) {
        setActiveSessionId(res.session.id);
        setIsQuizActive(true);
        await loadNextQuestion(res.session.id);
      } else {
        throw new Error('Failed to create session');
      }
    } catch (err: any) {
      const body = err?.body || err?.response || err;
      if (body?.error === 'quiz_limit_reached') {
        setUpgradeModalConfig({
          title: '📝 Quiz Limit Reached',
          message: body.message || 'You have reached your daily quiz limit. Upgrade your plan for more practice quizzes!',
          confirmText: 'View Plans',
          cancelText: 'Maybe Later'
        });
        setShowUpgradeModal(true);
      } else if (body?.error === 'subject_not_available') {
        setSubjectErrorConfig({
          title: '📚 Subject Unavailable',
          message: body.message || `The subject "${selectedSubject}" is currently not available for practice quizzes. Please select a valid subject.`
        });
        setShowSubjectErrorModal(true);
      } else {
        const errMsg = err.message || '';
        if (errMsg.toLowerCase().includes('subject') || errMsg.toLowerCase().includes('foreign key')) {
          setSubjectErrorConfig({
            title: '📚 Subject Unavailable',
            message: `The subject "${selectedSubject}" is currently not available or does not exist. Please check the spelling or select a subject from the list.`
          });
          setShowSubjectErrorModal(true);
        } else {
          setError(err.message || 'Error starting session');
        }
      }
      setLoading(false);
    }
  };

  const loadNextQuestion = async (sessId?: string) => {
    setLoading(true);
    setError('');
    setSelectedAnswer(null);
    setResult(null);
    setCortanaDrawerOpen(false);
    setCortanaExplanation('');
    setCortanaError('');
    setCurrentQuestion(null);
    const targetSessionId = sessId || activeSessionId;
    try {
      const url = targetSessionId ? `/quiz/question?session_id=${targetSessionId}` : '/quiz/question';
      const res = await apiFetch(url, { token: token || undefined });
      if (res.question) {
        setCurrentQuestion(res.question);
        setTimeLeft(res.question.time_limit_seconds);
        if (res.questionIndex) {
          setQuestionNumber(res.questionIndex);
        } else {
          setQuestionNumber(prev => prev + 1);
        }
        if (res.subject) {
          setSelectedSubject(res.subject);
        }
        if (res.totalQuestions) {
          setTotalQuestions(res.totalQuestions);
        }
      } else {
        setError('Failed to fetch next question.');
      }
    } catch (err: any) {
      const body = err?.body || err?.response || err;
      if (body?.error === 'quiz_limit_reached') {
        setUpgradeModalConfig({
          title: '📝 Quiz Limit Reached',
          message: body.message || 'You have reached the 5-question Free plan limit for this quiz. Upgrade to a paid plan to take full-length 10-question quizzes!',
          confirmText: 'View Plans',
          cancelText: 'Maybe Later'
        });
        setShowUpgradeModal(true);
      } else {
        setError(err.message || 'Error loading question.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || !selectedAnswer || !currentQuestion) return;

    setIsSubmitting(true);
    setError('');
    try {
      const res = await apiFetch('/quiz/submit', {
        method: 'POST',
        token: token || undefined,
        body: {
          question_id: currentQuestion.id,
          submitted_answer: selectedAnswer,
          session_id: activeSessionId || undefined
        }
      });
      setResult(res);
      if (res.is_completed) {
        setSessionStats({
          points: res.session_points,
          correct: res.session_correct,
          total: res.session_total,
          badges: res.earned_badges
        });
      }
    } catch (err: any) {
      setError(err.message || 'Error submitting answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (!currentQuestion) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/quiz/submit', {
        method: 'POST',
        token: token || undefined,
        body: {
          question_id: currentQuestion.id,
          submitted_answer: '', // blank on time-limit expire
          session_id: activeSessionId || undefined
        }
      });
      setResult(res);
      if (res.is_completed) {
        setSessionStats({
          points: res.session_points,
          correct: res.session_correct,
          total: res.session_total,
          badges: res.earned_badges
        });
      }
    } catch (err: any) {
      setError('Timer expired. Automatic submit failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuit = () => {
    setConfirmQuitOpen(false);
    setIsQuizActive(false);
    setCurrentQuestion(null);
    setQuestionNumber(0);
    setResult(null);
    setSessionStats(null);
    setIsQuizFinished(false);
    setCortanaDrawerOpen(false);
    setCortanaExplanation('');
  };

  const askCortana = async () => {
    if (!currentQuestion || cortanaLoading) return;
    setCortanaDrawerOpen(true);
    setCortanaLoading(true);
    setCortanaError('');
    setCortanaExplanation('');
    try {
      const res = await apiFetch('/quiz/explain', {
        method: 'POST',
        token: token || undefined,
        body: { question_id: currentQuestion.id }
      });
      setCortanaExplanation(res.explanation || 'No explanation available.');
    } catch (err: any) {
      setCortanaError('Cortana is unavailable right now. Please try again.');
    } finally {
      setCortanaLoading(false);
    }
  };

  const handleConfirmUpgrade = () => {
    setShowUpgradeModal(false);
    navigate('/pricing');
  };

  // Render Modals helper to ensure modals are mounted across all early return screen states
  const renderModals = () => (
    <>
      {/* Confirm Quit Dialog */}
      <ConfirmModal
        isOpen={confirmQuitOpen}
        onClose={handleCancelQuit}
        onConfirm={handleConfirmQuit}
        title="Abandon Quiz Arena?"
        message="Are you sure you want to quit? All progress, streak, and points from this session will be permanently lost."
        confirmText="Quit Arena"
        cancelText="Stay & Complete"
        variant="danger"
      />

      {/* Upgrade Modal */}
      <ConfirmModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onConfirm={handleConfirmUpgrade}
        title={upgradeModalConfig.title}
        message={upgradeModalConfig.message}
        confirmText={upgradeModalConfig.confirmText}
        cancelText={upgradeModalConfig.cancelText}
        variant="info"
      />

      {/* Subject Error Modal */}
      <ConfirmModal
        isOpen={showSubjectErrorModal}
        onClose={() => setShowSubjectErrorModal(false)}
        onConfirm={() => setShowSubjectErrorModal(false)}
        title={subjectErrorConfig.title}
        message={subjectErrorConfig.message}
        confirmText="Choose Another"
        cancelText="Close"
        variant="warning"
      />
    </>
  );

  // Render Start Screen with Rules
  if (!isQuizActive) {
    return (
      <>
        <div className="w-full flex-grow flex flex-col items-center px-4 md:px-6 max-w-xl mx-auto py-10 pb-32 md:pb-16 gap-8 animate-fade-in">
        <div className="text-center">
          <div className="inline-flex p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl mb-4">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-theme-primary tracking-tight leading-none">
            Quiz <span className="text-indigo-400">Arena</span>
          </h1>
          <p className="text-sm text-theme-muted mt-2 font-medium">
            Test your knowledge with dynamic past paper questions!
          </p>
        </div>

        {/* Rules Card */}
        <div className="w-full rounded-2xl bg-theme-surface/50 border border-theme-border/50 p-6 backdrop-blur-sm shadow-xl flex flex-col gap-5">
          <h3 className="text-base font-extrabold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Integrity Rules
          </h3>

          <ul className="flex flex-col gap-4 text-xs font-semibold text-theme-secondary">
            <li className="flex gap-3 items-start">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>No Leaving:</strong> Navigating away, unmounting, or closing the tab will count as an automatic wrong submission.
              </span>
            </li>
            <li className="flex gap-3 items-start">
              <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>Anti-Cheat:</strong> Right-clicking, copy-pasting, and inspection hotkeys are disabled inside the arena.
              </span>
            </li>
            <li className="flex gap-3 items-start">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Timer:</strong> Each question has its own timer based on difficulty. Unsubmitted questions when timer hits 0 score 0 points.
              </span>
            </li>
            <li className="flex gap-3 items-start">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>
                <strong>Bonuses:</strong> Speed bonuses are awarded for correct answers under 3, 6, and 10 seconds. Correct streaks multiply your score!
              </span>
            </li>
          </ul>

          {/* Subject Selector */}
          <div className="flex flex-col gap-2 border-t border-theme-border/30 pt-4 mt-2">
            <label className="text-xs font-extrabold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Select Subject
            </label>
            {loadingSubjects ? (
              <div className="text-xs font-bold text-theme-muted py-2 animate-pulse">Loading subjects...</div>
            ) : (
              <>
                <input
                  type="text"
                  list="subjects-datalist"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  placeholder="Type or select a subject..."
                  className="w-full bg-theme-surface border border-theme-border text-theme-primary px-4 py-3.5 rounded-2xl text-sm font-bold focus:outline-none focus:border-indigo-500 focus:bg-theme-surface-2 transition-all placeholder:text-theme-muted"
                />
                <datalist id="subjects-datalist">
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.name} />
                  ))}
                </datalist>
              </>
            )}
          </div>

          <button
            onClick={startQuiz}
            disabled={loading || loadingSubjects || !selectedSubject.trim()}
            className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-2xl font-bold text-sm transition-all shadow-md shadow-indigo-500/15 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? 'Entering Arena...' : 'Enter Quiz Arena'}
            <ArrowRight className="w-4 h-4" />
          </button>

          {error && (
            <div className="flex flex-col items-center gap-3 mt-2">
              <p className="text-xs font-bold text-red-400 text-center">{error}</p>
              {(error.toLowerCase().includes('limit') || error.toLowerCase().includes('upgrade')) && (
                <Link
                  to="/pricing"
                  className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95"
                >
                  View Pricing & Upgrade
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
      {renderModals()}
    </>
    );
  }

  // Render Loading state (Premium Skeleton Loader)
  if (loading && !currentQuestion) {
    return (
      <div className="w-full flex-grow flex flex-col items-center px-4 md:px-6 max-w-xl mx-auto py-10 pb-32 md:pb-16 gap-6 animate-fade-in select-none">
        {/* Status Bar Skeleton */}
        <div className="w-full flex flex-col gap-3">
          <div className="w-full flex items-center justify-between">
            <div className="h-4 w-24 bg-theme-border/50 rounded-lg animate-pulse" />
            <div className="h-8 w-8 bg-theme-border/50 rounded-xl animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-theme-border/50 rounded-full animate-pulse" />
            <div className="h-5 w-16 bg-theme-border/50 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Question Card Skeleton */}
        <div className="w-full rounded-2xl bg-theme-surface/40 border border-theme-border/40 p-6 backdrop-blur-sm shadow-xl flex flex-col gap-2">
          <div className="h-4 w-full bg-theme-border/50 rounded-lg animate-pulse" />
          <div className="h-4 w-5/6 bg-theme-border/50 rounded-lg animate-pulse" />
          <div className="h-4 w-4/6 bg-theme-border/50 rounded-lg animate-pulse" />
        </div>

        {/* Options Skeleton */}
        <div className="w-full flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-full h-[56px] rounded-2xl border border-theme-border/30 bg-theme-surface/20 flex items-center px-4 gap-4 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-theme-border/50" />
              <div className="h-4 w-3/4 bg-theme-border/50 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isQuizFinished && sessionStats) {
    const accuracy = Math.round((sessionStats.correct / sessionStats.total) * 100);

    return (
      <>
        <div className="w-full flex-grow flex flex-col items-center px-4 md:px-6 max-w-xl mx-auto py-10 pb-32 md:pb-16 gap-8 animate-fade-in select-none">
        <div className="text-center">
          <div className="inline-flex p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-3xl mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <Trophy className="w-10 h-10 animate-bounce" />
          </div>
          <h1 className="text-3xl font-black text-theme-primary tracking-tight leading-none">
            Quiz <span className="text-indigo-400">Completed!</span>
          </h1>
          <p className="text-sm text-theme-muted mt-2 font-medium">
            Excellent work. Your points have been saved to your profile!
          </p>
        </div>

        {/* Stats Card */}
        <div className="w-full rounded-3xl bg-theme-surface/50 border border-theme-border/50 p-6 md:p-8 backdrop-blur-md shadow-2xl flex flex-col gap-6 relative overflow-hidden">
          {/* Accent Glows */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

          {/* Subject Badge */}
          <div className="self-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 border border-indigo-500/25 text-indigo-300">
            {selectedSubject}
          </div>

          {/* Main Score & Accuracy Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Points Earned */}
            <div className="bg-theme-surface/30 border border-theme-border/30 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-theme-muted block mb-1">Points Gained</span>
              <span className="text-3xl font-black text-emerald-400">+{sessionStats.points}</span>
              <span className="text-[9px] font-bold text-theme-muted uppercase tracking-wider block mt-1">PTS</span>
            </div>

            {/* Accuracy */}
            <div className="bg-theme-surface/30 border border-theme-border/30 rounded-2xl p-4 text-center">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-theme-muted block mb-1">Accuracy</span>
              <span className="text-3xl font-black text-indigo-400">{accuracy}%</span>
              <span className="text-[9px] font-bold text-theme-muted uppercase tracking-wider block mt-1">
                {sessionStats.correct} / {sessionStats.total} Correct
              </span>
            </div>
          </div>

          {/* Badges Earned Section */}
          {sessionStats.badges && sessionStats.badges.length > 0 && (
            <div className="border-t border-theme-border/30 pt-6 flex flex-col gap-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 justify-center">
                <Sparkles className="w-4 h-4" />
                Badges Unlocked
              </h4>
              <div className="flex flex-col gap-2">
                {sessionStats.badges.map((slug: string) => (
                  <div key={slug} className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-left">
                    <span className="p-1 rounded bg-amber-500/10 text-amber-400 shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-theme-primary font-bold text-xs uppercase tracking-wide">
                        {slug.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </div>
                      <div className="text-[10px] text-theme-muted">Unlocked on global profile!</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 border-t border-theme-border/30 pt-6 mt-2">
            <button
              onClick={startQuiz}
              className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold text-sm transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              Start Another Quiz
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/leaderboard"
                className="py-3.5 border border-theme-border/80 text-theme-primary hover:bg-theme-surface/50 rounded-2xl font-bold text-xs text-center transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trophy className="w-3.5 h-3.5" />
                Leaderboard
              </Link>
              <Link
                to="/papers"
                className="py-3.5 border border-theme-border/80 text-theme-primary hover:bg-theme-surface/50 rounded-2xl font-bold text-xs text-center transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Study Papers
              </Link>
            </div>
          </div>
        </div>
      </div>
      {renderModals()}
    </>
    );
  }

  // Render Question / Result Arena
  return (
    <div className="w-full flex-grow flex flex-col items-center px-4 md:px-6 max-w-xl mx-auto py-10 pb-32 md:pb-16 gap-6 animate-fade-in select-none">
      {currentQuestion && (
        <div className="w-full flex flex-col gap-6 animate-slide-up">
          {/* Status Bar */}
          <div className="w-full flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                  {selectedSubject}
                </span>
                <span className="text-sm font-black text-theme-primary tracking-tight">
                  Question <span className="text-indigo-400">{questionNumber}</span> of <span className="text-theme-primary">{totalQuestions}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Timer */}
                {!result && (
                  <div className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors shadow-sm",
                    timeLeft <= 10
                      ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
                      : "bg-theme-surface border-theme-border text-theme-secondary"
                  )}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{timeLeft}s</span>
                  </div>
                )}
                {/* Quit Arena Button */}
                <button
                  onClick={() => setConfirmQuitOpen(true)}
                  title="Quit Arena"
                  className="p-2 rounded-xl bg-theme-surface border border-theme-border hover:bg-theme-surface-2 text-theme-muted hover:text-red-400 transition-colors shadow-sm cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Badges Row */}
            <div className="flex gap-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                {currentQuestion.category}
              </span>
              <span className={clsx(
                "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border",
                currentQuestion.difficulty === 'Easy' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                currentQuestion.difficulty === 'Medium' && "bg-amber-500/10 border-amber-500/20 text-amber-400",
                currentQuestion.difficulty === 'Hard' && "bg-red-500/10 border-red-500/20 text-red-400"
              )}>
                {currentQuestion.difficulty}
              </span>
            </div>
          </div>

          {/* Question Body */}
          <div className="w-full rounded-2xl bg-theme-surface/60 border border-theme-border/50 p-5 md:p-6 backdrop-blur-sm shadow-xl">
            <p className="text-base font-semibold leading-relaxed text-theme-primary">
              {currentQuestion.body}
            </p>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-3.5">
            {currentQuestion.options.map((option, idx) => {
              const label = ['A', 'B', 'C', 'D'][idx] ?? String(idx + 1);
              const isSelected = selectedAnswer === option;
              const isCorrectResult = result?.is_correct && selectedAnswer === option;
              const isUserWrongSubmit = result && selectedAnswer === option && !result.is_correct;

              return (
                <button
                  key={idx}
                  disabled={!!result || isSubmitting}
                  onClick={() => setSelectedAnswer(option)}
                  className={clsx(
                    "w-full text-left px-4 py-4 rounded-2xl border font-semibold text-sm transition-all duration-200 cursor-pointer flex items-center gap-4",
                    isSelected && !result && "bg-indigo-500/10 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.25)]",
                    !isSelected && !result && "bg-theme-surface/40 border-theme-border hover:border-theme-border/80 hover:bg-theme-surface/60",
                    result && isCorrectResult && "bg-emerald-500/10 border-emerald-500",
                    result && isUserWrongSubmit && "bg-red-500/10 border-red-500"
                  )}
                >
                  {/* Letter badge */}
                  <span className={clsx(
                    "shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black border",
                    isSelected && !result && "bg-indigo-500 border-indigo-500 text-white",
                    !isSelected && !result && "bg-theme-surface border-theme-border text-theme-muted",
                    result && isCorrectResult && "bg-emerald-500 border-emerald-500 text-white",
                    result && isUserWrongSubmit && "bg-red-500 border-red-500 text-white",
                    result && !isCorrectResult && !isUserWrongSubmit && "bg-theme-surface border-theme-border text-theme-muted"
                  )}>
                    {label}
                  </span>

                  {/* Option text */}
                  <span className={clsx(
                    "flex-1 text-left",
                    result && isCorrectResult && "text-emerald-400",
                    result && isUserWrongSubmit && "text-red-400"
                  )}>{option}</span>

                  {/* Result icon */}
                  {result && isCorrectResult && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {result && isUserWrongSubmit && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Submit / Feedback Result Panel */}
          {!result ? (
            <div className={clsx(
              "w-full",
              "fixed bottom-0 left-0 right-0 p-4 bg-theme-base/95 border-t border-theme-border/60 backdrop-blur-md z-30",
              "md:relative md:bottom-auto md:p-0 md:bg-transparent md:border-t-0 md:backdrop-blur-none"
            )}>
              <button
                onClick={handleSubmit}
                disabled={!selectedAnswer || isSubmitting}
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-2xl font-bold text-sm transition-all shadow-md shadow-indigo-500/15 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Verifying Answer...' : 'Submit Answer'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 animate-fade-in w-full">
              {/* Feedback Banner (stays in scroll flow) */}
              <div className={clsx(
                "w-full rounded-2xl border p-5 flex items-start gap-4",
                result.is_correct
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              )}>
                {result.is_correct ? (
                  <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-base font-extrabold leading-none">
                    {result.is_correct ? 'Correct Answer!' : result.is_expired ? 'Time Expired!' : 'Incorrect Answer!'}
                  </h4>
                  <p className="text-xs font-semibold mt-2 text-theme-secondary leading-relaxed">
                    {result.is_correct
                      ? `Nice work! You earned +${result.points_awarded} points for answering correctly in ${(result.time_taken_ms / 1000).toFixed(1)}s.`
                      : result.is_expired
                        ? `Time ran out before you could answer. Keep going!`
                        : `That wasn't the right answer. The correct answers will be revealed when you complete the quiz.`
                    }
                  </p>

                  {/* Badges Congratulation banner */}
                  {result.earned_badges && result.earned_badges.length > 0 && (
                    <div className="mt-4 p-3 bg-indigo-500/15 border border-indigo-500/25 rounded-xl flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-indigo-400 font-extrabold text-[11px] uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        Badge Unlocked!
                      </div>
                      {result.earned_badges.map((slug: string) => (
                        <span key={slug} className="text-xs font-bold text-white">
                          🎉 You earned the "{slug.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}" Badge!
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Sticky Container (sticky on mobile, relative on desktop) */}
              <div className={clsx(
                "w-full flex flex-col gap-3",
                "fixed bottom-0 left-0 right-0 p-4 bg-theme-base/95 border-t border-theme-border/60 backdrop-blur-md z-30",
                "md:relative md:bottom-auto md:p-0 md:bg-transparent md:border-t-0 md:backdrop-blur-none"
              )}>
                {/* 1. Next Question Button (Primary) */}
                <button
                  onClick={() => {
                    if (questionNumber >= totalQuestions) {
                      setIsQuizFinished(true);
                    } else {
                      setCortanaDrawerOpen(false);
                      setCortanaExplanation('');
                      setCortanaError('');
                      setCurrentQuestion(null);
                      loadNextQuestion();
                    }
                  }}
                  className={clsx(
                    "w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 shadow-lg",
                    questionNumber >= totalQuestions
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
                      : "bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20"
                  )}
                >
                  {questionNumber >= totalQuestions ? 'Finish & View Results' : 'Next Question'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* 2. Ask Cortana Button (Secondary) */}
                <button
                  onClick={askCortana}
                  disabled={cortanaLoading}
                  className="w-full py-3.5 flex items-center justify-center gap-2.5 rounded-2xl border border-violet-500/40 bg-gradient-to-r from-violet-500/5 to-indigo-500/5 hover:from-violet-500/10 hover:to-indigo-500/10 text-violet-300 font-bold text-sm transition-all duration-200 cursor-pointer shadow-[0_0_15px_rgba(139,92,246,0.05)] hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] active:scale-[0.99]"
                >
                  {cortanaLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bot className="w-4 h-4 text-violet-400" />
                  )}
                  {cortanaLoading ? 'Cortana is thinking...' : 'Ask Cortana to Explain'}
                  {!cortanaLoading && <Sparkles className="w-3.5 h-3.5 opacity-60" />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs font-bold text-red-400 text-center">{error}</p>
          )}
        </div>
      )}

      {/* ── CORTANA POPUP MODAL ── */}
      {/* Backdrop */}
      {cortanaDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
          onClick={() => setCortanaDrawerOpen(false)}
        />
      )}
      {/* Modal / Drawer Wrapper */}
      <div
        className={clsx(
          'fixed z-50 transition-all duration-300 ease-out',
          // Mobile: slides up from bottom
          'bottom-0 left-0 right-0 w-full',
          // Desktop: centered popup
          'md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[90vw] md:max-w-xl',
          cortanaDrawerOpen 
            ? 'translate-y-0 opacity-100 scale-100' 
            : 'translate-y-full md:translate-y-10 md:opacity-0 md:scale-95 pointer-events-none'
        )}
      >
        <div className="mx-auto w-full px-4 pb-6 md:p-0">
          <div className={clsx(
            "bg-[rgba(15,12,30,0.96)] border border-violet-500/25 shadow-[0_-4px_80px_rgba(139,92,246,0.3)] backdrop-blur-2xl overflow-hidden",
            // Mobile: curved top corners
            "rounded-t-[2.5rem] md:rounded-[2.5rem]"
          )}>
            {/* Handle - mobile only */}
            <div className="flex justify-center pt-4 pb-2 md:hidden">
              <div className="w-12 h-1 rounded-full bg-violet-500/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-violet-500/15">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30">
                  <Bot className="w-4 h-4 text-violet-300" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white leading-none">Cortana</h3>
                  <p className="text-[10px] text-violet-400/70 font-semibold mt-0.5">AI Quiz Tutor</p>
                </div>
              </div>
              <button
                onClick={() => setCortanaDrawerOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/5 text-theme-muted hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 max-h-[60vh] md:max-h-[50vh] overflow-y-auto">
              {cortanaLoading && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <p className="text-xs text-violet-400/70 font-semibold">Cortana is analyzing the question...</p>
                </div>
              )}

              {cortanaError && !cortanaLoading && (
                <div className="text-center py-6">
                  <p className="text-sm text-red-400 font-semibold">{cortanaError}</p>
                  <button
                    onClick={askCortana}
                    className="mt-3 text-xs font-bold text-violet-400 hover:text-violet-300 cursor-pointer"
                  >
                    Try again
                  </button>
                </div>
              )}

              {cortanaExplanation && !cortanaLoading && (
                <div className="cortana-markdown text-sm text-theme-secondary leading-relaxed">
                  <Suspense fallback={
                    <p className="text-xs text-theme-muted animate-pulse">Rendering explanation...</p>
                  }>
                    <ReactMarkdown>{cortanaExplanation}</ReactMarkdown>
                  </Suspense>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {renderModals()}
    </div>
  );
};

export default QuizPage;
