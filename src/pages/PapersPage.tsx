import { useState } from 'react';
import { Search, Filter, BookOpen, Download, Eye, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';

// Mock data based on the master document schema
const MOCK_SUBJECTS = ['Maths', 'Biology', 'Economics', 'Literature', 'Chemistry', 'Law'];
const MOCK_PAPERS = Array.from({ length: 12 }).map((_, i) => ({
  id: `paper-${i}`,
  subject: MOCK_SUBJECTS[i % MOCK_SUBJECTS.length],
  year: `${2020 + (i % 4)}-${2021 + (i % 4)}`,
  semester: i % 2 === 0 ? '1st' : '2nd',
  hasAnswerKey: i % 3 === 0,
}));

const PapersPage = () => {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const filteredPapers = selectedSubject 
    ? MOCK_PAPERS.filter(p => p.subject === selectedSubject)
    : MOCK_PAPERS;

  return (
    <div className="w-full flex-grow flex flex-col px-4 md:px-8 max-w-7xl mx-auto py-8 mb-24 md:mb-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-theme-primary mb-2">Browse Papers</h1>
          <p className="text-theme-muted">Find and download past questions to boost your preparation.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-grow md:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
            <input 
              type="text" 
              placeholder="Search by subject code..." 
              className="w-full md:w-64 bg-theme-surface border border-theme-border rounded-full py-2 pl-9 pr-4 text-sm text-theme-primary placeholder-gray-500 focus:outline-none focus:border-indigo-400/50 transition-colors"
            />
          </div>
          <button className="flex items-center gap-2 bg-theme-surface border border-theme-border hover:bg-theme-surface-2 px-4 py-2 rounded-full text-sm font-medium text-theme-secondary transition-colors shrink-0">
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filter</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide">
        <button 
          onClick={() => setSelectedSubject(null)}
          className={clsx(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
            selectedSubject === null 
              ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" 
              : "bg-theme-surface text-theme-muted border-theme-border hover:bg-theme-surface-2 hover:text-white"
          )}
        >
          All Subjects
        </button>
        {MOCK_SUBJECTS.map(subject => (
          <button 
            key={subject}
            onClick={() => setSelectedSubject(subject)}
            className={clsx(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
              selectedSubject === subject 
                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" 
                : "bg-theme-surface text-theme-muted border-theme-border hover:bg-theme-surface-2 hover:text-white"
            )}
          >
            {subject}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredPapers.map(paper => (
          <div key={paper.id} className="glass-card p-5 group flex flex-col hover:border-indigo-500/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 rounded-lg bg-theme-surface border border-theme-border text-theme-secondary">
                <BookOpen className="w-5 h-5" />
              </div>
              {paper.hasAnswerKey && (
                <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/20">
                  Includes Answers
                </span>
              )}
            </div>
            
            <h3 className="text-lg font-semibold text-theme-primary mb-1">{paper.subject}</h3>
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-xs text-theme-muted bg-black/20 px-2 py-1 rounded border border-theme-border">
                {paper.year}
              </span>
              <span className="text-xs text-theme-muted bg-black/20 px-2 py-1 rounded border border-theme-border">
                {paper.semester} Semester
              </span>
            </div>

            <div className="mt-auto pt-4 border-t border-theme-border flex gap-2">
              <Link 
                to={`/papers/${paper.id}`}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-theme-surface hover:bg-theme-surface-2 text-sm font-medium text-theme-primary transition-colors"
              >
                <Eye className="w-4 h-4" />
                View
              </Link>
              <button 
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                title="Download PDF"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PapersPage;
