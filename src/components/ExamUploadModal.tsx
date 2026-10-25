import { useState, useRef, useCallback } from 'react';
import {
  X, Camera, Upload, Loader2, CheckCircle2, AlertTriangle,
  Trash2, Plus, Image as ImageIcon, FileText, Sparkles, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetchMultipart } from '../lib/api';
import { clsx } from 'clsx';

interface ExamUploadModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'capture' | 'details' | 'uploading' | 'success' | 'error';

const MAX_PHOTOS = 4;

const ExamUploadModal: React.FC<ExamUploadModalProps> = ({ onClose, onSuccess }) => {
  const { token } = useAuth();
  const [step, setStep] = useState<Step>('capture');
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [subjectName, setSubjectName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [examType, setExamType] = useState('');
  const [description, setDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ── Add photos from file input ────────────────────────────────────────────
  const handleFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_PHOTOS - photos.length;
    const toAdd = files.slice(0, remaining);

    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotos((prev) => {
          if (prev.length >= MAX_PHOTOS) return prev;
          return [...prev, { file, preview: ev.target?.result as string }];
        });
      };
      reader.readAsDataURL(file);
    });

    // Reset inputs so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, [photos.length]);

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Convert images to PDF using jsPDF ─────────────────────────────────────
  const createPdfFromPhotos = async (): Promise<Blob> => {
    const { jsPDF } = await import('jspdf');

    // Load all images as Image elements first
    const loadedImages = await Promise.all(
      photos.map(
        (p) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = p.preview;
          })
      )
    );

    // Create PDF in A4 landscape/portrait depending on image orientation
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 5;

    loadedImages.forEach((img, i) => {
      if (i > 0) pdf.addPage();

      const imgRatio = img.width / img.height;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;

      let drawW: number, drawH: number;
      if (imgRatio > availW / availH) {
        // Image is wider proportionally
        drawW = availW;
        drawH = availW / imgRatio;
      } else {
        drawH = availH;
        drawW = availH * imgRatio;
      }

      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;

      pdf.addImage(img.src, 'JPEG', x, y, drawW, drawH, undefined, 'MEDIUM');
    });

    return pdf.output('blob');
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (photos.length === 0 || !detailsComplete) return;
    setStep('uploading');
    setUploadProgress(10);
    setErrorMsg('');

    try {
      // Step 1: Generate PDF from photos
      setUploadProgress(20);
      const pdfBlob = await createPdfFromPhotos();
      setUploadProgress(50);

      // Step 2: Build FormData
      const formData = new FormData();
      formData.append('pdf', new File([pdfBlob], 'exam_paper.pdf', { type: 'application/pdf' }));
      formData.append('photo_count', photos.length.toString());
      formData.append('subject_name', subjectName.trim());
      formData.append('course_code', courseCode.trim());
      formData.append('year', trimmedYear);
      formData.append('semester', semester);
      formData.append('exam_type', examType);
      if (description) formData.append('description', description);

      setUploadProgress(60);

      // Step 3: Upload
      await apiFetchMultipart('/exam-submissions', formData, {
        token: token || undefined,
      });

      setUploadProgress(100);
      setStep('success');
      onSuccess?.();
    } catch (err: any) {
      console.error('[ExamUpload] Upload error:', err);
      setErrorMsg(err?.body?.error || err.message || 'Upload failed. Please try again.');
      setStep('error');
    }
  };

  // ── Academic year format check (expects e.g. 2025/2026) ───────────────────
  const trimmedYear = year.trim();
  const yearMatch = /^(\d{4})\/(\d{4})$/.exec(trimmedYear);
  const yearFormatInvalid =
    trimmedYear !== '' &&
    (!yearMatch || Number(yearMatch[2]) !== Number(yearMatch[1]) + 1);

  // All detail fields (course name → exam type) are required
  const detailsComplete =
    subjectName.trim() !== '' &&
    courseCode.trim() !== '' &&
    trimmedYear !== '' &&
    !yearFormatInvalid &&
    semester !== '' &&
    examType !== '';

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md">
      <div
        className={clsx(
          "w-full sm:max-w-lg bg-theme-base border border-theme-border overflow-hidden shadow-2xl relative flex flex-col",
          "rounded-t-[2rem] sm:rounded-[2rem]",
          "max-h-[92vh] sm:max-h-[85vh]"
        )}
      >
        {/* ── Decorative glow ─────────────────────────────────────────────── */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/8 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/6 blur-[80px] rounded-full pointer-events-none" />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-theme-border/50 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center">
              <Camera className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-theme-primary tracking-tight">
                {step === 'capture' && 'Upload Exam Paper'}
                {step === 'details' && 'Paper Details'}
                {step === 'uploading' && 'Submitting...'}
                {step === 'success' && 'Submitted! 🎉'}
                {step === 'error' && 'Upload Failed'}
              </h2>
              <p className="text-[11px] text-theme-muted font-medium">
                {step === 'capture' && 'Snap up to 4 photos of your exam paper'}
                {step === 'details' && 'All fields marked * are required'}
                {step === 'uploading' && 'Converting photos to PDF & uploading...'}
                {step === 'success' && 'Your paper is now under review'}
                {step === 'error' && 'Something went wrong'}
              </p>
            </div>
          </div>
          {step !== 'uploading' && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-theme-surface hover:bg-theme-surface-2 text-theme-muted hover:text-theme-primary transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 relative z-10">

          {/* STEP 1: Photo Capture */}
          {step === 'capture' && (
            <div className="space-y-5">
              {/* Photo grid */}
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo, i) => (
                  <div key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-theme-border/60 bg-theme-surface group">
                    <img src={photo.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 sm:group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhoto(i);
                      }}
                      aria-label={`Remove photo ${i + 1}`}
                      title="Remove photo"
                      className="absolute top-2 right-2 z-10 p-2 sm:p-1.5 rounded-lg bg-red-500/90 hover:bg-red-600 text-white shadow-md transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 active:scale-95 cursor-pointer flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                    <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white/80 bg-black/40 px-2 py-0.5 rounded-md pointer-events-none">
                      Page {i + 1}
                    </span>
                  </div>
                ))}

                {/* Add photo slot */}
                {photos.length < MAX_PHOTOS && (
                  <div className="aspect-[3/4] rounded-xl border-2 border-dashed border-theme-border/60 hover:border-indigo-500/40 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer bg-theme-surface/30 hover:bg-indigo-500/5 group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                      <Plus className="w-5 h-5 text-indigo-400" />
                    </div>
                    <span className="text-[11px] font-bold text-theme-muted group-hover:text-indigo-400 transition-colors">
                      Add Photo
                    </span>
                    <span className="text-[9px] text-theme-muted/60 font-medium">
                      {photos.length}/{MAX_PHOTOS}
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={photos.length >= MAX_PHOTOS}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-xl text-sm font-bold transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Camera
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photos.length >= MAX_PHOTOS}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-theme-surface hover:bg-theme-surface-2 border border-theme-border/60 text-theme-secondary rounded-xl text-sm font-bold transition-all disabled:opacity-40 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                  Gallery
                </button>
              </div>

              {/* Hidden inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />

              {/* Info */}
              <div className="flex items-start gap-3 p-3.5 bg-indigo-500/5 border border-indigo-500/15 rounded-xl">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-theme-primary mb-0.5">Earn 24hrs Premium!</p>
                  <p className="text-[10px] text-theme-muted leading-relaxed">
                    Upload clear photos of your exam papers. Once approved, you'll get 24 hours of premium access per paper. Premium hours stack!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Paper Details */}
          {step === 'details' && (
            <div className="space-y-4">
              <p className="text-xs text-theme-muted mb-2 font-medium">
                Fill in all the details below so we can correctly identify this paper.
              </p>

              {/* Course Name */}
              <div>
                <label className="text-[10px] font-extrabold text-theme-muted uppercase tracking-widest mb-1.5 block">Course Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="e.g. Introduction to Economics"
                  className="w-full bg-theme-surface border border-theme-border/60 rounded-xl px-4 py-3 text-sm text-theme-primary placeholder:text-theme-muted/40 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>

              {/* Course Code */}
              <div>
                <label className="text-[10px] font-extrabold text-theme-muted uppercase tracking-widest mb-1.5 block">Course Code <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="e.g. ECON 101"
                  className="w-full bg-theme-surface border border-theme-border/60 rounded-xl px-4 py-3 text-sm text-theme-primary placeholder:text-theme-muted/40 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>

              {/* Year & Semester */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-theme-muted uppercase tracking-widest mb-1.5 block">Academic Year <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="e.g. 2025/2026"
                    maxLength={9}
                    className={clsx(
                      "w-full bg-theme-surface border rounded-xl px-4 py-3 text-sm text-theme-primary placeholder:text-theme-muted/40 focus:outline-none transition-colors",
                      yearFormatInvalid
                        ? "border-amber-500/60 focus:border-amber-500"
                        : "border-theme-border/60 focus:border-indigo-500/50"
                    )}
                  />
                  {yearFormatInvalid ? (
                    <p className="text-[10px] text-amber-400 mt-1 font-medium">
                      Use the format 2025/2026 (consecutive years).
                    </p>
                  ) : (
                    <p className="text-[10px] text-theme-muted/60 mt-1 font-medium">
                      Format: YYYY/YYYY
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-theme-muted uppercase tracking-widest mb-1.5 block">Semester <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="w-full appearance-none bg-theme-surface border border-theme-border/60 rounded-xl px-4 py-3 text-sm text-theme-primary focus:outline-none focus:border-indigo-500/50 transition-colors cursor-pointer"
                    >
                      <option value="">Select</option>
                      <option value="1">Semester 1</option>
                      <option value="2">Semester 2</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Exam Type */}
              <div>
                <label className="text-[10px] font-extrabold text-theme-muted uppercase tracking-widest mb-1.5 block">Exam Type <span className="text-red-400">*</span></label>
                <div className="relative">
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="w-full appearance-none bg-theme-surface border border-theme-border/60 rounded-xl px-4 py-3 text-sm text-theme-primary focus:outline-none focus:border-indigo-500/50 transition-colors cursor-pointer"
                  >
                    <option value="">Select type</option>
                    <option value="End of Semester">End of Semester</option>
                    <option value="Mid-Semester">Mid-Semester</option>
                    <option value="Resit">Resit</option>
                    <option value="Quiz">Quiz</option>
                    <option value="Other">Other</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-extrabold text-theme-muted uppercase tracking-widest mb-1.5 block">Note (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Any extra info about this paper..."
                  rows={2}
                  className="w-full bg-theme-surface border border-theme-border/60 rounded-xl px-4 py-3 text-sm text-theme-primary placeholder:text-theme-muted/40 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Uploading */}
          {step === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                </div>
                {/* Progress ring */}
                <svg className="absolute inset-0 w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="3" className="text-theme-border/30" />
                  <circle
                    cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="3"
                    className="text-indigo-500 transition-all duration-700"
                    strokeDasharray={`${2 * Math.PI * 36}`}
                    strokeDashoffset={`${2 * Math.PI * 36 * (1 - uploadProgress / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-theme-primary">{uploadProgress}%</p>
                <p className="text-xs text-theme-muted mt-1 font-medium">
                  {uploadProgress < 40 && 'Converting photos to PDF...'}
                  {uploadProgress >= 40 && uploadProgress < 70 && 'Uploading to server...'}
                  {uploadProgress >= 70 && 'AI is extracting metadata...'}
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-10 gap-5">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <div className="text-center max-w-xs">
                <h3 className="text-lg font-black text-theme-primary mb-1">Paper Submitted!</h3>
                <p className="text-xs text-theme-muted leading-relaxed">
                  Your exam paper has been submitted for admin review. You'll receive an email notification once it's approved or if we need a clearer photo.
                </p>
              </div>

              {/* Reward info */}
              <div className="w-full flex items-center gap-3 p-4 bg-indigo-500/8 border border-indigo-500/20 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-theme-primary">+24hrs Premium on Approval</p>
                  <p className="text-[10px] text-theme-muted mt-0.5">
                    Once your paper is verified, you'll automatically receive 24 hours of premium access!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Error */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-10 gap-5">
              <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <AlertTriangle className="w-10 h-10 text-red-400" />
              </div>
              <div className="text-center max-w-xs">
                <h3 className="text-lg font-black text-theme-primary mb-1">Upload Failed</h3>
                <p className="text-xs text-red-300 leading-relaxed bg-red-500/10 border border-red-500/20 p-3 rounded-xl mt-2">
                  {errorMsg}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-theme-border/50 relative z-10">
          {step === 'capture' && (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-theme-surface hover:bg-theme-surface-2 border border-theme-border/60 text-theme-muted rounded-xl text-sm font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('details')}
                disabled={photos.length === 0}
                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-500/15 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Next — Details
              </button>
            </div>
          )}

          {step === 'details' && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep('capture')}
                className="py-3 px-5 bg-theme-surface hover:bg-theme-surface-2 border border-theme-border/60 text-theme-muted rounded-xl text-sm font-bold transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!detailsComplete}
                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-500/15 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Submit Paper ({photos.length} {photos.length === 1 ? 'photo' : 'photos'})
              </button>
            </div>
          )}

          {step === 'success' && (
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
            >
              Done
            </button>
          )}

          {step === 'error' && (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-theme-surface hover:bg-theme-surface-2 border border-theme-border/60 text-theme-muted rounded-xl text-sm font-bold transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => { setStep('details'); setErrorMsg(''); }}
                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamUploadModal;
