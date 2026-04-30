import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Sparkles, AlertCircle } from 'lucide-react';

const PaperViewerPage = () => {
  const { id } = useParams();

  // Mock data for the paper
  const paper = {
    id,
    subject: 'Business Communication I',
    code: 'BUS 101',
    year: '2022-2023',
    semester: '1st',
    viewUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    hasAnswerKey: true,
  };

  return (
    <div className="w-full flex-grow flex flex-col px-4 md:px-8 max-w-7xl mx-auto py-8 mb-24 md:mb-0 h-[calc(100vh-100px)]">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link 
            to="/papers" 
            className="flex items-center justify-center w-10 h-10 rounded-full bg-theme-surface border border-theme-border hover:bg-theme-surface-2 text-theme-muted hover:text-theme-primary transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-theme-primary">{paper.subject}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-theme-muted">{paper.code}</span>
              <span className="w-1 h-1 rounded-full bg-theme-surface-2" />
              <span className="text-xs text-theme-muted">{paper.year}</span>
              <span className="w-1 h-1 rounded-full bg-theme-surface-2" />
              <span className="text-xs text-theme-muted">{paper.semester} Semester</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-theme-primary bg-theme-surface-2 hover:bg-theme-surface-2 border border-theme-border transition-colors">
            <Download className="w-4 h-4" />
            Download
          </button>
          
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]">
            <Sparkles className="w-4 h-4" />
            <span className="whitespace-nowrap">Ask AI</span>
          </button>
        </div>
      </div>

      {paper.hasAnswerKey && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-6 flex items-start md:items-center gap-3">
          <AlertCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 md:mt-0" />
          <p className="text-sm text-emerald-100">
            This paper includes an official answer key. The answers are attached at the end of the document.
          </p>
        </div>
      )}

      <div className="flex-grow w-full glass-card overflow-hidden flex flex-col">
        <div className="bg-black/40 border-b border-theme-border p-3 flex justify-center">
          <p className="text-xs text-theme-muted">Document Viewer</p>
        </div>
        <iframe 
          src={paper.viewUrl} 
          title={`Document viewer for ${paper.subject}`}
          className="w-full flex-grow bg-white"
        />
      </div>
    </div>
  );
};

export default PaperViewerPage;
