import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, CloudUpload, Plus, Trash2, AlertTriangle, CheckCircle2,
  Loader2, ChevronDown, BookOpen, ShieldAlert, Eye, Edit2
} from 'lucide-react';
import { clsx } from 'clsx';
import { apiFetch, apiFetchMultipart } from '../lib/api';
import { saveBulkUploadDraft, getBulkUploadDraft, clearBulkUploadDraft, type BulkRow } from '../lib/bulkUploadDb';
import { ConfirmModal } from './ui/ConfirmModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Paper {
  id: string;
  title: string;
  subject_id: string;
  year: string;
  semester: string;
}


interface Props {
  subjects: Subject[];
  papers: Paper[];
  onClose: () => void;
  fetchPapers: () => void;
  fetchSubjects: () => void;
  onEditPaper?: (paper: any) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────


const MAX_FILES = 20;
const MAX_BYTES = 4.5 * 1024 * 1024;

function stripPdf(name: string) {
  return name.replace(/\.pdf$/i, '').trim();
}

function uid() {
  return Math.random().toString(36).slice(2);
}

// Fires immediately when a file is added — title match only
function isTitleMatch(row: BulkRow, papers: Paper[]) {
  if (!row.title.trim()) return false;
  return papers.some(
    (p) => p.title.toLowerCase().trim() === row.title.toLowerCase().trim()
  );
}

// Fires once all fields are filled — exact 4-field match against DB
function isExactDuplicate(row: BulkRow, papers: Paper[]) {
  if (!row.subjectId || !row.year || !row.semester || !row.title.trim()) return false;
  return papers.some(
    (p) =>
      p.title.toLowerCase().trim() === row.title.toLowerCase().trim() &&
      p.subject_id === row.subjectId &&
      String(p.year) === String(row.year) &&
      p.semester === row.semester
  );
}

// Fires immediately — checks for duplicate title within the current batch
function isBatchDuplicate(row: BulkRow, allRows: BulkRow[]) {
  if (!row.title.trim()) return false;
  return allRows.some(
    (r) => r.id !== row.id && r.title.toLowerCase().trim() === row.title.toLowerCase().trim()
  );
}

// ─── Inline "Create Subject" mini-popup ───────────────────────────────────────

interface CreateSubjectPopupProps {
  onCreated: (subject: Subject) => void;
  onClose: () => void;
}

const CreateSubjectPopup = ({ onCreated, onClose }: CreateSubjectPopupProps) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleCreate = async () => {
    if (!name.trim() || !code.trim()) { setErr('Name and code are required.'); return; }
    setSaving(true);
    setErr('');
    try {
      const token = localStorage.getItem('admin_token')!;
      const res = await apiFetch('/hq-management/subjects', {
        method: 'POST',
        body: { name: name.trim(), code: code.trim().toUpperCase() },
        token,
      });
      onCreated(res.subject);
    } catch (e: any) {
      setErr(e.message || 'Failed to create subject.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-sm border-theme-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-500/10">
                <BookOpen className="w-4 h-4 text-indigo-400" />
              </div>
              <h3 className="text-sm font-bold text-theme-primary">Create New Subject</h3>
            </div>
            <button onClick={onClose} className="p-1.5 text-theme-muted hover:text-theme-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-theme-muted">Subject Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={(e) => setName(e.target.value.toUpperCase())}
                placeholder="e.g. Principles of Management"
                className="bg-theme-surface border border-theme-border rounded-xl px-4 py-2.5 text-sm text-theme-primary focus:border-indigo-500/50 outline-none transition-colors uppercase"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-theme-muted">Course Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onBlur={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. MGMT101"
                className="bg-theme-surface border border-theme-border rounded-xl px-4 py-2.5 text-sm text-theme-primary focus:border-indigo-500/50 outline-none transition-colors uppercase"
              />
            </div>
            {err && <p className="text-xs text-red-400 font-medium">{err}</p>}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-theme-muted hover:bg-theme-surface font-semibold text-sm transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Subject select cell with "+ Create" option ───────────────────────────────

interface SubjectCellProps {
  value: string;
  subjects: Subject[];
  onChange: (id: string) => void;
  onNewSubject: () => void;
}

const SubjectCell = ({ value, subjects, onChange, onNewSubject }: SubjectCellProps) => {
  return (
    <div className="flex items-center gap-1 min-w-[180px]">
      <div className="relative flex-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-theme-surface border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-primary pr-7 focus:border-indigo-500/50 outline-none transition-colors"
        >
          <option value="">Select Subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-theme-muted pointer-events-none" />
      </div>
      <button
        type="button"
        onClick={onNewSubject}
        className="shrink-0 p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all"
        title="Create new subject"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const BulkUploadModal = ({ subjects: initialSubjects, papers, onClose, fetchPapers, fetchSubjects, onEditPaper }: Props) => {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>(
    [...initialSubjects].sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim()))
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [createSubjectForRow, setCreateSubjectForRow] = useState<string | null>(null); // row id
  const [doneCount, setDoneCount] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<{ show: boolean, row: BulkRow | null, duplicateInSystem: any | null }>({ show: false, row: null, duplicateInSystem: null });
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<BulkRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoadedRef = useRef(false);

  const handleClose = async () => {
    const hasUnuploaded = rows.some(r => r.status === 'idle' || r.status === 'error');
    if (hasUnuploaded && !allDone) {
      setShowCloseConfirm(true);
    } else {
      try {
        await clearBulkUploadDraft();
      } catch (err) {
        console.error('Failed to clear bulk upload draft', err);
      }
      onClose();
    }
  };

  useEffect(() => {
    setSubjects([...initialSubjects].sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim())));
  }, [initialSubjects]);

  // Load draft rows from IndexedDB on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draftRows = await getBulkUploadDraft();
        if (draftRows && draftRows.length > 0) {
          setRows(draftRows);
        }
      } catch (err) {
        console.error('Failed to load bulk upload draft', err);
      } finally {
        isLoadedRef.current = true;
      }
    };
    loadDraft();
  }, []);

  // Save rows to IndexedDB whenever rows change
  useEffect(() => {
    if (!isLoadedRef.current) return;

    const saveDraft = async () => {
      try {
        if (rows.length > 0) {
          await saveBulkUploadDraft(rows);
        } else {
          await clearBulkUploadDraft();
        }
      } catch (err) {
        console.error('Failed to save bulk upload draft', err);
      }
    };
    saveDraft();
  }, [rows]);

  // ── File addition ──────────────────────────────────────────────────────────

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type === 'application/pdf');
    if (arr.length === 0) return;

    setRows((prev) => {
      const remaining = MAX_FILES - prev.length;
      const toAdd = arr.slice(0, remaining).map((f): BulkRow => ({
        id: uid(),
        file: f,
        title: stripPdf(f.name).toUpperCase(),
        subjectId: '',
        year: String(new Date().getFullYear()),
        semester: 'First',
        status: 'idle',
      }));
      return [...prev, ...toAdd];
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ── Row updates ────────────────────────────────────────────────────────────

  const updateRow = (id: string, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r) => {
      if (r.id === id) {
        const next = { ...r, ...patch };
        if (r.status === 'error' && (patch.title !== undefined || patch.subjectId !== undefined || patch.year !== undefined || patch.semester !== undefined)) {
          next.status = 'idle';
          next.errorMsg = undefined;
        }
        return next;
      }
      return r;
    }));
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // ── Inline subject creation ────────────────────────────────────────────────

  const handleSubjectCreated = (newSubject: Subject) => {
    setSubjects((prev) => [...prev, newSubject].sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim())));
    fetchSubjects();
    if (createSubjectForRow) {
      updateRow(createSubjectForRow, { subjectId: newSubject.id });
    }
    setCreateSubjectForRow(null);
  };

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleUploadAll = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    // Validate
    const validRows = rows.filter((r) => r.title.trim() && r.subjectId && r.year && r.semester && r.status === 'idle');
    if (validRows.length === 0) return;

    // Pre-pass: check for unapproved system duplicates
    const unapprovedDuplicateRow = validRows.find(row => !row.forceUpload && isExactDuplicate(row, papers));
    if (unapprovedDuplicateRow) {
      const exactDup = papers.find(
        (p) =>
          p.title.toLowerCase().trim() === unapprovedDuplicateRow.title.toLowerCase().trim() &&
          p.subject_id === unapprovedDuplicateRow.subjectId &&
          String(p.year) === String(unapprovedDuplicateRow.year) &&
          p.semester === unapprovedDuplicateRow.semester
      );
      if (exactDup) {
        setDuplicatePrompt({ show: true, row: unapprovedDuplicateRow, duplicateInSystem: exactDup });
        return; // Pause the upload entirely
      }
    }

    setIsUploading(true);
    let done = 0;

    for (const row of validRows) {
      updateRow(row.id, { status: 'uploading' });

      // Size check
      if (row.file.size > MAX_BYTES) {
        updateRow(row.id, { status: 'error', errorMsg: 'File exceeds 4.5 MB limit.' });
        continue;
      }

      if (!row.forceUpload && isBatchDuplicate(row, rows)) {
        updateRow(row.id, { status: 'error', errorMsg: 'Duplicate found in this batch.' });
        continue;
      }

      try {
        const payload = new FormData();
        payload.append('title', row.title.trim().toUpperCase());
        payload.append('subject_id', row.subjectId);
        payload.append('year', row.year);
        payload.append('semester', row.semester);
        payload.append('has_answers', 'false');
        payload.append('file', row.file, row.file.name);

        await apiFetchMultipart('/hq-management/papers', payload, { token });
        updateRow(row.id, { status: 'done' });
        done++;
        setDoneCount(done);
      } catch (err: any) {
        updateRow(row.id, { status: 'error', errorMsg: err.message || 'Upload failed.' });
      }
    }

    setIsUploading(false);
    fetchPapers();

    if (done > 0) setAllDone(true);
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const readyCount = rows.filter(
    (r) => r.title.trim() && r.subjectId && r.year && r.semester && r.status === 'idle'
  ).length;

  const totalSize = rows.reduce((s, r) => s + r.file.size, 0);
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-start justify-center p-4 overflow-y-auto">
        <div className="glass-card w-full max-w-5xl border-theme-border relative flex flex-col my-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-theme-border">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <CloudUpload className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-theme-primary">Bulk Upload</h2>
                <p className="text-xs text-theme-muted">Upload up to {MAX_FILES} papers at once</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {rows.length > 0 && !allDone && (
                <button
                  onClick={() => setShowClearAllConfirm(true)}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-xs font-bold disabled:opacity-40"
                  title="Clear all papers from the batch"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              )}
              <button onClick={handleClose} className="p-2 text-theme-muted hover:text-theme-primary transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 flex flex-col gap-6">

            {/* Success State */}
            {allDone && (
              <div className="flex flex-col items-center py-10 gap-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-theme-primary">{doneCount} Paper{doneCount !== 1 ? 's' : ''} Uploaded!</h3>
                <p className="text-sm text-theme-muted">Your papers have been saved to the database.</p>
                <button
                  onClick={handleClose}
                  className="mt-2 px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm transition-all"
                >
                  Done
                </button>
              </div>
            )}

            {!allDone && (
              <>
                {/* Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={clsx(
                    'flex flex-col items-center justify-center py-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all',
                    isDragging
                      ? 'border-indigo-500 bg-indigo-500/5'
                      : 'border-theme-border hover:border-indigo-500/40 hover:bg-theme-surface/30'
                  )}
                >
                  <CloudUpload className={clsx('w-10 h-10 mb-3 transition-colors', isDragging ? 'text-indigo-400' : 'text-theme-muted')} />
                  <p className="text-sm font-semibold text-theme-secondary">
                    {isDragging ? 'Drop PDFs here' : 'Drag & drop PDFs, or click to browse'}
                  </p>
                  <p className="text-xs text-theme-muted mt-1">
                    {rows.length}/{MAX_FILES} files · {totalSizeMB} MB total
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files || [])}
                  />
                </div>

                {/* Spreadsheet Table */}
                {rows.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-theme-border">
                    <table className="w-full text-left border-collapse min-w-[750px]">
                      <thead>
                        <tr className="border-b border-theme-border text-[10px] text-theme-muted uppercase tracking-widest bg-theme-surface/30">
                          <th className="px-4 py-3 font-bold w-8">#</th>
                          <th className="px-4 py-3 font-bold">Title</th>
                          <th className="px-4 py-3 font-bold">Subject</th>
                          <th className="px-4 py-3 font-bold w-24">Year</th>
                          <th className="px-4 py-3 font-bold w-28">Semester</th>
                          <th className="px-4 py-3 font-bold w-12 text-center">Status</th>
                          <th className="px-4 py-3 font-bold w-20 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-border">
                        {rows.map((row, idx) => {
                          const titleMatch = isTitleMatch(row, papers);
                          const exactDup = isExactDuplicate(row, papers);
                          const batchDup = isBatchDuplicate(row, rows);
                          const dup = titleMatch || exactDup || batchDup;
                          const oversized = row.file.size > MAX_BYTES;
                          const hasWarning = dup || oversized;

                          return (
                            <tr
                              key={row.id}
                              className={clsx(
                                'transition-colors',
                                row.status === 'done' && 'bg-emerald-500/5',
                                row.status === 'error' && 'bg-red-500/5',
                                hasWarning && row.status === 'idle' && 'bg-amber-500/5',
                              )}
                            >
                              {/* Index */}
                              <td className="px-4 py-3 text-xs text-theme-muted font-bold">{idx + 1}</td>

                              {/* Title */}
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  <input
                                    value={row.title}
                                    onChange={(e) => updateRow(row.id, { title: e.target.value })}
                                    onBlur={(e) => updateRow(row.id, { title: e.target.value.toUpperCase() })}
                                    disabled={row.status === 'uploading' || row.status === 'done'}
                                    className={clsx(
                                      'w-full min-w-[180px] bg-theme-surface border rounded-lg px-3 py-2 text-xs text-theme-primary focus:border-indigo-500/50 outline-none transition-colors disabled:opacity-50 uppercase',
                                      dup && row.status === 'idle' ? 'border-amber-500/40' : 'border-theme-border'
                                    )}
                                    placeholder="Paper title"
                                  />
                                  {exactDup && row.status === 'idle' && (
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400 uppercase">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Exact duplicate — already exists
                                    </span>
                                  )}
                                  {titleMatch && !exactDup && !batchDup && row.status === 'idle' && (
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-yellow-500 uppercase">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Title already in system
                                    </span>
                                  )}
                                  {batchDup && row.status === 'idle' && (
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-orange-400 uppercase">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Duplicate in this batch
                                    </span>
                                  )}
                                  {oversized && row.status === 'idle' && (
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-red-400 uppercase">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Exceeds 4.5 MB
                                    </span>
                                  )}
                                  {row.status === 'error' && (
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-red-400 uppercase">
                                      <AlertTriangle className="w-2.5 h-2.5" /> {row.errorMsg}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Subject */}
                              <td className="px-4 py-3">
                                {row.status === 'idle' || row.status === 'error' ? (
                                  <SubjectCell
                                    value={row.subjectId}
                                    subjects={subjects}
                                    onChange={(id) => updateRow(row.id, { subjectId: id })}
                                    onNewSubject={() => setCreateSubjectForRow(row.id)}
                                  />
                                ) : (
                                  <span className="text-xs text-theme-secondary">
                                    {subjects.find((s) => s.id === row.subjectId)?.name || '—'}
                                  </span>
                                )}
                              </td>

                              {/* Year */}
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={row.year}
                                  onChange={(e) => updateRow(row.id, { year: e.target.value })}
                                  disabled={row.status === 'uploading' || row.status === 'done'}
                                  maxLength={4}
                                  placeholder="2024"
                                  className="w-full bg-theme-surface border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-primary focus:border-indigo-500/50 outline-none transition-colors disabled:opacity-50"
                                />
                              </td>

                              {/* Semester */}
                              <td className="px-4 py-3">
                                <div className="relative">
                                  <select
                                    value={row.semester}
                                    onChange={(e) => updateRow(row.id, { semester: e.target.value })}
                                    disabled={row.status === 'uploading' || row.status === 'done'}
                                    className="w-full appearance-none bg-theme-surface border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-primary pr-6 focus:border-indigo-500/50 outline-none transition-colors disabled:opacity-50"
                                  >
                                    <option value="First">First</option>
                                    <option value="Second">Second</option>
                                  </select>
                                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-theme-muted pointer-events-none" />
                                </div>
                              </td>

                              {/* Status icon */}
                              <td className="px-4 py-3 text-center">
                                {row.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 mx-auto" />}
                                {row.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />}
                                {row.status === 'error' && <AlertTriangle className="w-4 h-4 text-red-400 mx-auto" />}
                                {row.status === 'idle' && exactDup && <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />}
                                {row.status === 'idle' && titleMatch && !exactDup && <AlertTriangle className="w-4 h-4 text-yellow-500 mx-auto" />}
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => window.open(URL.createObjectURL(row.file), '_blank')}
                                    className="p-1.5 rounded-lg text-theme-muted hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                                    title="Preview file"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  {(row.status === 'idle' || row.status === 'error') && (
                                    <button
                                      onClick={() => setDeleteConfirmRow(row)}
                                      className="p-1.5 rounded-lg text-theme-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                      title="Remove file"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Progress bar when uploading */}
                {isUploading && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-theme-muted font-medium">
                      <span>Uploading papers…</span>
                      <span>{doneCount} / {readyCount}</span>
                    </div>
                    <div className="h-2 rounded-full bg-theme-surface overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${readyCount > 0 ? (doneCount / readyCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Footer actions */}
                <div className="flex items-center justify-between pt-4 border-t border-theme-border">
                  <p className="text-xs text-theme-muted">
                    <span className="font-bold text-theme-primary">{readyCount}</span> paper{readyCount !== 1 ? 's' : ''} ready to upload
                    {rows.some((r) => isTitleMatch(r, papers) || isExactDuplicate(r, papers) || isBatchDuplicate(r, rows)) && (
                      <span className="ml-2 text-amber-400 font-semibold">
                        · {rows.filter((r) => isTitleMatch(r, papers) || isExactDuplicate(r, papers) || isBatchDuplicate(r, rows)).length} possible duplicate(s)
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleClose}
                      disabled={isUploading}
                      className="px-5 py-2.5 rounded-xl text-theme-secondary hover:bg-theme-surface font-semibold text-sm transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUploadAll}
                      disabled={isUploading || readyCount === 0}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] disabled:opacity-50 disabled:hover:bg-indigo-500"
                    >
                      {isUploading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                      ) : (
                        <><CloudUpload className="w-4 h-4" /> Upload All ({readyCount})</>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Inline Create Subject Popup */}
      {createSubjectForRow && (
        <CreateSubjectPopup
          onCreated={handleSubjectCreated}
          onClose={() => setCreateSubjectForRow(null)}
        />
      )}

      {/* ── Duplicate Prompt Modal ── */}
      {duplicatePrompt.show && duplicatePrompt.duplicateInSystem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md border-theme-border relative flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setDuplicatePrompt({ show: false, row: null, duplicateInSystem: null })}
              className="absolute top-4 right-4 p-2 text-theme-muted hover:text-theme-primary transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <ShieldAlert className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-theme-primary">Possible Duplicate Found</h3>
                  <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Is This a New Paper or a Copy?</p>
                </div>
              </div>

              <p className="text-sm text-theme-secondary mb-5 leading-relaxed">
                A paper with the <span className="font-bold text-theme-primary">same title, subject, year, and semester</span> already exists. Are you uploading a genuinely different paper, or did you mean to update the existing one?
              </p>

              <div className="bg-theme-surface/50 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-center justify-between">
                <div className="flex flex-col gap-1 pr-4">
                  <p className="text-sm font-bold text-theme-primary line-clamp-1">{duplicatePrompt.duplicateInSystem.title}</p>
                  <div className="flex items-center gap-2 text-xs font-bold text-theme-muted uppercase">
                    <span className="text-indigo-400">{duplicatePrompt.duplicateInSystem.year}</span>
                    <span>•</span>
                    <span>{duplicatePrompt.duplicateInSystem.semester} Sem</span>
                    <span>•</span>
                    <span>{duplicatePrompt.duplicateInSystem.upsa_subjects?.name || subjects.find(s => s.id === duplicatePrompt.duplicateInSystem?.subject_id)?.name || 'Unknown Subject'}</span>
                  </div>
                </div>
                <a
                  href={duplicatePrompt.duplicateInSystem.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 shrink-0 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all"
                  title="View Existing Paper"
                >
                  <Eye className="w-5 h-5" />
                </a>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (duplicatePrompt.row) {
                      updateRow(duplicatePrompt.row.id, { forceUpload: true, status: 'idle' });
                    }
                    setDuplicatePrompt({ show: false, row: null, duplicateInSystem: null });
                  }}
                  className="w-full py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] flex justify-center items-center gap-2 text-sm"
                >
                  <CloudUpload className="w-4 h-4" />
                  No, they're different — Upload It
                </button>
                <button
                  onClick={() => {
                    const paper = duplicatePrompt.duplicateInSystem;
                    setDuplicatePrompt({ show: false, row: null, duplicateInSystem: null });
                    if (onEditPaper) {
                      onEditPaper(paper);
                    }
                  }}
                  className="w-full py-3.5 rounded-xl bg-theme-surface hover:bg-theme-surface-2 border border-theme-border text-theme-primary font-bold transition-all flex justify-center items-center gap-2 text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit the Existing One Instead
                </button>
                <button
                  onClick={() => {
                    if (duplicatePrompt.row) {
                      updateRow(duplicatePrompt.row.id, { status: 'error', errorMsg: 'Upload cancelled by user.' });
                    }
                    setDuplicatePrompt({ show: false, row: null, duplicateInSystem: null });
                  }}
                  className="w-full py-2.5 rounded-xl text-theme-muted hover:text-theme-primary font-semibold transition-all text-sm flex justify-center items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Close Confirmation Modal ── */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm border-theme-border relative flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-theme-primary">Discard Uploads?</h3>
                <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Unsaved Progress</p>
              </div>
            </div>

            <p className="text-sm text-theme-secondary mb-6 leading-relaxed">
              You have un-uploaded papers in your list. Are you sure you want to close? Your work will be lost.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  try {
                    await clearBulkUploadDraft();
                  } catch (err) {
                    console.error('Failed to clear bulk upload draft', err);
                  }
                  onClose();
                }}
                className="w-full py-3.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] flex justify-center items-center text-sm"
              >
                Yes, Discard Them
              </button>
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="w-full py-2.5 rounded-xl text-theme-muted hover:text-theme-primary font-semibold transition-all text-sm flex justify-center items-center gap-2"
              >
                No, Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Delete Row Confirmation Modal ── */}
      <ConfirmModal
        isOpen={!!deleteConfirmRow}
        onClose={() => setDeleteConfirmRow(null)}
        onConfirm={() => {
          if (deleteConfirmRow) {
            removeRow(deleteConfirmRow.id);
            setDeleteConfirmRow(null);
          }
        }}
        title="Remove Paper from Batch"
        message={`Are you sure you want to remove the paper "${deleteConfirmRow?.title || deleteConfirmRow?.file.name || 'this paper'}" from your bulk upload batch?`}
        confirmText="Remove Paper"
        cancelText="Cancel"
        variant="danger"
      />

      {/* ── Clear All Confirmation Modal ── */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm border-theme-border relative flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-theme-primary">Clear All Papers?</h3>
                <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold">This cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-theme-secondary mb-6 leading-relaxed">
              Are you sure you want to remove all <span className="font-bold text-theme-primary">{rows.length} paper{rows.length !== 1 ? 's' : ''}</span> from your bulk upload queue? This will also clear the saved draft.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  try {
                    await clearBulkUploadDraft();
                  } catch (err) {
                    console.error('Failed to clear bulk upload draft', err);
                  }
                  setRows([]);
                  setDoneCount(0);
                  setAllDone(false);
                  setShowClearAllConfirm(false);
                }}
                className="w-full py-3.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] flex justify-center items-center gap-2 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Yes, Clear All
              </button>
              <button
                onClick={() => setShowClearAllConfirm(false)}
                className="w-full py-2.5 rounded-xl text-theme-muted hover:text-theme-primary font-semibold transition-all text-sm flex justify-center items-center gap-2"
              >
                <X className="w-4 h-4" />
                No, Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkUploadModal;
