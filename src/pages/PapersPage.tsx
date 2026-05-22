import { useState, useEffect } from 'react';
import { Search, BookOpen, Download, Eye, Star, Flame, FileCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useLocation, Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { AlertModal } from '../components/ui/AlertModal';

interface Paper {
  id: string;
  title: string;
  year: string;
  semester: string;
  has_answers?: boolean;
  answer_url?: string;
  upsa_subjects?: { name: string; code: string };
}

const PapersPage = () => {
  const { token, user } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(() => {
    return sessionStorage.getItem('papers_selected_subject') || null;
  });
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(() => {
    return sessionStorage.getItem('papers_selected_department') || null;
  });
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    return sessionStorage.getItem('papers_selected_year') || '';
  });
  const [selectedSemester, setSelectedSemester] = useState<string>(() => {
    return sessionStorage.getItem('papers_selected_semester') || '';
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    return sessionStorage.getItem('papers_search_query') || '';
  });
  const [showSaved, setShowSaved] = useState(() => {
    return sessionStorage.getItem('papers_show_saved') === 'true';
  });
  const [page, setPage] = useState<number>(() => {
    const saved = sessionStorage.getItem('papers_page');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPapers, setTotalPapers] = useState(0);

  // Save filter state to sessionStorage whenever it changes to preserve it on navigation back
  useEffect(() => {
    if (selectedSubject === null) sessionStorage.removeItem('papers_selected_subject');
    else sessionStorage.setItem('papers_selected_subject', selectedSubject);
  }, [selectedSubject]);

  useEffect(() => {
    if (selectedDepartment === null) sessionStorage.removeItem('papers_selected_department');
    else sessionStorage.setItem('papers_selected_department', selectedDepartment);
  }, [selectedDepartment]);

  useEffect(() => {
    sessionStorage.setItem('papers_selected_year', selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    sessionStorage.setItem('papers_selected_semester', selectedSemester);
  }, [selectedSemester]);

  useEffect(() => {
    sessionStorage.setItem('papers_search_query', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    sessionStorage.setItem('papers_show_saved', showSaved.toString());
  }, [showSaved]);

  useEffect(() => {
    sessionStorage.setItem('papers_page', page.toString());
  }, [page]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg
        setItemsPerPage(20); // 4 x 5
      } else if (window.innerWidth >= 768) { // md
        setItemsPerPage(10); // 2 x 5
      } else {
        setItemsPerPage(5); // 1 x 5
      }
    };

    handleResize(); // Initial call
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [papers, setPapers] = useState<Paper[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [bookmarkLoading, setBookmarkLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<number>(0);

  const isPremium = ['basic', 'plus', 'pro'].includes(user?.plan?.toLowerCase() || '');

  const [alert, setAlert] = useState<{ show: boolean; title: string; message: string; variant: 'success' | 'error' | 'info' }>({
    show: false,
    title: '',
    message: '',
    variant: 'info'
  });

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const subjectParam = queryParams.get('subject');

  useEffect(() => {
    if (subjectParam) {
      setSelectedSubject(subjectParam);
    }
  }, [subjectParam]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        if (showSaved) {
          const res = await apiFetch('/papers/bookmarks', { token: token! });
          if (res.papers) {
            setPapers(res.papers);
            setTotalPapers(res.papers.length);
          }
        } else {
          const params = new URLSearchParams();
          params.append('page', page.toString());
          params.append('limit', itemsPerPage.toString());
          if (selectedYear) params.append('year', selectedYear);
          if (selectedSemester) params.append('semester', selectedSemester);
          if (searchQuery) params.append('search', searchQuery);
          if (selectedSubject) params.append('subject_name', selectedSubject);

          const papersData = await apiFetch(`/papers?${params.toString()}`, { token: token! });

          if (papersData.papers) {
            setPapers(papersData.papers);
            setTotalPapers(papersData.total || 0);
          }
        }
      } catch (err) {

      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token, page, itemsPerPage, selectedYear, selectedSemester, searchQuery, selectedSubject, showSaved]);

  // Load bookmark IDs for premium users
  useEffect(() => {
    if (!token || !isPremium) return;
    apiFetch('/papers/bookmarks/ids', { token: token! })
      .then(res => setBookmarkedIds(new Set(res.ids || [])))
      .catch(() => { });
  }, [token, isPremium]);

  // Load streak from session storage (set by AuthContext ping)
  useEffect(() => {
    const stored = sessionStorage.getItem('streak_count');
    if (stored) setStreak(parseInt(stored, 10));
  }, []);

  const handleToggleBookmark = async (e: React.MouseEvent, paperId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isPremium || bookmarkLoading) return;
    setBookmarkLoading(paperId);
    try {
      const res = await apiFetch(`/papers/${paperId}/bookmark`, { method: 'POST', token: token! });
      setBookmarkedIds(prev => {
        const next = new Set(prev);
        if (res.bookmarked) next.add(paperId);
        else next.delete(paperId);
        return next;
      });
    } catch {
      // silently fail
    } finally {
      setBookmarkLoading(null);
    }
  };

  const handleDownload = async (paperId: string, action: 'view' | 'download') => {
    try {
      const res = await apiFetch(`/papers/${paperId}/download`, {
        method: 'POST',
        token: token!
      });

      if (res.error) {
        setAlert({
          show: true,
          title: 'Download Error',
          message: res.message || 'Unable to download. Please try again later.',
          variant: 'error'
        });
        return;
      }

      if (res.file_url) {
        if (action === 'view') {
          window.open(res.file_url.split('?')[0], '_blank');
        } else {
          const link = document.createElement('a');
          link.href = res.file_url;
          link.download = '';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (err: any) {
      const body = err?.body || err?.response;
      if (body?.error === 'limit_reached') {
        setAlert({
          show: true,
          title: 'Limit Reached',
          message: body.message,
          variant: 'info'
        });
      } else {
        setAlert({
          show: true,
          title: 'Error',
          message: 'An error occurred while requesting the document.',
          variant: 'error'
        });
      }
    }
  };

  const filteredPapers = papers.filter(() => {
    // Tabs are active and clickable, but they do not filter papers as requested:
    // "when they click nothing should work not even papers not found"
    return true;
  });

  const totalPages = showSaved ? Math.ceil(filteredPapers.length / itemsPerPage) : Math.ceil(totalPapers / itemsPerPage);
  const displayedPapers = showSaved ? filteredPapers.slice((page - 1) * itemsPerPage, page * itemsPerPage) : filteredPapers;

  return (
    <div className="w-full flex-grow flex flex-col px-4 md:px-8 max-w-7xl mx-auto py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-theme-primary">Browse Papers</h1>
            {/* Streak Badge */}
            {streak > 0 && (
              <div className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black border transition-all',
                streak >= 7
                  ? 'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 border-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse font-extrabold'
                  : streak >= 3
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
              )}>
                <Flame className={clsx("w-3.5 h-3.5", streak >= 7 && "animate-[bounce_1.2s_infinite] text-yellow-200 drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]")} />
                {streak} Day{streak !== 1 ? 's' : ''} Streak
              </div>
            )}
          </div>
          <p className="text-theme-muted">Find and download past questions to boost your preparation.</p>
        </div>

        <div className="flex flex-col sm:flex-row flex-nowrap sm:flex-wrap items-start sm:items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64 lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); setShowSaved(false); }}
              placeholder="Search papers..."
              className="w-full bg-theme-surface border border-theme-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-theme-primary placeholder-gray-500 focus:outline-none focus:border-indigo-400/50 transition-all shadow-sm"
            />
          </div>
          <div className="flex flex-nowrap gap-2 w-full sm:w-auto">
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }}
              className="theme-select text-[11px] font-bold uppercase tracking-tight py-2.5 px-3 flex-1 sm:flex-none w-1/2 sm:w-[100px]"
            >
              <option value="">All Years</option>
              {[2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            <select
              value={selectedSemester}
              onChange={(e) => { setSelectedSemester(e.target.value); setPage(1); }}
              className="theme-select text-[11px] font-bold uppercase tracking-tight py-2.5 px-3 flex-1 sm:flex-none w-1/2 sm:w-[100px]"
            >
              <option value="">Semesters</option>
              <option value="First">First</option>
              <option value="Second">Second</option>
            </select>
          </div>
        </div>
      </div>

      {/* Department / Saved Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-6 mb-8 scrollbar-hide snap-x -mx-4 px-4 md:mx-0 md:px-0 w-[calc(100%+2rem)] md:w-full">
        {/* ⭐ Saved Tab */}
        {isPremium ? (
          <button
            onClick={() => { setShowSaved(s => !s); setSelectedDepartment(null); setPage(1); }}
            className={clsx(
              "px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border snap-center shrink-0 flex items-center gap-1.5",
              showSaved
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-lg shadow-amber-500/30 scale-105"
                : "bg-theme-surface text-amber-400 border-amber-500/20 hover:border-amber-500/40"
            )}
          >
            <Star className={clsx('w-3 h-3', showSaved && 'fill-white')} />
            Saved
          </button>
        ) : (
          /* Free users see a locked Saved button */
          <div className="relative group">
            <button
              className="px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap border border-dashed border-theme-border text-theme-muted/40 flex items-center gap-1.5 cursor-not-allowed snap-center shrink-0"
            >
              <Star className="w-3 h-3" />
              Saved
              <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-black ml-1">PRO</span>
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-theme-surface border border-theme-border rounded-lg text-[10px] font-bold text-theme-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              Upgrade to save papers
            </div>
          </div>
        )}

        {/* All Subjects */}
        <button
          onClick={() => { setSelectedDepartment(null); setShowSaved(false); setPage(1); }}
          className={clsx(
            "px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border snap-center shrink-0",
            "bg-theme-surface-2 text-theme-primary border-theme-border shadow-sm hover:border-indigo-400/50"
          )}
        >
          All Subjects
        </button>
        {[
          { name: "IT", pillClass: "tab-pill-blue" },
          { name: "Accounting", pillClass: "tab-pill-emerald" },
          { name: "Marketing", pillClass: "tab-pill-fuchsia" },
          { name: "LLB (Law)", pillClass: "tab-pill-rose" },
          { name: "Actuarial Science", pillClass: "tab-pill-indigo" },
          { name: "Business Admin", pillClass: "tab-pill-violet" },
          { name: "Logistics", pillClass: "tab-pill-orange" },
          { name: "PR", pillClass: "tab-pill-red" }
        ].map(dept => (
          <button
            key={dept.name}
            onClick={() => { setSelectedDepartment(dept.name); setShowSaved(false); setPage(1); }}
            className={clsx(
              "px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all snap-center shrink-0 hover:opacity-80",
              dept.pillClass
            )}
          >
            <span className="relative z-10">{dept.name}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <>

          {/* Saved empty state */}
          {showSaved && filteredPapers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400 border border-amber-500/20">
                <Star size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-theme-primary mb-1">No Saved Papers Yet</h3>
                <p className="text-sm text-theme-muted max-w-xs mx-auto">Star any paper by clicking the ★ icon on the card to save it here for quick access.</p>
              </div>
            </div>
          )}

          {/* General empty state */}
          {!showSaved && displayedPapers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-6 glass-card border-dashed">
              <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 relative">
                <BookOpen size={32} className="relative z-10" />
                <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" />
              </div>
              <div className="space-y-2 px-4">
                <h3 className="text-2xl font-bold text-theme-primary">No Papers Found</h3>
                <p className="text-theme-muted max-w-md mx-auto">
                  We couldn't find any papers matching your current filters or search query. 
                  Try adjusting your filters or searching for something else.
                </p>
              </div>
              {(selectedYear || selectedSemester || searchQuery || selectedSubject || selectedDepartment) && (
                <button 
                  onClick={() => {
                    setSelectedYear('');
                    setSelectedSemester('');
                    setSearchQuery('');
                    setSelectedSubject(null);
                    setSelectedDepartment(null);
                    setPage(1);
                  }}
                  className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {displayedPapers.map((paper, index) => {
              const isAnswers = paper.has_answers;
              const gradients = [
                "from-indigo-500 via-purple-500 to-pink-500",
                "from-cyan-500 via-blue-500 to-indigo-500",
                "from-emerald-500 via-teal-500 to-cyan-500",
                "from-amber-500 via-orange-500 to-rose-500",
                "from-fuchsia-500 via-pink-500 to-rose-500"
              ];
              const gradient = gradients[index % gradients.length];
              const isStarred = bookmarkedIds.has(paper.id);

              return (
                <div key={paper.id} className="glass-card p-6 group flex flex-col hover:translate-y-[-6px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4),0_0_20px_rgba(99,102,241,0.2)] transition-all duration-500 border-theme-border/50 relative overflow-hidden bg-gradient-to-b from-theme-surface to-theme-surface-2">
                  {/* Premium background glow */}
                  <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${gradient} opacity-5 blur-3xl -mr-16 -mt-16 group-hover:opacity-15 transition-opacity duration-700`} />

                  <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} p-[1px] shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                        <div className="w-full h-full bg-theme-surface rounded-xl flex items-center justify-center">
                          <BookOpen className="w-6 h-6 text-transparent" style={{ stroke: 'url(#gradient-icon)' }} />
                          <svg width="0" height="0">
                            <linearGradient id="gradient-icon" x1="100%" y1="100%" x2="0%" y2="0%">
                              <stop stopColor="#818cf8" offset="0%" />
                              <stop stopColor="#c084fc" offset="50%" />
                              <stop stopColor="#f472b6" offset="100%" />
                            </linearGradient>
                          </svg>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-lg font-black text-theme-primary leading-none">{paper.year}</span>
                        <span className="text-[10px] text-theme-muted font-bold tracking-tighter uppercase">Academic Year</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAnswers && (
                        <div className="flex items-center gap-1 text-[9px] font-black text-white bg-gradient-to-r from-emerald-500 to-teal-500 px-2 py-1 rounded-md shadow-lg shadow-emerald-500/20 transform group-hover:scale-105 transition-transform uppercase tracking-tighter">
                          <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
                          ANSWERS
                        </div>
                      )}
                      {/* Bookmark Star */}
                      {isPremium ? (
                        <button
                          onClick={(e) => handleToggleBookmark(e, paper.id)}
                          disabled={bookmarkLoading === paper.id}
                          className={clsx(
                            'w-8 h-8 flex items-center justify-center rounded-lg border transition-all',
                            isStarred
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                              : 'bg-theme-surface border-theme-border text-theme-muted hover:text-amber-400 hover:border-amber-500/30 opacity-100 lg:opacity-0 lg:group-hover:opacity-100'
                          )}
                          title={isStarred ? 'Remove bookmark' : 'Save this paper'}
                        >
                          <Star className={clsx('w-4 h-4', isStarred && 'fill-amber-400')} strokeWidth={2.5} />
                        </button>
                      ) : (
                        <div className="w-8 h-8 flex items-center justify-center rounded-lg border border-dashed border-theme-border/40 text-theme-muted/30 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity cursor-not-allowed" title="Upgrade to save papers">
                          <Star className="w-4 h-4" strokeWidth={2.5} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="relative z-10 mb-6 flex-grow">
                    <h3 className="text-base md:text-lg font-bold text-theme-primary mb-3 leading-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-indigo-400 group-hover:to-purple-400 transition-all duration-300">
                      {paper.title || paper.upsa_subjects?.name}
                    </h3>
                    <div className="inline-flex items-center px-2 py-0.5 rounded bg-theme-surface border border-theme-border text-[9px] font-black tracking-widest text-indigo-400 uppercase">
                      {paper.upsa_subjects?.code || 'GEN 000'}
                    </div>
                  </div>

                  <div className="mt-auto pt-5 border-t border-theme-border/30 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-theme-surface border border-theme-border flex items-center justify-center">
                        <span className="text-[10px] font-black text-theme-secondary">{paper.semester === 'First' ? 'S1' : 'S2'}</span>
                      </div>
                      <span className="text-[10px] font-bold text-theme-muted uppercase tracking-tight">{paper.semester} Semester</span>
                    </div>
                    <div className="flex gap-2">
                      {paper.has_answers && paper.answer_url && (
                        <a
                          href={paper.answer_url}
                          target="_blank"
                          rel="noreferrer"
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:text-white hover:bg-emerald-500 transition-all shadow-sm hover:shadow-md"
                          title="View Answer Key"
                        >
                          <FileCheck className="w-5 h-5" />
                        </a>
                      )}
                      <Link
                        to={`/papers/${paper.id}`}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-theme-surface border border-theme-border text-theme-secondary hover:text-indigo-400 hover:border-indigo-500/30 transition-all shadow-sm hover:shadow-md"
                        title="View Paper"
                      >
                        <Eye className="w-5 h-5" />
                      </Link>
                      <button
                        onClick={() => handleDownload(paper.id, 'download')}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white transition-all shadow-lg hover:shadow-xl hover:scale-105`}
                        title="Download PDF"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-3 md:gap-6">
              <button
                disabled={page === 1}
                onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="px-4 md:px-6 py-2.5 rounded-xl bg-theme-surface border border-theme-border text-theme-primary font-bold hover:bg-theme-surface-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-xs md:text-sm shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <div className="flex items-center gap-2 px-3 md:px-5 py-2 bg-theme-surface/50 border border-theme-border rounded-xl shadow-inner">
                <span className="hidden sm:inline text-[9px] font-black text-theme-muted uppercase tracking-widest">Page</span>
                <span className="text-sm font-black text-indigo-400">{page}</span>
                <span className="text-[9px] font-black text-theme-muted uppercase tracking-widest">/</span>
                <span className="text-sm font-bold text-theme-primary">{totalPages}</span>
              </div>

              <button
                disabled={page === totalPages}
                onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="px-4 md:px-6 py-2.5 rounded-xl bg-theme-surface border border-theme-border text-theme-primary font-bold hover:bg-theme-surface-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-xs md:text-sm shadow-sm"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
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

export default PapersPage;