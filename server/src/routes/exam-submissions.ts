import { Router, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { supabase } from '../lib/supabase';
import { protect, AuthRequest } from '../middleware/auth';
import { notifyTelegram } from '../lib/telegram';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// All routes require student authentication
router.use(protect);

// ── Multer for PDF uploads (max 10 MB) ──────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_SUBMISSIONS_PER_DAY = 3;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between submissions
const PREMIUM_HOURS_PER_PAPER = 24;
const PREMIUM_PLAN_ON_APPROVE = 'basic'; // plan granted during premium window

// ── Helper: generate a short 8-char ID ──────────────────────────────────────
function generateShortId(): string {
  return crypto.randomBytes(4).toString('hex'); // 8 hex chars
}

// ── Helper: SHA-256 hash of a buffer ────────────────────────────────────────
function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ── Helper: extract metadata with Gemini (separate key) ─────────────────────
async function extractMetadataWithAI(pdfBuffer: Buffer): Promise<{
  subject_name?: string;
  course_code?: string;
  year?: string;
  semester?: string;
  exam_type?: string;
  confidence: string;
} | null> {
  const aiKey = process.env.EXAM_UPLOAD_AI_KEY;
  const model = process.env.EXAM_UPLOAD_AI_MODEL || 'gemini-2.0-flash';

  if (!aiKey) {
    console.warn('[ExamSubmissions] EXAM_UPLOAD_AI_KEY not set — skipping AI extraction.');
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: aiKey });
    const base64Pdf = pdfBuffer.toString('base64');

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Pdf,
              },
            },
            {
              text: `You are analyzing a scanned university exam paper. Extract the following metadata from the document.
Return ONLY a valid JSON object with these keys (use null for any field you cannot determine):
{
  "subject_name": "Full subject/course name",
  "course_code": "Course code (e.g. ECON 101)",
  "year": "Academic year (e.g. 2024 or 2024/2025)",
  "semester": "Semester (e.g. 1 or 2 or First or Second)",
  "exam_type": "Type of exam (e.g. Mid-Semester, End of Semester, Resit, Quiz)",
  "confidence": "high | medium | low"
}
Do NOT include any explanation, markdown, or extra text — only the JSON.`,
            },
          ],
        },
      ],
    });

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Strip markdown fences if present
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      subject_name: parsed.subject_name || null,
      course_code: parsed.course_code || null,
      year: parsed.year || null,
      semester: parsed.semester || null,
      exam_type: parsed.exam_type || null,
      confidence: parsed.confidence || 'low',
    };
  } catch (err: any) {
    console.error('[ExamSubmissions] AI metadata extraction failed:', err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/exam-submissions  — Student uploads a combined PDF
// ══════════════════════════════════════════════════════════════════════════════
router.post(
  '/',
  (req: any, res: any, next: any) => {
    upload.single('pdf')(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File size too large. Maximum allowed size is 4.5MB.' });
        }
        return res.status(400).json({ error: err.message || 'File upload error.' });
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email;

  try {
    // ── Multer error (file too large or wrong type) ───────────────────────
    if (!req.file) {
      res.status(400).json({ error: 'A PDF file is required.' });
      return;
    }

    // ── Required details validation ──────────────────────────────────────
    const reqFields = ['subject_name', 'course_code', 'year', 'semester', 'exam_type'] as const;
    const missing = reqFields.filter((f) => !String(req.body[f] || '').trim());
    if (missing.length) {
      res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      return;
    }
    const ym = /^(\d{4})\/(\d{4})$/.exec(String(req.body.year).trim());
    if (!ym || Number(ym[2]) !== Number(ym[1]) + 1) {
      res.status(400).json({ error: 'Academic year must be in the format 2025/2026.' });
      return;
    }

    // ── Rate limit: max 3 per day ────────────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayCount } = await supabase
      .from('upsa_exam_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('submitted_at', todayStart.toISOString());

    if ((todayCount || 0) >= MAX_SUBMISSIONS_PER_DAY) {
      res.status(429).json({ error: `You can only submit ${MAX_SUBMISSIONS_PER_DAY} exam papers per day. Try again tomorrow!` });
      return;
    }

    // ── Cooldown: 5-minute gap between submissions ───────────────────────
    const { data: lastSub } = await supabase
      .from('upsa_exam_submissions')
      .select('submitted_at')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single();

    if (lastSub) {
      const elapsed = Date.now() - new Date(lastSub.submitted_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        const waitSecs = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        res.status(429).json({ error: `Please wait ${waitSecs} seconds before submitting another paper.` });
        return;
      }
    }

    // ── Duplicate detection via file hash ────────────────────────────────
    const fileHash = sha256(req.file.buffer);

    const { data: duplicate } = await supabase
      .from('upsa_exam_submissions')
      .select('id')
      .eq('file_hash', fileHash)
      .limit(1)
      .single();

    if (duplicate) {
      res.status(409).json({ error: 'This exact paper has already been submitted.' });
      return;
    }

    // ── Upload PDF to Supabase Storage ───────────────────────────────────
    const shortId = generateShortId();
    const storagePath = `${userId}/${shortId}_${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('student-uploads')
      .upload(storagePath, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('[ExamSubmissions] Storage upload error:', uploadError.message);
      res.status(500).json({ error: 'Failed to upload file. Please try again.' });
      return;
    }

    // ── Extract metadata with AI (non-blocking — OK if it fails) ────────
    const studentFields = {
      subject_name: (req.body.subject_name || '').trim() || null,
      course_code: (req.body.course_code || '').trim() || null,
      year: (req.body.year || '').trim() || null,
      semester: (req.body.semester || '').trim() || null,
      exam_type: (req.body.exam_type || '').trim() || null,
      description: (req.body.description || '').trim() || null,
    };

    let aiMeta: Awaited<ReturnType<typeof extractMetadataWithAI>> = null;
    try {
      aiMeta = await extractMetadataWithAI(req.file.buffer);
    } catch { /* ignore */ }

    // Merge: student-provided fields win; AI fills gaps
    const finalMeta = {
      subject_name: studentFields.subject_name || aiMeta?.subject_name || null,
      course_code: studentFields.course_code || aiMeta?.course_code || null,
      year: studentFields.year || aiMeta?.year || null,
      semester: studentFields.semester || aiMeta?.semester || null,
      exam_type: studentFields.exam_type || aiMeta?.exam_type || null,
    };

    const photoCount = parseInt(req.body.photo_count as string, 10) || 1;

    // ── Save to DB ──────────────────────────────────────────────────────
    const { data: submission, error: dbError } = await supabase
      .from('upsa_exam_submissions')
      .insert({
        short_id: shortId,
        user_id: userId,
        user_email: userEmail,
        subject_name: finalMeta.subject_name,
        course_code: finalMeta.course_code,
        year: finalMeta.year,
        semester: finalMeta.semester,
        exam_type: finalMeta.exam_type,
        description: studentFields.description,
        ai_metadata: aiMeta || null,
        ai_confidence: aiMeta?.confidence || null,
        storage_path: storagePath,
        file_hash: fileHash,
        file_size: req.file.size,
        photo_count: photoCount,
        status: 'pending',
        premium_hours: 0,
      })
      .select('id, short_id, subject_name, status, submitted_at')
      .single();

    if (dbError) {
      console.error('[ExamSubmissions] DB insert error:', dbError.message);
      res.status(500).json({ error: 'Failed to save submission.' });
      return;
    }

    // ── Notify Admin via Telegram ────────────────────────────────────────
    const subjectLine = finalMeta.subject_name || 'Unknown Subject';
    const yearLine = finalMeta.year || '?';
    const semLine = finalMeta.semester || '?';
    const examLine = finalMeta.exam_type || 'Exam';
    const confLine = aiMeta?.confidence || 'n/a';

    const telegramMessage = [
      `📸 *New Exam Submission*`,
      `━━━━━━━━━━━━━━━━━━`,
      `• From: \`${userEmail}\``,
      `• Subject: *${subjectLine}*`,
      `• Code: ${finalMeta.course_code || '—'}`,
      `• Year: ${yearLine} | Sem: ${semLine}`,
      `• Type: ${examLine}`,
      `• Photos: ${photoCount} combined into PDF`,
      `• AI Confidence: ${confLine}`,
      `• ID: \`${shortId}\``,
      ``,
      `✅ \`/approve ${shortId}\``,
      `❌ \`/reject ${shortId} reason here\``,
    ].join('\n');

    // Send text notification + the PDF document
    notifyTelegram(telegramMessage).catch(() => {});

    // Also try to send the actual PDF file to Telegram
    sendPdfToTelegram(req.file.buffer, `${shortId}.pdf`, `Exam PDF — ${subjectLine} (${userEmail})`).catch(() => {});

    res.status(201).json({
      message: 'Your exam paper has been submitted for review!',
      submission,
    });
  } catch (err: any) {
    console.error('[ExamSubmissions] Unexpected error:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/exam-submissions  — Student views their own submissions
// ══════════════════════════════════════════════════════════════════════════════
router.get('/', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const { data, error } = await supabase
      .from('upsa_exam_submissions')
      .select('id, short_id, subject_name, course_code, year, semester, exam_type, description, photo_count, status, admin_notes, premium_hours, premium_plan, submitted_at, reviewed_at')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ submissions: data || [] });
  } catch (err: any) {
    console.error('[ExamSubmissions] Fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch submissions.' });
  }
});

// ── Helper: send PDF document to Telegram ────────────────────────────────────
// node-telegram-bot-api v2 uses .sendDocument(chatId, doc, options)
async function sendPdfToTelegram(buffer: Buffer, filename: string, caption: string) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) return;

  try {
    // Use the Telegram HTTP API directly for file upload (multipart)
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', buffer, { filename, contentType: 'application/pdf' });
    form.append('caption', caption.slice(0, 1024)); // Telegram caption limit

    const fetchModule = await import('node:https');
    await new Promise<void>((resolve, reject) => {
      const request = fetchModule.request(
        `https://api.telegram.org/bot${token}/sendDocument`,
        { method: 'POST', headers: form.getHeaders() },
        (response) => {
          let body = '';
          response.on('data', (chunk: string) => (body += chunk));
          response.on('end', () => {
            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              resolve();
            } else {
              console.warn('[ExamSubmissions] Telegram sendDocument response:', body);
              resolve(); // non-fatal
            }
          });
        }
      );
      request.on('error', (err) => {
        console.warn('[ExamSubmissions] Telegram sendDocument error:', err.message);
        resolve(); // non-fatal
      });
      form.pipe(request);
    });
  } catch (err: any) {
    console.warn('[ExamSubmissions] Telegram sendDocument failed:', err.message);
  }
}

export default router;
