import React, { useState, useEffect, useRef, useCallback, TextareaHTMLAttributes } from 'react';
import {
  X, Loader2, AlertTriangle, Check, Trash2, Plus, RefreshCw, FileText, PlusCircle, Pencil, ChevronDown, ChevronUp
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiFetch } from '../lib/api';

// Auto-growing textarea that resizes to fit content on mount + every change
const AutoGrowTextarea: React.FC<
  TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }
> = (props) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    // Use rAF to ensure the DOM has rendered before measuring
    const raf = requestAnimationFrame(() => resize());
    return () => cancelAnimationFrame(raf);
  }, [props.value, resize]);

  return (
    <textarea
      {...props}
      ref={ref}
      onInput={(e) => {
        resize();
        props.onInput?.(e);
      }}
      style={{ ...props.style, overflowY: 'hidden', resize: 'none' }}
    />
  );
};

interface SubPart {
  label: string;
  text: string;
  marks?: number | null;
  sub_parts?: SubPart[];
}

interface Question {
  question_no: number;
  body: string;
  marks: number | null;
  sub_parts: SubPart[];
}

const getSubPartsMarksSum = (subs: SubPart[]): number => {
  let total = 0;
  for (const sp of subs) {
    if (sp.marks !== null && sp.marks !== undefined) total += Number(sp.marks) || 0;
    if (sp.sub_parts && sp.sub_parts.length > 0) {
      total += getSubPartsMarksSum(sp.sub_parts);
    }
  }
  return total;
};

interface QuestionScannerModalProps {
  paper: {
    id: string;
    title: string;
    year: string | number;
    semester: string;
  };
  onClose: () => void;
  onSaveSuccess: () => void;
}

