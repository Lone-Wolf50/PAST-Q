import { useState } from 'react';
import { Flag, X, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface ReportModalProps {
  paperId: string;
  paperTitle: string;
  token: string;
  onClose: () => void;
}

const REASONS = [
  { value: 'blurry_pdf',    label: 'PDF is blurry or unreadable' },
  { value: 'missing_pages', label: 'Pages are missing from the document' },
  { value: 'wrong_paper',   label: 'Wrong paper has been uploaded' },
  { value: 'other',         label: 'Other issue' },
];

export const ReportModal = ({ paperId, paperTitle, token, onClose }: ReportModalProps) => {
  const [reason, setReason]   = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async () => {
    if (!reason) { setError('Please select a reason.'); return; }
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/papers/${paperId}/report`, {
        method: 'POST',
        token,
        body: { reason, details: details.trim() || undefined },
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="max-w-md w-full bg-theme-base border border-theme-border rounded-[2rem] overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="p-6 border-b border-theme-border flex items-center justify-between bg-red-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/15 rounded-xl flex items-center justify-center text-red-400 border border-red-500/20">
              <Flag size={18} />
            </div>
            <div>
              <h2 className="font-bold text-theme-primary text-sm">Report an Issue</h2>
              <p className="text-[10px] text-theme-muted font-bold uppercase tracking-wider">Help us keep content accurate</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-theme-muted hover:text-theme-primary transition-colors rounded-xl hover:bg-theme-surface"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            /* ── Success State ── */
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <CheckCircle size={32} />
              </div>
              <div>
                <h3 className="font-bold text-theme-primary text-lg mb-1">Report Submitted!</h3>
                <p className="text-sm text-theme-muted leading-relaxed">
                  Thank you for helping us improve. Our team will review this paper shortly.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-8 py-3 bg-emerald-500 text-white rounded-2xl font-bold text-sm hover:bg-emerald-400 transition-all"
              >
                Done
              </button>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <div className="mb-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/80 leading-relaxed font-medium">
                  Reporting: <span className="font-bold text-amber-300">{paperTitle}</span>
                </p>
              </div>

              <p className="text-xs font-bold text-theme-secondary uppercase tracking-widest mb-3">What's the issue?</p>
              <div className="flex flex-col gap-2 mb-5">
                {REASONS.map(r => (
                  <label
                    key={r.value}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      reason === r.value
                        ? 'border-red-500/40 bg-red-500/10 text-red-300'
                        : 'border-theme-border bg-theme-surface text-theme-secondary hover:border-red-500/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report_reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="accent-red-500"
                    />
                    <span className="text-xs font-semibold">{r.label}</span>
                  </label>
                ))}
              </div>

              <div className="mb-5">
                <label className="text-xs font-bold text-theme-secondary uppercase tracking-widest mb-2 block">
                  Additional Details <span className="text-theme-muted font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="e.g. Page 3 is cut off, question 5 is missing..."
                  maxLength={300}
                  rows={3}
                  className="w-full bg-theme-surface border border-theme-border rounded-xl p-3.5 text-xs text-theme-primary placeholder-gray-500 focus:outline-none focus:border-red-500/40 resize-none transition-colors"
                />
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-2xl border border-theme-border text-theme-muted text-sm font-bold hover:bg-theme-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !reason}
                  className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
                  {loading ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
