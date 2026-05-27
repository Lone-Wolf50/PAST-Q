import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Download, Sparkles, AlertCircle, 
  BookOpen, Target, Lightbulb, ShieldAlert,
  Loader2, ChevronDown, ChevronUp, Star, Flag, FileCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import ReportModal from '../components/ReportModal';
import { AlertModal } from '../components/ui/AlertModal';

const PaperViewerPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  const [paper, setPaper] = useState<any>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInsightsOpen, setIsInsightsOpen] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [isRevealing, setIsRevealing] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  // Bookmark state
  const isPremium = ['basic', 'plus', 'pro'].includes(user?.plan?.toLowerCase() || '');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // Report modal
  const [showReport, setShowReport] = useState(false);

  const [alert, setAlert] = useState<{ show: boolean; title: string; message: string; variant: 'success' | 'error' | 'info' }>({
    show: false,
    title: '',
    message: '',
    variant: 'info'
  });

  useEffect(() => {
    const fetchPaper = async () => {
      try {
        const res = await apiFetch(`/papers/${id}`, { token: token! });
        setPaper(res.paper);
        
        // Auto-fetch view URL
        try {
          const dl = await apiFetch(`/papers/${id}/view`, { method: 'POST', token: token! });
          setViewUrl(dl.file_url);
        } catch (dlErr: any) {

        }
      } catch (err: any) {
        setError(err.message || 'Failed to load paper.');
      } finally {
        setLoading(false);
      }
    };

    if (id && token) fetchPaper();
  }, [id, token]);

  // Load bookmark state for premium users
  useEffect(() => {
    if (!id || !token || !isPremium) return;
    apiFetch('/papers/bookmarks/ids', { token: token! })
      .then(res => setIsBookmarked((res.ids || []).includes(id)))
      .catch(() => {});
  }, [id, token, isPremium]);

  const handleToggleBookmark = async () => {
    if (bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      const res = await apiFetch(`/papers/${id}/bookmark`, { method: 'POST', token: token! });
      setIsBookmarked(res.bookmarked);
    } catch {
      // silently fail
    } finally {
      setBookmarkLoading(false);
    }
  };



  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await apiFetch(`/papers/${id}/download`, { method: 'POST', token: token! });
      window.open(res.file_url, '_blank');
    } catch (err: any) {
      setAlert({
        show: true,
        title: 'Download Failed',
        message: err.message || 'Download failed.',
        variant: 'error'
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleAskAI = () => {
    navigate(`/ask-ai?paperId=${id}`);
  };


  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-theme-muted">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="font-medium animate-pulse">Opening academic archives...</p>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-400 border border-red-500/20 shadow-lg shadow-red-500/5">
           <ShieldAlert size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-theme-primary mb-2">Paper Not Found</h2>
          <p className="text-theme-muted max-w-md mx-auto">
            {error || "The paper you are looking for might have been moved or doesn't exist anymore."}
          </p>
        </div>
        <Link to="/papers" className="px-6 py-3 bg-theme-surface-2 rounded-2xl font-bold text-theme-primary border border-theme-border hover:bg-theme-surface transition-all">
          Return to Papers
        </Link>
      </div>
    );
  }

  const insights = paper.insights;
  const subjectName = paper.upsa_subjects?.name || paper.subject;
  const subjectCode = paper.upsa_subjects?.code || paper.code;

  return (
    <div className="w-full flex-grow flex flex-col px-4 md:px-8 max-w-7xl mx-auto py-6 h-[calc(100vh-72px)] overflow-hidden">
      
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <Link 
            to="/papers" 
            className="flex items-center justify-center w-11 h-11 rounded-2xl bg-theme-surface border border-theme-border hover:bg-theme-surface-2 text-theme-muted hover:text-theme-primary transition-all group shrink-0"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{subjectCode}</span>
              <span className="w-1 h-1 rounded-full bg-theme-border" />
              <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">{paper.year} • {paper.semester} Sem</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-theme-primary tracking-tight leading-none">{subjectName}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Flag / Report button — visible to all users */}
          <button
            onClick={() => setShowReport(true)}
            title="Report an issue with this paper"
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-theme-surface border border-theme-border text-theme-muted hover:text-red-400 hover:border-red-500/30 transition-all group relative"
          >
            <Flag className="w-4 h-4 group-hover:scale-110 transition-transform" />
            {/* Tooltip */}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-theme-surface border border-theme-border rounded-lg text-[10px] font-bold text-theme-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              Report an issue
            </span>
          </button>

          {/* Bookmark button — premium only */}
          {isPremium ? (
            <button
              onClick={handleToggleBookmark}
              disabled={bookmarkLoading}
              title={isBookmarked ? 'Remove bookmark' : 'Save this paper'}
              className={clsx(
                'w-11 h-11 flex items-center justify-center rounded-2xl border transition-all group relative',
                isBookmarked
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-theme-surface border-theme-border text-theme-muted hover:text-amber-400 hover:border-amber-500/30'
              )}
            >
              <Star className={clsx('w-4 h-4 group-hover:scale-110 transition-transform', isBookmarked && 'fill-amber-400')} />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-theme-surface border border-theme-border rounded-lg text-[10px] font-bold text-theme-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                {isBookmarked ? 'Remove bookmark' : 'Save paper'}
              </span>
            </button>
          ) : (
            <div title="Upgrade to save papers" className="w-11 h-11 flex items-center justify-center rounded-2xl bg-theme-surface border border-dashed border-theme-border text-theme-muted/40 cursor-not-allowed relative group">
              <Star className="w-4 h-4" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-theme-surface border border-theme-border rounded-lg text-[10px] font-bold text-theme-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Upgrade to save papers
              </span>
            </div>
          )}

          {paper.has_answers && paper.answer_url && (
            <a 
              href={paper.answer_url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              <FileCheck size={16} />
              View Answers
            </a>
          )}

          <button 
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold text-theme-primary bg-theme-surface-2 hover:bg-theme-surface border border-theme-border transition-all active:scale-95 disabled:opacity-50"
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download className="w-4 h-4" />}
            Download
          </button>
          
          <button 
            onClick={handleAskAI}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span className="whitespace-nowrap">Ask Tutor</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-y-auto lg:overflow-visible pb-10 lg:pb-0 scrollbar-hide">
        
        {/* ── Document Viewer ─────────────────────────────────────────────── */}
        <div className="flex-[1.5] flex flex-col min-h-[400px] lg:min-h-0 bg-theme-surface border border-theme-border rounded-[2rem] overflow-hidden shadow-xl relative group">
          {viewUrl ? (
            <iframe 
              src={`${viewUrl}#toolbar=0`} 
              title={`Document viewer for ${subjectName}`}
              className="w-full h-full bg-white"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-12 text-center bg-theme-surface-2/30">
               <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 border border-amber-500/20">
                  <ShieldAlert size={32} />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-theme-primary mb-2">Access Restricted</h3>
                  <p className="text-sm text-theme-muted max-w-xs mx-auto leading-relaxed font-medium">
                    You have reached your free view limit. Upgrade to a premium plan to continue studying!
                  </p>
               </div>
               <Link to="/pricing" className="px-8 py-3 bg-amber-500 text-black text-xs font-bold rounded-2xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20">
                  Upgrade Now
               </Link>
            </div>
          )}
          
          {/* Answer Key Badge Overlay */}
          {paper.has_answers && (
            <div className="absolute bottom-4 left-4 right-4 bg-emerald-500/90 backdrop-blur-md text-white px-4 py-3 rounded-2xl flex items-center gap-3 shadow-lg border border-emerald-400/20">
               <AlertCircle size={18} className="shrink-0" />
               <p className="text-[11px] font-bold leading-tight">Official Answer Key Attached • Verified Content</p>
            </div>
          )}
        </div>

        {/* ── AI Insights Sidebar ─────────────────────────────────────────── */}
        <aside className="lg:w-[380px] flex flex-col gap-4 min-h-[500px] lg:min-h-0 shrink-0">
          
          {/* Insights Card */}
          <div className="flex-1 bg-theme-surface border border-theme-border rounded-[2rem] flex flex-col overflow-hidden shadow-xl">
             <header className="p-5 border-b border-theme-border flex items-center justify-between bg-theme-surface-2/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-theme-primary tracking-tight">Tutor Insights</h3>
                    <p className="text-[10px] text-theme-muted font-bold uppercase tracking-wider">AI Powered Analysis</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsInsightsOpen(!isInsightsOpen)}
                  className="p-2 text-theme-muted hover:text-theme-primary transition-colors"
                >
                  {isInsightsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
             </header>

             <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide">
                {!insights ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-theme-surface-2/20 rounded-3xl border border-dashed border-theme-border">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-indigo-500/5 text-indigo-400/50">
                      <Sparkles size={24} />
                    </div>
                    <h4 className="text-sm font-bold text-theme-primary mb-2 uppercase tracking-wide">
                      No Insights Yet
                    </h4>
                    <p className="text-[10px] text-theme-muted font-bold leading-relaxed mb-6">
                      Automated insights are not available for this paper. But you can still ask the AI Tutor questions directly!
                    </p>

                    {user?.plan?.toLowerCase() === 'free' && (
                      <Link
                        to="/upgrade"
                        className="w-full py-3 bg-theme-surface border border-theme-border text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-theme-surface-2 transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles size={14} />
                        Upgrade to Unlock
                      </Link>
                    )}
                  </div>

                ) : !isRevealed ? (
                   <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-theme-surface-2/20 rounded-3xl border border-dashed border-theme-border">
                     <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-emerald-500/10 text-emerald-400">
                       <Sparkles size={24} />
                     </div>
                     <h4 className="text-sm font-bold text-theme-primary mb-2 uppercase tracking-wide">
                       Insights Available
                     </h4>
                     <p className="text-[10px] text-theme-muted font-bold leading-relaxed mb-6">
                       Our AI Tutor has analyzed this paper and provided helpful study notes!
                     </p>

                      <button
                        onClick={() => {
                          setIsRevealing(true);
                          setTimeout(() => {
                            setIsRevealed(true);
                            setIsRevealing(false);
                          }, 1200);
                        }}
                        disabled={isRevealing}
                        className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isRevealing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {isRevealing ? 'Decoding Analysis...' : 'Reveal Study Insights'}
                      </button>
                   </div>
                ) : (
                  <AnimatePresence>
                    {isInsightsOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        {/* Summary */}
                        <div className="space-y-2">
                           <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                              <BookOpen size={12} />
                              <span>Executive Summary</span>
                           </div>
                           <p className="text-xs leading-relaxed text-theme-secondary font-medium">
                              {insights.summary}
                           </p>
                        </div>

                        {/* Topics */}
                        <div className="space-y-3">
                           <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                              <Target size={12} />
                              <span>Key Focus Areas</span>
                           </div>
                           <div className="flex flex-wrap gap-2">
                              {insights.topics?.map((topic: string) => (
                                <span key={topic} className="px-3 py-1.5 bg-theme-surface-2 border border-theme-border rounded-xl text-[10px] font-bold text-theme-primary shadow-sm hover:border-indigo-500/30 transition-colors">
                                  {topic}
                                </span>
                              ))}
                           </div>
                        </div>

                        {/* Difficulty Card */}
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 shadow-inner">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-theme-muted uppercase">Difficulty Rating</span>
                              <span className={clsx(
                                "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter",
                                insights.difficulty === 'Advanced' ? "bg-red-500/20 text-red-400" :
                                insights.difficulty === 'Intermediate' ? "bg-amber-500/20 text-amber-400" :
                                "bg-emerald-500/20 text-emerald-400"
                              )}>
                                {insights.difficulty}
                              </span>
                           </div>
                        </div>

                        {/* Hardest Question */}
                        <div className="space-y-3">
                           <div className="flex items-center gap-2 text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                              <ShieldAlert size={12} />
                              <span>Hardest Question & Solution</span>
                           </div>
                           <div className="p-4 bg-theme-surface-2 border border-theme-border rounded-2xl text-[11px] font-medium leading-relaxed text-theme-secondary whitespace-pre-wrap shadow-sm">
                              {insights.hardest_question}
                           </div>
                        </div>

                        {/* Exam Tips */}
                        <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-3">
                           <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                              <Lightbulb size={12} />
                              <span>Tutor's Secret Tips</span>
                           </div>
                           <p className="text-[11px] leading-relaxed text-theme-secondary font-medium whitespace-pre-wrap italic">
                              "{insights.exam_tips}"
                           </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
             </div>

             <div className="p-5 bg-theme-surface-2/50 border-t border-theme-border shrink-0">
                <button 
                  onClick={handleAskAI}
                  className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                >
                  <Sparkles size={14} />
                  Explain this paper more
                </button>
             </div>
          </div>

        </aside>

      </div>

      {/* Report Modal */}
      {showReport && paper && (
        <ReportModal
          paperId={id!}
          paperTitle={paper.upsa_subjects?.name || paper.title || 'This Paper'}
          token={token!}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Alert Modal */}
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

export default PaperViewerPage;