const QuestionScannerModal: React.FC<QuestionScannerModalProps> = ({
  paper,
  onClose,
  onSaveSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const startScan = async () => {
    setLoading(true);
    setError(null);
    setEditingIndex(null);
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token');

      // 1. Try to load already verified questions if they exist
      try {
        const checkRes = await apiFetch(`/papers/${paper.id}/questions`, {
          token: token || undefined
        });
        if (checkRes.verified && Array.isArray(checkRes.questions) && checkRes.questions.length > 0) {
          const mapSubpart = (sp: any): SubPart => ({
            label: sp.label || '',
            text: sp.text || '',
            marks: sp.marks !== undefined && sp.marks !== null ? Number(sp.marks) : null,
            sub_parts: Array.isArray(sp.sub_parts) ? sp.sub_parts.map(mapSubpart) : []
          });

          const formatted = checkRes.questions.map((q: any) => ({
            question_no: Number(q.question_no) || 1,
            body: q.body || '',
            marks: q.marks !== undefined && q.marks !== null ? Number(q.marks) : null,
            sub_parts: Array.isArray(q.sub_parts) ? q.sub_parts.map(mapSubpart) : []
          }));
          setQuestions(formatted);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.log('[Scanner UI] No verified questions found or failed to fetch, proceeding with fresh scan:', err);
      }

      // 2. Proceed with fresh scan if no verified questions exist
      const res = await apiFetch(`/hq-management/papers/${paper.id}/scan-questions`, {
        method: 'POST',
        token: token || undefined
      });
      if (res.questions && Array.isArray(res.questions)) {
        const mapSubpart = (sp: any): SubPart => ({
          label: sp.label || '',
          text: sp.text || '',
          marks: sp.marks !== undefined && sp.marks !== null ? Number(sp.marks) : null,
          sub_parts: Array.isArray(sp.sub_parts) ? sp.sub_parts.map(mapSubpart) : []
        });

        const formatted = res.questions.map((q: any) => {
          const subParts = Array.isArray(q.sub_parts) ? q.sub_parts.map(mapSubpart) : [];
          const sum = getSubPartsMarksSum(subParts);
          const parsedMarks = q.marks !== undefined && q.marks !== null ? Number(q.marks) : null;
          return {
            question_no: Number(q.question_no) || 1,
            body: q.body || '',
            marks: parsedMarks !== null ? parsedMarks : (sum > 0 ? sum : null),
            sub_parts: subParts
          };
        });
        setQuestions(formatted);
      } else {
        throw new Error('Invalid response structure from scanner.');
      }
    } catch (err: any) {
      console.error('[Scanner UI] Error:', err);
      setError(err.message || 'Failed to extract questions from the PDF. Please check server logs or retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startScan();
  }, [paper.id]);

  // Prevent accidental browser refresh / tab close while questions are loaded
  useEffect(() => {
    if (questions.length === 0 && !loading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [questions.length, loading]);

  // Safe close with confirmation when there are unsaved questions
  const safeClose = () => {
    if (questions.length > 0) {
      setConfirmCloseOpen(true);
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (questions.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('admin_token');
      // Ensure all questions have their subparts marks sum auto-filled if q.marks is null
      const questionsToSave = questions.map(q => {
        const sum = getSubPartsMarksSum(q.sub_parts);
        return {
          ...q,
          marks: q.marks !== null && q.marks !== undefined ? q.marks : (sum > 0 ? sum : null)
        };
      });
      await apiFetch(`/hq-management/papers/${paper.id}/verify-questions`, {
        method: 'POST',
        token: token || undefined,
        body: { questions: questionsToSave }
      });
      onSaveSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save verified questions.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearVerified = () => {
    setConfirmClearOpen(true);
  };

  const performClearVerified = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('admin_token');
      await apiFetch(`/hq-management/papers/${paper.id}/verified-questions`, {
        method: 'DELETE',
        token: token || undefined
      });
      onSaveSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to clear verified questions.');
      setSaving(false);
    }
  };

  const handleQuestionChange = (index: number, key: keyof Question, value: any) => {
    setQuestions(prev => prev.map((q, idx) => idx === index ? { ...q, [key]: value } : q));
  };

  const handleSubPartChange = (qIndex: number, spIndex: number, key: keyof SubPart, value: any) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx === qIndex) {
        const updatedSubParts = q.sub_parts.map((sp, sIdx) =>
          sIdx === spIndex ? { ...sp, [key]: value } : sp
        );
        const newSum = getSubPartsMarksSum(updatedSubParts);
        return {
          ...q,
          sub_parts: updatedSubParts,
          marks: newSum > 0 ? newSum : q.marks
        };
      }
      return q;
    }));
  };

  const handleAddSubPart = (qIndex: number) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx === qIndex) {
        return {
          ...q,
          sub_parts: [...q.sub_parts, { label: '', text: '', marks: null, sub_parts: [] }]
        };
      }
      return q;
    }));
  };

  const handleRemoveSubPart = (qIndex: number, spIndex: number) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx === qIndex) {
        const updatedSubParts = q.sub_parts.filter((_, sIdx) => sIdx !== spIndex);
        const newSum = getSubPartsMarksSum(updatedSubParts);
        return {
          ...q,
          sub_parts: updatedSubParts,
          marks: newSum > 0 ? newSum : null
        };
      }
      return q;
    }));
  };

  const handleNestedSubPartChange = (qIndex: number, spIndex: number, sspIndex: number, key: keyof SubPart, value: any) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx === qIndex) {
        const updatedSubParts = q.sub_parts.map((sp, sIdx) => {
          if (sIdx === spIndex) {
            const updatedNested = (sp.sub_parts || []).map((ssp, nsIdx) =>
              nsIdx === sspIndex ? { ...ssp, [key]: value } : ssp
            );
            return { ...sp, sub_parts: updatedNested };
          }
          return sp;
        });
        const newSum = getSubPartsMarksSum(updatedSubParts);
        return {
          ...q,
          sub_parts: updatedSubParts,
          marks: newSum > 0 ? newSum : q.marks
        };
      }
      return q;
    }));
  };

  const handleAddNestedSubPart = (qIndex: number, spIndex: number) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx === qIndex) {
        const updatedSubParts = q.sub_parts.map((sp, sIdx) => {
          if (sIdx === spIndex) {
            return {
              ...sp,
              sub_parts: [...(sp.sub_parts || []), { label: '', text: '', marks: null }]
            };
          }
          return sp;
        });
        return { ...q, sub_parts: updatedSubParts };
      }
      return q;
    }));
  };

  const handleRemoveNestedSubPart = (qIndex: number, spIndex: number, sspIndex: number) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx === qIndex) {
        const updatedSubParts = q.sub_parts.map((sp, sIdx) => {
          if (sIdx === spIndex) {
            return {
              ...sp,
              sub_parts: (sp.sub_parts || []).filter((_, nsIdx) => nsIdx !== sspIndex)
            };
          }
          return sp;
        });
        const newSum = getSubPartsMarksSum(updatedSubParts);
        return {
          ...q,
          sub_parts: updatedSubParts,
          marks: newSum > 0 ? newSum : null
        };
      }
      return q;
    }));
  };

  const handleDeleteQuestion = (index: number) => {
    if (editingIndex === index) setEditingIndex(null);
    setQuestions(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleAddQuestion = () => {
    const nextNo = questions.length > 0 ? Math.max(...questions.map(q => q.question_no)) + 1 : 1;
    const newIdx = questions.length;
    setQuestions(prev => [
      ...prev,
      {
        question_no: nextNo,
        body: '',
        marks: null,
        sub_parts: []
      }
    ]);
    setEditingIndex(newIdx);
  };

  const isEditing = (idx: number) => editingIndex === idx;

  const toggleEdit = (idx: number) => {
    setEditingIndex(prev => prev === idx ? null : idx);
  };

  // Render a single question card
  const renderQuestionCard = (q: Question, idx: number) => {
    const editing = isEditing(idx);
    const subMarksSum = getSubPartsMarksSum(q.sub_parts);
    const displayMarks = q.marks !== null && q.marks !== undefined ? q.marks : (subMarksSum > 0 ? subMarksSum : null);

    return (
      <div
        key={idx}
        className="relative bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden transition-all duration-200 hover:border-slate-700"
        style={{ borderLeft: '3px solid rgb(99 102 241 / 0.6)' }}
      >
        {/* Card Header — Question number + actions */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-950/60 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            {editing ? (
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Q.</label>
                <input
                  type="number"
                  value={q.question_no}
                  onChange={(e) => handleQuestionChange(idx, 'question_no', parseInt(e.target.value) || 1)}
                  className="w-14 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-white font-bold focus:border-indigo-500 focus:outline-none text-center"
                />
              </div>
            ) : (
              <span className="text-sm font-bold text-indigo-400">Question {q.question_no}</span>
            )}

            {/* Total marks badge (read-only display in non-edit, editable in edit) */}
            {displayMarks !== null && !editing && (
              <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/50">
                {displayMarks} Total Mark{displayMarks !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => toggleEdit(idx)}
              className={`p-1.5 rounded-lg transition-colors ${editing
                ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
              title={editing ? 'Done editing' : 'Edit question'}
            >
              {editing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => handleDeleteQuestion(idx)}
              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
              title="Delete question"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card Body — full-width question text */}
        <div className="px-5 py-4">
          {editing ? (
            <AutoGrowTextarea
              value={q.body}
              onChange={(e) => handleQuestionChange(idx, 'body', e.target.value)}
              placeholder="Enter the main question text..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none leading-relaxed"
              style={{ minHeight: '80px' }}
            />
          ) : (
            <div className="ai-prose text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {q.body ? (
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ children }) => (
                      <div className="ai-table-wrapper my-2">
                        <table className="ai-table border border-slate-800 text-xs">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="ai-thead bg-slate-950/40">{children}</thead>,
                    tr: ({ children }) => <tr className="ai-tr border-b border-slate-800/60">{children}</tr>,
                    th: ({ children }) => <th className="ai-th px-3 py-2 text-left font-bold text-slate-300">{children}</th>,
                    td: ({ children }) => <td className="ai-td px-3 py-2 text-slate-400">{children}</td>,
                  }}
                >
                  {q.body}
                </Markdown>
              ) : (
                <span className="text-slate-600 italic">No question text</span>
              )}
            </div>
          )}

          {/* Sub-parts */}
          {(q.sub_parts.length > 0 || editing) && (
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-slate-800">
              {q.sub_parts.map((sp, spIdx) => (
                <div key={spIdx} className="space-y-3">
                  <div className="flex items-start gap-2">
                    {editing ? (
                      <>
                        <input
                          type="text"
                          placeholder="a"
                          value={sp.label}
                          onChange={(e) => handleSubPartChange(idx, spIdx, 'label', e.target.value)}
                          className="w-12 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-indigo-400 font-bold focus:border-indigo-500 focus:outline-none text-center flex-shrink-0 mt-0.5"
                        />
                        <AutoGrowTextarea
                          value={sp.text}
                          onChange={(e) => handleSubPartChange(idx, spIdx, 'text', e.target.value)}
                          placeholder="Sub-question text..."
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none leading-relaxed"
                          style={{ minHeight: '28px' }}
                        />
                        <div className="flex items-center gap-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Marks</label>
                          <input
                            type="number"
                            placeholder="—"
                            value={sp.marks !== null && sp.marks !== undefined ? sp.marks : ''}
                            onChange={(e) => handleSubPartChange(idx, spIdx, 'marks', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                            className="w-12 bg-slate-900 border border-slate-700 rounded-md px-1.5 py-0.5 text-xs text-white focus:border-indigo-500 focus:outline-none text-center"
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveSubPart(idx, spIdx)}
                          className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors flex-shrink-0 mt-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-indigo-400 mt-0.5 flex-shrink-0 w-6">
                          ({sp.label})
                        </span>
                        <div className="flex-1">
                          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {sp.text}
                            {sp.marks !== null && sp.marks !== undefined && (
                              <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-800/60 px-1.5 py-0.5 rounded ml-2">
                                {sp.marks} mark{sp.marks !== 1 ? 's' : ''}
                              </span>
                            )}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Level 3: Nested sub-parts */}
                  {((sp.sub_parts && sp.sub_parts.length > 0) || editing) && (
                    <div className="pl-6 space-y-2 border-l border-slate-800/60">
                      {sp.sub_parts?.map((ssp, sspIdx) => (
                        <div key={sspIdx} className="flex items-start gap-2">
                          {editing ? (
                            <>
                              <input
                                type="text"
                                placeholder="i"
                                value={ssp.label}
                                onChange={(e) => handleNestedSubPartChange(idx, spIdx, sspIdx, 'label', e.target.value)}
                                className="w-10 bg-slate-900 border border-slate-700 rounded-md px-1.5 py-0.5 text-xs text-amber-500/80 font-bold focus:border-indigo-500 focus:outline-none text-center flex-shrink-0 mt-0.5"
                              />
                              <AutoGrowTextarea
                                value={ssp.text}
                                onChange={(e) => handleNestedSubPartChange(idx, spIdx, sspIdx, 'text', e.target.value)}
                                placeholder="Nested sub-question text..."
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none leading-relaxed"
                                style={{ minHeight: '28px' }}
                              />
                              <div className="flex items-center gap-1">
                                <label className="text-[9px] font-bold text-slate-500 uppercase">Marks</label>
                                <input
                                  type="number"
                                  placeholder="—"
                                  value={ssp.marks !== null && ssp.marks !== undefined ? ssp.marks : ''}
                                  onChange={(e) => handleNestedSubPartChange(idx, spIdx, sspIdx, 'marks', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                                  className="w-12 bg-slate-900 border border-slate-700 rounded-md px-1.5 py-0.5 text-xs text-white focus:border-indigo-500 focus:outline-none text-center"
                                />
                              </div>
                              <button
                                onClick={() => handleRemoveNestedSubPart(idx, spIdx, sspIdx)}
                                className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors flex-shrink-0 mt-0.5"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-xs font-semibold text-amber-500/80 mt-0.5 flex-shrink-0 w-6">
                                ({ssp.label})
                              </span>
                              <div className="flex-1">
                                <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
                                  {ssp.text}
                                  {ssp.marks !== null && ssp.marks !== undefined && (
                                    <span className="text-[9px] font-bold text-slate-600 uppercase bg-slate-800/40 px-1 py-0.5 rounded ml-2">
                                      {ssp.marks} mark{ssp.marks !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {editing && (
                        <button
                          type="button"
                          onClick={() => handleAddNestedSubPart(idx, spIdx)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-amber-500/80 hover:text-amber-400/80 transition-colors mt-1"
                        >
                          <Plus className="w-2.5 h-2.5" /> Add sub-sub-part
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {editing && (
                <button
                  type="button"
                  onClick={() => handleAddSubPart(idx)}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors mt-2"
                >
                  <Plus className="w-3 h-3" /> Add sub-part
                </button>
              )}
            </div>
          )}
        </div>

        {/* Card Footer — Total Marks */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-950/40 border-t border-slate-800/60">
          <div className="flex items-center gap-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Marks</label>
            <input
              type="number"
              placeholder="—"
              value={q.marks !== null && q.marks !== undefined ? q.marks : ''}
              onChange={(e) => handleQuestionChange(idx, 'marks', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
              className="w-20 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-white font-bold focus:border-indigo-500 focus:outline-none text-center"
            />
          </div>
          {subMarksSum > 0 && (
            <span className="text-[10px] text-slate-500 italic">
              Sub-parts sum: {subMarksSum}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <div className="relative w-full max-w-5xl h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Paper Question Scanner</h2>
              <p className="text-xs text-slate-400">
                {paper.title} &middot; <span className="font-semibold text-slate-300">{paper.year}</span> &middot; <span className="text-[10px] uppercase font-bold text-slate-400">{paper.semester} Sem</span>
              </p>
            </div>
          </div>
          <button
            onClick={safeClose}
            disabled={loading || saving}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/30">
          
          {loading && (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
              <h3 className="text-lg font-semibold text-white">Scanning Exam PDF...</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md text-center">
                AI is currently processing pages, performing OCR extraction, and parsing questions into a structured format. This may take up to a minute.
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center h-full py-20 max-w-lg mx-auto">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-white text-center">Scan Operations Failed</h3>
              <p className="text-sm text-red-300 text-center mt-2 leading-relaxed bg-red-950/20 border border-red-900/40 p-4 rounded-xl w-full">
                {error}
              </p>
              <div className="flex gap-4 mt-6">
                <button
                  onClick={startScan}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Retry Scan
                </button>
                <button
                  onClick={safeClose}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
                >
                  Close Scanner
                </button>
              </div>
            </div>
          )}

          {!loading && !error && questions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <div className="p-3 bg-slate-800 rounded-full mb-4 text-slate-400">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-white">No questions extracted yet</h3>
              <p className="text-sm text-slate-400 mt-1">Click below to start scanning or add one manually.</p>
              <div className="flex gap-4 mt-6">
                <button
                  onClick={startScan}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Scan Paper
                </button>
                <button
                  onClick={handleAddQuestion}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
                >
                  Add Question Manually
                </button>
              </div>
            </div>
          )}

          {!loading && !error && questions.length > 0 && (
            <div className="space-y-5">
              {/* Info Bar */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Review Extracted Questions</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Click the pencil icon on any question to edit. Delete incorrect entries before approving.</p>
                </div>
                <div className="text-xs font-semibold px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400">
                  {questions.length} Questions Found
                </div>
              </div>

              {/* Question Cards */}
              <div className="space-y-4">
                {questions.map((q, idx) => renderQuestionCard(q, idx))}
              </div>

              {/* Add Question Button */}
              <button
                type="button"
                onClick={handleAddQuestion}
                className="w-full py-4 border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/10 hover:bg-slate-950/25 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4 text-indigo-500" /> Add New Question Card
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div>
            {!loading && !error && questions.length > 0 && (
              <button
                onClick={handleClearVerified}
                disabled={saving}
                className="text-xs font-bold text-red-400 hover:text-red-300 hover:underline transition-all disabled:opacity-50"
              >
                Reset Verification
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={safeClose}
              disabled={loading || saving}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
            
            {!loading && !error && questions.length > 0 && (
              <>
                <button
                  onClick={startScan}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-semibold rounded-xl transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Re-scan
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Approve & Save
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Custom Confirmation Dialog for Closing */}
      {confirmCloseOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-center">
            <div className="mx-auto w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Unsaved Scanned Questions</h3>
            <p className="text-sm text-slate-400 mb-6">
              You have unsaved scanned questions. Are you sure you want to close? All progress will be lost.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setConfirmCloseOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
              >
                No, Stay
              </button>
              <button
                onClick={() => {
                  setConfirmCloseOpen(false);
                  onClose();
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl shadow-lg transition-colors"
              >
                Yes, Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog for Resetting/Clearing */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-center">
            <div className="mx-auto w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Reset Verification?</h3>
            <p className="text-sm text-slate-400 mb-6">
              Are you sure you want to clear all verified questions for this paper? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmClearOpen(false);
                  performClearVerified();
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl shadow-lg transition-colors"
              >
                Yes, Clear
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default QuestionScannerModal;
