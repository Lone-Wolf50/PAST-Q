import { useState, useEffect } from 'react';
import { Search, BookOpen, Download, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import { useLocation, Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Paper {
  id: string;
  title: string;
  year: string;
  semester: string;
  has_answers?: boolean;
  upsa_subjects?: { name: string; code: string };
}

const PapersPage = () => {
  const { token } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 12;
  
  const [papers, setPapers] = useState<Paper[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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
        const papersData = await apiFetch('/papers?limit=100', { token: token! });

        if (papersData.papers) {
          setPapers(papersData.papers);
          const uniqueYears = Array.from(new Set(papersData.papers.map((p: any) => p.year))).sort().reverse();
          setYears(uniqueYears as string[]);
        }
      } catch (err) {
        console.error('Failed to fetch data', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (token) {
      fetchData();
    }
  }, [token]);

  const filteredPapers = papers.filter(p => {
    if (selectedSubject && p.upsa_subjects?.name?.toLowerCase() !== selectedSubject.toLowerCase()) return false;
    if (selectedDepartment && selectedDepartment !== 'All Subjects') {
      // For now, departments are universal, but you can add specific filtering logic here if needed
    }
    if (selectedYear && p.year !== selectedYear) return false;
    if (selectedSemester && p.semester !== selectedSemester) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const title = p.title?.toLowerCase() || '';
      const subjName = p.upsa_subjects?.name?.toLowerCase() || '';
      const subjCode = p.upsa_subjects?.code?.toLowerCase() || '';
      if (!title.includes(q) && !subjName.includes(q) && !subjCode.includes(q)) {
        return false;
      }
    }
    return true;
  });
  
  const displayedPapers = filteredPapers.slice(0, page * itemsPerPage);

  const handleDownload = async (paperId: string, action: 'view' | 'download') => {
    try {
      const res = await apiFetch(`/papers/${paperId}/download`, {
        method: 'POST',
        token: token!
      });
      
      if (res.error) {
        alert(res.message || 'Unable to download. Please try again later.');
        return;
      }
      
      if (res.file_url) {
        if (action === 'view') {
          // Clean the URL if needed, or just open
          window.open(res.file_url.split('?')[0], '_blank');
        } else {
          // Create a temporary link to trigger download
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
        alert(body.message);
      } else {
        alert('An error occurred while requesting the document.');
      }
    }
  };

  return (
    <div className="w-full flex-grow flex flex-col px-4 md:px-8 max-w-7xl mx-auto py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-theme-primary mb-2">Browse Papers</h1>
          <p className="text-theme-muted">Find and download past questions to boost your preparation.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search papers..." 
              className="w-full bg-theme-surface border border-theme-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-theme-primary placeholder-gray-500 focus:outline-none focus:border-indigo-400/50 transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }}
              className="theme-select text-[11px] font-bold uppercase tracking-tight py-2.5 px-3 flex-1 sm:flex-none min-w-[90px]"
            >
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            
            <select
              value={selectedSemester}
              onChange={(e) => { setSelectedSemester(e.target.value); setPage(1); }}
              className="theme-select text-[11px] font-bold uppercase tracking-tight py-2.5 px-3 flex-1 sm:flex-none min-w-[110px]"
            >
              <option value="">Semesters</option>
              <option value="First">First</option>
              <option value="Second">Second</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-6 mb-8 scrollbar-hide snap-x -mx-4 px-4 md:mx-0 md:px-0 w-[calc(100%+2rem)] md:w-full">
        <button 
          onClick={() => { setSelectedDepartment(null); setPage(1); }}
          className={clsx(
            "px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border snap-center shrink-0",
            selectedDepartment === null 
              ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-transparent shadow-lg shadow-indigo-500/30 scale-105" 
              : "bg-theme-surface text-theme-muted border-theme-border hover:text-indigo-400"
          )}
        >
          All Subjects
        </button>
        {[
          { name: "IT", color: "text-blue-400", bg: "bg-blue-500/5", border: "border-blue-500/20", gradient: "from-cyan-500 to-blue-500", shadow: "shadow-blue-500/30" },
          { name: "Accounting", color: "text-emerald-400", bg: "bg-emerald-500/5", border: "border-emerald-500/20", gradient: "from-emerald-500 to-teal-500", shadow: "shadow-emerald-500/30" },
          { name: "Marketing", color: "text-fuchsia-400", bg: "bg-fuchsia-500/5", border: "border-fuchsia-500/20", gradient: "from-fuchsia-500 to-pink-500", shadow: "shadow-pink-500/30" },
          { name: "Business Admin", color: "text-violet-400", bg: "bg-violet-500/5", border: "border-violet-500/20", gradient: "from-violet-500 to-purple-500", shadow: "shadow-purple-500/30" },
          { name: "Logistics", color: "text-amber-400", bg: "bg-amber-500/5", border: "border-amber-500/20", gradient: "from-amber-500 to-orange-500", shadow: "shadow-orange-500/30" },
          { name: "PR", color: "text-rose-400", bg: "bg-rose-500/5", border: "border-rose-500/20", gradient: "from-rose-500 to-red-500", shadow: "shadow-red-500/30" }
        ].map(dept => (
          <button 
            key={dept.name}
            onClick={() => { setSelectedDepartment(dept.name); setPage(1); }}
            className={clsx(
              "px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border snap-center shrink-0 relative overflow-hidden group",
              selectedDepartment === dept.name 
                ? `bg-gradient-to-r ${dept.gradient} text-white border-transparent shadow-lg ${dept.shadow} scale-105` 
                : `${dept.bg} ${dept.color} ${dept.border} hover:border-transparent`
            )}
          >
            {selectedDepartment !== dept.name && (
              <div className={`absolute inset-0 bg-gradient-to-r ${dept.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
            )}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {displayedPapers.map((paper, index) => {
          const isAnswers = paper.has_answers;
          // Assign a pseudo-random gradient based on index so it looks colorful and premium
          const gradients = [
            "from-indigo-500 via-purple-500 to-pink-500",
            "from-cyan-500 via-blue-500 to-indigo-500",
            "from-emerald-500 via-teal-500 to-cyan-500",
            "from-amber-500 via-orange-500 to-rose-500",
            "from-fuchsia-500 via-pink-500 to-rose-500"
          ];
          const gradient = gradients[index % gradients.length];
          
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
              {isAnswers && (
                <div className="flex items-center gap-1 text-[9px] font-black text-white bg-gradient-to-r from-emerald-500 to-teal-500 px-2 py-1 rounded-md shadow-lg shadow-emerald-500/20 transform group-hover:scale-105 transition-transform uppercase tracking-tighter">
                  <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
                  ANSWERS
                </div>
              )}
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
      
      {filteredPapers.length > page * itemsPerPage && (
        <div className="mt-10 flex justify-center">
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-6 py-2.5 rounded-xl bg-theme-surface border border-theme-border text-theme-primary font-medium hover:bg-theme-surface-2 transition-colors"
          >
            Load More
          </button>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default PapersPage;

