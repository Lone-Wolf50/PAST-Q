import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Search, Edit2, Trash2, Menu, FileText, CheckCircle2, CloudUpload, X, Download, Filter,
  ExternalLink, FileCheck, RotateCw, Sparkles, Loader2, BookOpen, Target, Lightbulb, ShieldAlert
} from 'lucide-react';
import { clsx } from 'clsx';
import { ThemeToggle } from '../components/ui/ThemeToggle';

import AdminSidebar from '../components/AdminSidebar';
import { apiFetch, apiFetchMultipart } from '../lib/api';

import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AlertModal } from '../components/ui/AlertModal';

const AdminPapersPage = () => {

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [papers, setPapers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [aiHealth, setAiHealth] = useState<any>({ status: 'online' });
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, string>>({});
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // UI States
  const [alert, setAlert] = useState<{ show: boolean, title: string, message: string, variant: 'success' | 'error' | 'info' }>({
    show: false, title: '', message: '', variant: 'info'
  });
  const [confirm, setConfirm] = useState<{ show: boolean, id: string | null }>({
    show: false, id: null
  });

  // Modal Form States
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [hasAnswers, setHasAnswers] = useState(false);
  const [answerMode, setAnswerMode] = useState<'file' | 'url'>('file');
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [externalUrl, setExternalUrl] = useState('');

  // Filters
  const [filterSubject, setFilterSubject] = useState('');
  const [filterYear, setFilterYear] = useState('');

  // Editing state
  const [editingPaper, setEditingPaper] = useState<any>(null);

  // Insight preview modal
  const [insightModal, setInsightModal] = useState<{ show: boolean; paper: any | null; insights: any | null; loading: boolean }>({
    show: false, paper: null, insights: null, loading: false
  });

  const handleViewInsights = async (paper: any) => {
    setInsightModal({ show: true, paper, insights: null, loading: true });
    try {
      const token = localStorage.getItem('admin_token');
      const res = await apiFetch(`/hq-management/papers/${paper.id}/insights`, { token: token! });
      setInsightModal(prev => ({ ...prev, insights: res.insights, loading: false }));
    } catch {
      setInsightModal(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchPapers = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      const res = await apiFetch('/hq-management/papers', { token });
      setPapers(res.papers || []);
      if (res.ai_health) setAiHealth(res.ai_health);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSubjects = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      const res = await apiFetch('/hq-management/subjects', { token });
      setSubjects(res.subjects || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPapers();
    fetchSubjects();
  }, []);

  // Polling: runs while any paper is actively crawling
  useEffect(() => {
    const hasActiveCrawl = papers.some(p => {
      const isR2 = p.file_url?.includes('.r2.dev') || p.file_url?.includes('.cloudflarestorage.com');
      return isR2 && !p.has_insights && p.ai_processing_started_at;
    });

    // Still poll if there are pending R2 papers without insights (server may be processing)
    const hasPending = papers.some(p => {
      const isR2 = p.file_url?.includes('.r2.dev') || p.file_url?.includes('.cloudflarestorage.com');
      return isR2 && !p.has_insights;
    });

    if ((!hasActiveCrawl && !hasPending) || aiHealth.status === 'limited') return;

    const interval = setInterval(() => {
      fetchPapers();
    }, hasActiveCrawl ? 8000 : 15000);

    return () => clearInterval(interval);
  }, [papers, aiHealth.status, fetchPapers]);

  // Elapsed-time ticker: updates every second for actively-processing papers
  useEffect(() => {
    if (elapsedRef.current) clearInterval(elapsedRef.current);

    const processingPapers = papers.filter(p => p.ai_processing_started_at);
    if (processingPapers.length === 0) {
      setElapsedTimes({});
      return;
    }

    const tick = () => {
      const now = Date.now();
      const updated: Record<string, string> = {};
      processingPapers.forEach(p => {
        const startedAt = new Date(p.ai_processing_started_at).getTime();
        const secs = Math.floor((now - startedAt) / 1000);
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        updated[p.id] = m > 0 ? `${m}m ${s}s` : `${s}s`;
      });
      setElapsedTimes(updated);
    };

    tick(); // immediate
    elapsedRef.current = setInterval(tick, 1000);
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [papers]);

  const resetModal = () => {
    setEditingPaper(null);
    setShowModal(false);
    setUploadSuccess(false);
    setUploadMode('file');
    setPdfFiles([]);
    setExternalUrl('');
    setHasAnswers(false);
    setAnswerMode('file');
  };

  const handleOpenEdit = (paper: any) => {
    setEditingPaper(paper);
    setUploadMode('url'); // When editing, we default to URL if they don't upload a new file
    setExternalUrl(paper.file_url);
    setHasAnswers(paper.has_answers);
    setAnswerMode(paper.answer_url ? 'url' : 'file');
    setShowModal(true);
  };

  const handleSavePaper = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    const fd = new FormData(e.currentTarget);
    setIsUploading(true);
    try {
      if (editingPaper) {
        const payload = new FormData();
        payload.append('title', fd.get('title') as string);
        payload.append('subject_id', fd.get('subject_id') as string);
        payload.append('year', fd.get('year') as string);
        payload.append('semester', fd.get('semester') as string);
        payload.append('has_answers', String(hasAnswers));

        if (uploadMode === 'file' && pdfFiles.length > 0) {
          payload.append('file', pdfFiles[0], pdfFiles[0].name);
        } else if (uploadMode === 'url') {
          payload.append('file_url', externalUrl.trim());
        }

        if (hasAnswers) {
          const answerFile = fd.get('answer_file') as File;
          const answerUrl = fd.get('answer_url') as string;
          if (answerMode === 'file' && answerFile && answerFile.size > 0) {
            payload.append('answer_file', answerFile, answerFile.name);
          } else if (answerMode === 'url' && answerUrl?.trim()) {
            payload.append('answer_url', answerUrl.trim());
          }
        }
        await apiFetchMultipart(`/hq-management/papers/${editingPaper.id}`, payload, { method: 'PATCH', token });
      } else {
        if (uploadMode === 'file' && pdfFiles.length > 0) {
          for (const file of pdfFiles) {
            const payload = new FormData();
            payload.append('title', fd.get('title') as string);
            payload.append('subject_id', fd.get('subject_id') as string);
            payload.append('year', fd.get('year') as string);
            payload.append('semester', fd.get('semester') as string);
            payload.append('has_answers', String(hasAnswers));
            payload.append('file', file, file.name);

            if (hasAnswers) {
              const answerFile = fd.get('answer_file') as File;
              const answerUrl = fd.get('answer_url') as string;
              if (answerMode === 'file' && answerFile && answerFile.size > 0) {
                payload.append('answer_file', answerFile, answerFile.name);
              } else if (answerMode === 'url' && answerUrl?.trim()) {
                payload.append('answer_url', answerUrl.trim());
              }
            }
            await apiFetchMultipart('/hq-management/papers', payload, { token });
          }
        } else if (uploadMode === 'url') {
          const payload = new FormData();
          payload.append('title', fd.get('title') as string);
          payload.append('subject_id', fd.get('subject_id') as string);
          payload.append('year', fd.get('year') as string);
          payload.append('semester', fd.get('semester') as string);
          payload.append('has_answers', String(hasAnswers));
          payload.append('file_url', externalUrl.trim());

          if (hasAnswers) {
            const answerFile = fd.get('answer_file') as File;
            const answerUrl = fd.get('answer_url') as string;
            if (answerMode === 'file' && answerFile && answerFile.size > 0) {
              payload.append('answer_file', answerFile, answerFile.name);
            } else if (answerMode === 'url' && answerUrl?.trim()) {
              payload.append('answer_url', answerUrl.trim());
            }
          }
          await apiFetchMultipart('/hq-management/papers', payload, { token });
        }
      }

      setUploadSuccess(true);
      setTimeout(() => {
        resetModal();
        fetchPapers();
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setAlert({
        show: true,
        title: 'Upload Failed',
        message: err.message || 'Failed to save paper. Please check your connection and try again.',
        variant: 'error'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setConfirm({ show: true, id });
  };

  const handleConfirmDelete = async () => {
    const id = confirm.id;
    if (!id) return;

    try {
      await apiFetch(`/hq-management/papers/${id}`, { method: 'DELETE', token: localStorage.getItem('admin_token')! });
      setConfirm({ show: false, id: null });
      fetchPapers();
    } catch (err: any) {
      console.error(err);
      setAlert({
        show: true,
        title: 'Delete Failed',
        message: err.message || 'Could not delete the paper.',
        variant: 'error'
      });
    }
  };

  const filteredPapers = papers.filter((p) => {
    const matchSearch = !searchTerm || p.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSubject = !filterSubject || p.upsa_subjects?.code === filterSubject;
    const matchYear = !filterYear || p.year === filterYear;
    return matchSearch && matchSubject && matchYear;
  });

  return (
    <div className="min-h-screen bg-transparent flex font-sans">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col lg:ml-64">
        <header className="sticky top-0 z-20 bg-transparent/80 backdrop-blur-xl border-b border-theme-border px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl bg-theme-surface text-theme-muted">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-theme-primary">Manage Papers</h1>
          </div>
          <div className="flex items-center gap-2">
            {aiHealth.status === 'limited' && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold animate-pulse mr-2">
                <Sparkles className="w-3 h-3" />
                AI RECHARGING
              </div>
            )}
            <div className="mr-1"><ThemeToggle /></div>
            <button
              onClick={() => { fetchPapers(); fetchSubjects(); }}
              className="p-2 rounded-xl bg-theme-surface hover:bg-theme-surface-2 text-theme-muted transition-colors group"
              title="Refresh Data"
            >
              <RotateCw className="w-5 h-5 group-active:rotate-180 transition-transform duration-500" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-theme-primary mb-2">Past Papers</h1>
              <p className="text-theme-muted">Manage the database of available past examination papers.</p>
            </div>

            <button
              onClick={() => { resetModal(); setShowModal(true); }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all font-semibold shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:scale-[1.02]"
            >
              <Plus className="w-5 h-5" />
              Upload New Paper
            </button>
          </div>

          {/* Search & Filters */}
          <div className="glass-card p-4 md:p-6 mb-8 border-theme-border flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <input
                type="text"
                placeholder="Search paper titles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-theme-primary focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-theme-muted" />
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="theme-select text-sm py-2 px-3"
              >
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s.id} value={s.code}>{s.name}</option>)}
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="theme-select text-sm py-2 px-3"
              >
                <option value="">All Years</option>
                {[2024, 2023, 2022, 2021, 2020].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="glass-card border-theme-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-theme-border text-[11px] text-theme-muted uppercase tracking-widest bg-theme-surface/30">
                    <th className="px-6 py-4 font-bold">Paper Title</th>
                    <th className="px-6 py-4 font-bold">Subject</th>
                    <th className="px-6 py-4 font-bold text-center">Year / Sem</th>
                    <th className="px-6 py-4 font-bold text-center">Source</th>
                    <th className="px-6 py-4 font-bold text-center">AI Insights</th>
                    <th className="px-6 py-4 font-bold text-center">Answers</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {loading ? (
                    <tr><td colSpan={7} className="py-20 text-center text-theme-muted">Loading papers...</td></tr>
                  ) : filteredPapers.length === 0 ? (
                    <tr><td colSpan={7} className="py-20 text-center text-theme-muted">No papers found matching filters.</td></tr>
                  ) : (
                    filteredPapers.map((paper) => {
                      const isR2 = paper.file_url?.includes('.r2.dev') || paper.file_url?.includes('.cloudflarestorage.com');
                      return (
                        <tr key={paper.id} className="hover:bg-theme-surface/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-indigo-500/10">
                                <FileText className="w-4 h-4 text-indigo-400" />
                              </div>
                              <span className="text-sm font-semibold text-theme-primary">{paper.title}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-theme-secondary">
                            {paper.upsa_subjects?.name || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-bold text-theme-primary">{paper.year}</span>
                              <span className="text-[10px] text-theme-muted uppercase">{paper.semester}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isR2 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                R2 STORAGE
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold">
                                EXTERNAL
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {paper.has_insights ? (
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => handleViewInsights(paper)}
                                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black tracking-tighter hover:bg-indigo-500/20 transition-colors"
                                  title="View AI Insights"
                                >
                                  <Sparkles className="w-2.5 h-2.5" />
                                  READY · VIEW
                                </button>
                              </div>
                            ) : isR2 ? (
                              <div className="flex flex-col items-center gap-1">
                                {aiHealth.status === 'limited' ? (
                                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold border bg-amber-500/10 border-amber-500/20 text-amber-500/70">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    PAUSED
                                  </div>
                                ) : paper.ai_processing_started_at ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black tracking-tighter">
                                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                      ANALYZING
                                    </div>
                                    <span className="text-[8px] font-bold text-theme-muted">{elapsedTimes[paper.id] || '...'}</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-1.5">
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-theme-surface border border-theme-border text-theme-muted text-[9px] font-black tracking-tighter">
                                      WAITING ON STUDENTS
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-theme-muted">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {paper.has_answers ? (
                              <div className="flex justify-center">
                                <FileCheck className="w-5 h-5 text-emerald-400" />
                              </div>
                            ) : (
                              <span className="text-xs text-theme-muted">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <a
                                href={paper.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 rounded-lg bg-theme-surface hover:bg-theme-surface-2 text-theme-muted hover:text-indigo-400 transition-colors"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => handleOpenEdit(paper)}
                                className="p-2 rounded-lg bg-theme-surface hover:bg-theme-surface-2 text-theme-muted hover:text-amber-400 transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(paper.id)}
                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* ── Add / Edit Paper Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card w-full max-w-xl p-6 border-theme-border relative my-8">
            <button onClick={resetModal} className="absolute top-4 right-4 p-2 text-theme-muted hover:text-theme-primary transition-colors">
              <X className="w-6 h-6" />
            </button>

            {uploadSuccess ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-theme-primary">Paper Saved!</h2>
                <p className="text-theme-muted text-center max-w-sm">The database has been updated and files are synced.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-2xl bg-indigo-500/10">
                    <CloudUpload className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-theme-primary">{editingPaper ? 'Edit Paper' : 'Upload Paper'}</h2>
                    <p className="text-xs text-theme-muted">Configure paper metadata and file hosting.</p>
                  </div>
                </div>

                <form className="flex flex-col gap-4" onSubmit={handleSavePaper}>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-theme-muted ml-1">Title</label>
                    <input
                      name="title"
                      required
                      defaultValue={editingPaper?.title || ''}
                      className="bg-theme-surface border border-theme-border rounded-xl px-4 py-3 text-theme-primary focus:border-indigo-500/50 outline-none transition-colors"
                      placeholder="e.g. 2023 Principles of Management"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-theme-muted ml-1">Subject</label>
                      <select
                        name="subject_id"
                        required
                        defaultValue={editingPaper?.subject_id || ''}
                        className="theme-select"
                      >
                        <option value="">Select Subject</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-theme-muted ml-1">Year</label>
                      <input
                        name="year"
                        required
                        maxLength={4}
                        defaultValue={editingPaper?.year || ''}
                        className="bg-theme-surface border border-theme-border rounded-xl px-4 py-3 text-theme-primary focus:border-indigo-500/50 outline-none"
                        placeholder="2024"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-theme-muted ml-1">Semester</label>
                    <select
                      name="semester"
                      required
                      defaultValue={editingPaper?.semester || 'First'}
                      className="theme-select"
                    >
                      <option value="First">First Semester</option>
                      <option value="Second">Second Semester</option>
                    </select>
                  </div>

                  <div className="border-t border-theme-border pt-4 mt-1">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-bold text-theme-primary">PDF Source</label>
                      <div className="flex bg-theme-surface p-1 rounded-lg border border-theme-border">
                        <button
                          type="button"
                          onClick={() => setUploadMode('file')}
                          className={clsx("px-3 py-1 rounded text-xs font-bold transition-all", uploadMode === 'file' ? "bg-indigo-500 text-white" : "text-theme-muted")}
                        >
                          FILE UPLOAD
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadMode('url')}
                          className={clsx("px-3 py-1 rounded text-xs font-bold transition-all", uploadMode === 'url' ? "bg-indigo-500 text-white" : "text-theme-muted")}
                        >
                          DIRECT URL
                        </button>
                      </div>
                    </div>

                    {uploadMode === 'file' ? (
                      <div className="relative group">
                        <input
                          type="file"
                          accept=".pdf"
                          multiple={!editingPaper}
                          onChange={(e) => setPdfFiles(Array.from(e.target.files || []))}
                          className="hidden"
                          id="pdf-upload"
                        />
                        <label
                          htmlFor="pdf-upload"
                          className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-theme-border rounded-2xl group-hover:border-indigo-500/40 transition-colors cursor-pointer"
                        >
                          <CloudUpload className="w-8 h-8 text-theme-muted group-hover:text-indigo-400 mb-2 transition-colors" />
                          <span className="text-sm font-semibold text-theme-secondary">{pdfFiles.length > 0 ? `${pdfFiles.length} file(s) selected` : 'Choose PDF file(s)'}</span>
                          <span className="text-[10px] text-theme-muted mt-1 uppercase font-bold tracking-widest">Max 50MB per file</span>
                        </label>
                      </div>
                    ) : (
                      <div className="relative">
                        <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                        <input
                          type="url"
                          value={externalUrl}
                          onChange={(e) => setExternalUrl(e.target.value)}
                          placeholder="https://example.com/paper.pdf"
                          className="w-full bg-theme-surface border border-theme-border rounded-xl py-3 pl-10 pr-4 text-theme-primary outline-none focus:border-indigo-500/50"
                        />
                      </div>
                    )}
                  </div>

                  {/* Answer Key Toggle */}
                  <div className="flex items-center justify-between py-3 border-y border-theme-border my-1">
                    <div className="flex items-center gap-3">
                      <div className={clsx("p-2 rounded-lg", hasAnswers ? "bg-emerald-500/10" : "bg-theme-surface")}>
                        <FileCheck className={clsx("w-5 h-5", hasAnswers ? "text-emerald-400" : "text-theme-muted")} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-theme-primary">Answer Key</h4>
                        <p className="text-[10px] text-theme-muted">Include a solved solution for this paper.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={hasAnswers} onChange={(e) => setHasAnswers(e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-theme-surface rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Answer File Upload (Conditional) */}
                  {hasAnswers && (
                    <div className="border border-theme-border rounded-xl p-4 bg-emerald-500/5">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-bold text-theme-primary">Answer File Source</label>
                        <div className="flex bg-theme-surface p-1 rounded-lg border border-theme-border">
                          <button
                            type="button"
                            onClick={() => setAnswerMode('file')}
                            className={clsx("px-3 py-1 rounded text-xs font-bold transition-all", answerMode === 'file' ? "bg-emerald-500 text-white" : "text-theme-muted")}
                          >
                            FILE UPLOAD
                          </button>
                          <button
                            type="button"
                            onClick={() => setAnswerMode('url')}
                            className={clsx("px-3 py-1 rounded text-xs font-bold transition-all", answerMode === 'url' ? "bg-emerald-500 text-white" : "text-theme-muted")}
                          >
                            DIRECT URL
                          </button>
                        </div>
                      </div>

                      {answerMode === 'file' ? (
                        <div className="relative group">
                          <input
                            type="file"
                            name="answer_file"
                            accept=".pdf"
                            className="hidden"
                            id="answer-pdf-upload"
                          />
                          <label
                            htmlFor="answer-pdf-upload"
                            className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-emerald-500/30 rounded-2xl hover:border-emerald-500/60 transition-colors cursor-pointer bg-theme-surface"
                          >
                            <CloudUpload className="w-6 h-6 text-emerald-400 mb-2" />
                            <span className="text-sm font-semibold text-theme-secondary">Choose Answer PDF</span>
                          </label>
                        </div>
                      ) : (
                        <div className="relative">
                          <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                          <input
                            type="url"
                            name="answer_url"
                            placeholder="https://example.com/answer.pdf"
                            className="w-full bg-theme-surface border border-emerald-500/30 rounded-xl py-3 pl-10 pr-4 text-theme-primary outline-none focus:border-emerald-500/60"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={resetModal}
                      className="px-6 py-3 rounded-xl text-theme-secondary font-bold hover:bg-theme-surface transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isUploading}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                          Saving...
                        </>
                      ) : (
                        <>{editingPaper ? 'Update Paper' : 'Upload Paper'}</>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Custom UI Modals ── */}
      <ConfirmModal
        isOpen={confirm.show}
        onClose={() => setConfirm({ show: false, id: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Paper"
        message="Are you sure you want to permanently delete this paper and its associated files from R2? This action cannot be undone."
        confirmText="Delete Paper"
        variant="danger"
      />

      <AlertModal
        isOpen={alert.show}
        onClose={() => setAlert({ ...alert, show: false })}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
      />

      {/* ── AI Insight Preview Modal ── */}
      {insightModal.show && insightModal.paper && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card w-full max-w-2xl p-6 border-theme-border relative my-8 flex flex-col gap-6">
            <button
              onClick={() => setInsightModal({ show: false, paper: null, insights: null, loading: false })}
              className="absolute top-4 right-4 p-2 text-theme-muted hover:text-theme-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-indigo-500/10">
                <Sparkles className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-theme-primary">AI Insights</h2>
                <p className="text-xs text-theme-muted">{insightModal.paper.title}</p>
              </div>
            </div>

            {insightModal.loading ? (
              <div className="py-12 flex flex-col items-center gap-3 text-theme-muted">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <p className="text-sm font-medium">Loading insights…</p>
              </div>
            ) : !insightModal.insights ? (
              <div className="py-10 text-center text-theme-muted text-sm">No insight data found for this paper.</div>
            ) : (() => {
              const ins = insightModal.insights;
              return (
                <div className="flex flex-col gap-6 max-h-[60vh] overflow-y-auto pr-1 scrollbar-hide">

                  {/* Summary */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                      <BookOpen className="w-3 h-3" /><span>Executive Summary</span>
                    </div>
                    <p className="text-sm leading-relaxed text-theme-secondary font-medium">{ins.summary}</p>
                  </div>

                  {/* Topics */}
                  {ins.topics?.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                        <Target className="w-3 h-3" /><span>Key Focus Areas</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ins.topics.map((t: string) => (
                          <span key={t} className="px-3 py-1.5 bg-theme-surface-2 border border-theme-border rounded-xl text-[10px] font-bold text-theme-primary">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Difficulty */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-theme-muted uppercase">Difficulty Rating</span>
                    <span className={clsx(
                      "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter",
                      ins.difficulty === 'Advanced' ? "bg-red-500/20 text-red-400" :
                        ins.difficulty === 'Intermediate' ? "bg-amber-500/20 text-amber-400" :
                          "bg-emerald-500/20 text-emerald-400"
                    )}>{ins.difficulty}</span>
                  </div>

                  {/* Hardest Question */}
                  {ins.hardest_question && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                        <ShieldAlert className="w-3 h-3" /><span>Hardest Question &amp; Solution</span>
                      </div>
                      <div className="p-4 bg-theme-surface-2 border border-theme-border rounded-2xl text-xs font-medium leading-relaxed text-theme-secondary whitespace-pre-wrap">
                        {ins.hardest_question}
                      </div>
                    </div>
                  )}

                  {/* Exam Tips */}
                  {ins.exam_tips && (
                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                        <Lightbulb className="w-3 h-3" /><span>Exam Tips</span>
                      </div>
                      <p className="text-xs leading-relaxed text-theme-secondary font-medium whitespace-pre-wrap italic">{ins.exam_tips}</p>
                    </div>
                  )}

                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPapersPage;