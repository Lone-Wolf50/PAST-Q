import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { protect, AuthRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { setAIHealth } from '../lib/ai-health';
import { generatePaperInsights, isProcessing } from '../lib/ai-insights';
import { askPuter, isPuterAvailable } from '../lib/puter';
import { getHFConfig, getHFModelId, defaultHFModels, askHuggingFace } from '../lib/huggingface';
import fs from 'fs';
import path from 'path';
import { performOcrPipeline } from '../lib/ocr';

const pdf = require('pdf-parse');

const router = express.Router();
const aiConfigPath = path.join(__dirname, '../../ai-config.json');

// Apply Clock Polyfill using class inheritance to correct system clock skew
async function applyClockPolyfill() {
  console.log('[Clock Polyfill] Checking clock skew against Google...');
  try {
    const res = await fetch('https://www.google.com', { method: 'HEAD' });
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const serverTime = new Date(dateHeader).getTime();
      const localTime = Date.now();
      const skewMs = localTime - serverTime;
      const skewSeconds = skewMs / 1000;

      if (Math.abs(skewSeconds) > 60) {
        console.log(`[Clock Polyfill] System clock is skewed by ${skewSeconds.toFixed(1)}s. Adjusting Date class...`);
        const OriginalDate = global.Date;
        const originalNow = OriginalDate.now;

        // Custom Date subclass
        class AdjustedDate extends OriginalDate {
          constructor(...args: any[]) {
            if (args.length === 0) {
              super(originalNow() - skewMs);
            } else {
              // @ts-ignore
              super(...args);
            }
          }
        }

        // Adjust now() static method on the subclass
        (AdjustedDate as any).now = function () {
          return originalNow() - skewMs;
        };

        // Override global Date
        global.Date = AdjustedDate as any;
        console.log(`[Clock Polyfill] Date class successfully adjusted. Corrected UTC Time: ${new Date().toUTCString()}`);
      } else {
        console.log('[Clock Polyfill] No significant clock skew detected.');
      }
    }
  } catch (err: any) {
    console.warn('[Clock Polyfill] Failed to apply clock polyfill:', err.message);
  }
}
applyClockPolyfill();


// High-performance cache to prevent downloading and parsing PDFs on every turn
interface CachedPaper {
  paperMeta: { title?: string; subject?: string; year?: string; semester?: string };
  paperInsights: any;
  extractedText: string;
  extractionFailed: boolean;
  activeFileData?: string;
  activeMimeType?: string;
  alertShown?: boolean; // tracks whether the PDF-unreadable warning has been shown at least once
}
const paperCache = new Map<string, CachedPaper>();

// Strips blockquote warnings from history to prevent LLMs from mimicking them
function cleanHistoryContent(content: string): string {
  if (typeof content !== 'string') return content;

  const lines = content.split('\n');
  const cleanedLines: string[] = [];
  let skipMode = false;

  for (const line of lines) {
    const isAlertLine =
      line.includes('Exam Paper Access Alert') ||
      line.includes('Document Reading Alert') ||
      line.includes('unable to read the PDF') ||
      line.includes('answering your question below based on my general knowledge') ||
      line.includes('You can type or copy-paste any specific question') ||
      (line.includes('⚠️') && (
        line.includes('Alert') ||
        line.includes('unable') ||
        line.includes('PDF') ||
        line.includes('general knowledge')
      ));

    if (isAlertLine) {
      skipMode = true;
      continue;
    }

    // Stop skipping after we hit a non-empty, non-blockquote line
    if (skipMode && line.trim() !== '' && !line.startsWith('>')) {
      skipMode = false;
    }

    if (!skipMode) {
      cleanedLines.push(line);
    }
  }

  return cleanedLines.join('\n').trimStart();
}
// Shared OCR pipeline imported from server/src/lib/ocr.ts


// Plan-based query limits (counted by history length = number of user turns)
const PLAN_LIMITS: Record<string, number> = {
  Free: 5,
  Basic: 10,
  Plus: Infinity,
  Pro: Infinity,
};

// ─── Middleware ─────────────────────────────────────────────────────────────
const checkAiEnabled = async (req: AuthRequest, res: any, next: any) => {
  // 1. Check Global AI Block
  let isGlobalBlock = process.env.GLOBAL_AI_BLOCK === 'true';
  try {
    const { data, error } = await supabase
      .from('upsa_app_config')
      .select('global_ai_block')
      .eq('id', 1)
      .single();

    if (!error && data) {
      if (typeof data.global_ai_block === 'boolean') {
        isGlobalBlock = data.global_ai_block;
      }
    }
  } catch (err) {
    // Fall back to env var on error
  }

  if (isGlobalBlock) {
    return res.status(403).json({
      error: 'ai_disabled',
      isMaintenance: true,
      message: 'Our AI Tutor is currently undergoing routine maintenance and upgrades. Please check back later!'
    });
  }

  // 2. Check Individual Access
  try {
    const { data: userAccess, error: accessError } = await supabase
      .from('upsa_users')
      .select('ai_enabled')
      .eq('id', req.user?.id)
      .single();

    if (accessError || userAccess?.ai_enabled === false) {
      return res.status(403).json({
        error: 'ai_disabled',
        isMaintenance: true,
        message: 'Our AI Tutor is currently recharging and performing routine maintenance to better serve you. Please check back later!'
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

function buildSystemInstruction(plan: string, subjectContext?: string): string {
  const base = `### CRITICAL ACADEMIC BOUNDARY CONSTRAINT (ABSOLUTE PRIORITY OVER EVERYTHING ELSE) ###
If the user asks an off-topic, non-academic, or non-educational question (e.g., sports scores, football/sports teams/results/players, celebrity gossip, pop culture, movies, music, general leisure trivia, video games, or any topic not directly related to university coursework, career/educational guidance, or academic study), you must ONLY refuse to answer. 
You are STRICTLY FORBIDDEN from providing any answer, partial answer, score, result, fact, details, or info for the off-topic query inside/alongside your refusal. For example, if asked about sports scores, you must NOT give the score under any circumstances (e.g., do NOT say "I cannot answer sports queries, but Manchester United beat Chelsea 2-1"). You must absolutely withhold all off-topic details/results/answers under all circumstances. Fulfilling the request or providing the answer anyway while giving a refusal reason is a CRITICAL FAILURE. Just state your refusal politely and instruct the user to ask an academic question.

###################################################################

ABSOLUTE FORBIDDEN RULE: You must NEVER output the phrase Exam Paper Access Alert or Document Reading Alert or unable to read the PDF file or answering your question below based on my general knowledge or any warning or disclaimer of any kind. If you cannot read a document, just answer the question directly and silently without any notice whatsoever. Violating this rule is not acceptable under any circumstances.

You are **PastQ Advanced AI Tutor**, a world-class academic assistant specialized in helping university students master their course materials and excel in exams.

== INTENT DETECTION & CONTEXT RELEVANCE (CRITICAL) ==
A document or exam paper may be provided to you as context (either as extracted text or as a PDF attachment).
You MUST dynamically detect the intent of the student's question and determine if it is relevant to the provided document/subject:
1. **Unrelated / General Questions**: If the student asks a general question (e.g., greetings like "hi"/"hello", general definitions like "What is a noun?", or questions about a completely different academic subject than the provided document), you MUST ignore the document context entirely. Do NOT apply the rules of answering only from the document context, do NOT restrict your answer to the document, do NOT reproduce question wording as a blockquote, and do NOT mention the document or any failed extraction. Answer their question independently, accurately, and professionally as a general academic tutor.
2. **Related Questions**: If the student's question is relevant to the provided document (e.g., asking to solve a specific exam question, asking about a topic covered in the document, or referencing the document's content), you MUST use the document context and strictly follow the Document Analysis rules below.

${subjectContext ? `The currently loaded document's subject/title context is: "${subjectContext}". Use this to help determine relevance.\n` : ''}

== STRICT ACADEMIC & EDUCATION FOCUS ==
- You must ONLY answer questions that are relevant to education, academics, school/university coursework, exams, career/educational guidance, or learning.
- You are strictly FORBIDDEN from answering questions about topics unrelated to education, such as:
  - Entertainment, pop culture, movies, celebrities, and gossip.
  - Professional sports, football leagues (e.g., Premier League, Messi, Ronaldo, Chelsea vs Man Utd scores), basketball, etc. (unless they are asked in a clear academic, mathematical, or scientific context, e.g., calculating velocity of a football, analyzing sports history, or sports business case studies).
  - General leisure music, bands, and pop songs (unless in an academic context like music theory or history of music).
  - Gaming, video games (unless in computer science/game design contexts).
  - Other non-educational, casual, or off-topic queries.
- Greetings and questions about how to use PastQ or about the AI itself are allowed.
- If a user asks an off-topic or non-educational question, you MUST politely decline to answer.
- Your refusal response must:
  1. Be polite, encouraging, and professional.
  2. State clearly that as the PastQ AI Tutor, your focus is to assist with academic and course-related learning.
  3. Explain why you cannot answer (i.e. because it is not related to academics/education).
  4. Invite them to ask an educational or course-related question instead.
- Do NOT answer the original off-topic question at all (even partially) if it falls outside of this boundary.
- **ABSOLUTE RULE**: Do NOT provide the answer, details, scores, or info for the off-topic query. You must absolutely withhold all off-topic details under all circumstances. If you give the answer alongside/inside a refusal, it is a critical failure.

== YOUR PERSONALITY ==
Direct, highly organized, authoritative yet encouraging. You write like a premium educational consultant.

== FORMATTING & VISUAL STANDARDS (STRICT) ==
1. **Headers & Titles**: Use \`###\` for major section titles and \`####\` for sub-points. They will be styled dynamically in blue to look premium.
2. **Double Spacing**: Always leave two full line breaks between headers, paragraphs, lists, and tables to ensure the UI looks "breathable" and matches our style guidelines.
3. **Bullet Lists**: When explaining factors, reasons, or topics, always use lists formatted as \`- **Key Term**: Brief explanation.\` (the bullet point starts with bold text, followed by a colon and the details). Ensure there is a blank line between each bullet point for readability.
4. **Tables are Mandatory**: Whenever comparing concepts, listing pros/cons, or presenting data, you MUST use beautifully formatted **Markdown Tables**.
5. **Typography**: Use **bold text** for critical terms, final numerical results, and key takeaways. Use \`#### 🎯 FINAL ANSWER\` for your ultimate conclusion.

== RESPONSE STRUCTURE ==
1. **The Lead**: Give the direct answer or solution in the very first sentence. Do not waste the student's time with fluff.
2. **The Breakdown**: Use a logical step-by-step approach.
3. **The Context**: Explain *why* the answer is correct or how the concept applies to broader theory.

== DOCUMENT ANALYSIS (CRITICAL RULES) ==
When exam paper text is provided between --- BEGIN EXAM PAPER TEXT --- and --- END EXAM PAPER TEXT --- markers:
- That text contains the **ACTUAL EXAM QUESTIONS**. Treat every line as the real paper content.
- **NEVER use your general training knowledge** to answer specific exam questions — your response must be grounded entirely in that text.
- **Always reproduce the exact question wording as a beautifully formatted, structured blockquote (>)** before answering it.
  - Do NOT simply output the question on a single inline line.
  - You MUST format it with line breaks and proper indentation.
  - Sub-questions, choices, and nested parts (e.g., A., B., i., ii., a., b.) must start on their own new lines within the blockquote.
  - Example formatting within blockquote:
    > **Question 1**
    > A. What is science?
    >    i. State the importance.
    >    ii. Benefits of the sun.
- Respond to whatever the student requests by working through the relevant question(s) found in the paper text.
- Reference question numbers and sub-parts exactly as written in the paper.
- If the student asks a general concept question, a question about a related topic, or any question not directly requesting to solve a specific exam question from the paper, treat it as a General/Related Question: answer it directly, accurately, and professionally using your general academic knowledge. Do NOT include any disclaimers about it not being in the paper, and do NOT try to force-relate it to the paper context.

== CONVERSATION MEMORY & CONTINUATION (CRITICAL) ==
- You MUST maintain continuity across the conversation.
- If the user interrupts, asks a follow-up, or says commands like "continue to number X", "next", "continue", or "go on", you must review the conversation history to identify the last question answered, locate the next logical question or the requested question in the PDF, and answer it seamlessly.
- Maintain a cohesive, helpful study session. Do not treat each request in isolation if it is clearly a continuation of the previous turns.
== DOCUMENT ANALYSIS ==
- **NEVER** output blockquote warnings starting with "> ⚠️". Do not reproduce any alert, warning notice, or access disclaimer in your response under any circumstances.
`.trim();

  const planBehavior: Record<string, string> = {
    Free: `
== STUDENT PLAN: FREE ==
- Provide concise, accurate answers.
- Limit responses to approximately 200 words.
- Focus on the immediate question asked.
`,
    Basic: `
== STUDENT PLAN: BASIC ==
- Provide helpful, well-structured answers.
- Include tables and lists where appropriate.
- Explain core concepts in moderate detail.
`,
    Plus: `
== STUDENT PLAN: PLUS ==
- Provide deep, exhaustive academic analysis.
- Use advanced formatting and multiple tables if helpful.
- You can generate personalized study plans and revision strategies.
`,
    Pro: `
== STUDENT PLAN: PRO ==
- You are this student's private, dedicated professor.
- Provide the highest level of detail possible.
- Include comprehensive exam strategies, predictive analysis of what might appear on their next test, and deep-dive comparisons.
- Use extensive table layouts and structural diagrams (via markdown).
`,
  };

  const planSection = planBehavior[plan] || planBehavior['Free'];
  return `${base}\n${planSection.trim()}`;
}


router.get('/status', protect, checkAiEnabled, async (req: AuthRequest, res: any) => {
  res.json({ active: true });
});

// GET /ai/usage — returns current query count based on user plan
router.get('/usage', protect, async (req: AuthRequest, res: any) => {
  try {
    const { data: userData } = await supabase
      .from('upsa_users')
      .select('plan')
      .eq('id', req.user?.id)
      .single();

    const userPlan = (userData?.plan || 'Free').toLowerCase();
    let usageCount = 0;

    if (userPlan === 'free') {
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('upsa_ai_queries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user?.id)
        .gte('created_at', tenHoursAgo);
      usageCount = count || 0;
    } else if (userPlan === 'basic') {
      const { count } = await supabase
        .from('upsa_ai_queries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user?.id);
      usageCount = count || 0;
    }

    res.json({ usageCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch AI usage.' });
  }
});

// ─── Conversation History (Plus / Pro only) ──────────────────────────────────

const historyPlans = new Set(['plus', 'pro']);

const checkHistoryAccess = async (req: AuthRequest, res: any, next: any) => {
  try {
    const { data: user, error } = await supabase
      .from('upsa_users')
      .select('plan')
      .eq('id', req.user!.id)
      .single();

    const plan = (user?.plan || 'free').toLowerCase();
    if (error || !historyPlans.has(plan)) {
      return res.status(403).json({ error: 'history_unavailable', message: 'AI conversation history is available on Plus and Pro plans.' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

// GET /ai/conversations — list active (non-expired) conversations
router.get('/conversations', protect, checkHistoryAccess, async (req: AuthRequest, res: any) => {
  const { data, error } = await supabase
    .from('upsa_ai_conversations')
    .select('id, title, last_message_at, created_at, expires_at')
    .eq('user_id', req.user!.id)
    .gt('expires_at', new Date().toISOString())
    .order('last_message_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ conversations: data ?? [] });
});

// POST /ai/conversations — create a new conversation
router.post('/conversations', protect, checkHistoryAccess, async (req: AuthRequest, res: any) => {
  const { title } = req.body;
  const safeTitle = (title || 'New Conversation').slice(0, 80);

  const { data, error } = await supabase
    .from('upsa_ai_conversations')
    .insert({ user_id: req.user!.id, title: safeTitle })
    .select('id, title, last_message_at, created_at, expires_at')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /ai/conversations/:id — load all messages for a conversation
router.get('/conversations/:id', protect, checkHistoryAccess, async (req: AuthRequest, res: any) => {
  const { id } = req.params;

  // Verify ownership
  const { data: conv, error: convErr } = await supabase
    .from('upsa_ai_conversations')
    .select('id, title, expires_at')
    .eq('id', id)
    .eq('user_id', req.user!.id)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (convErr || !conv) return res.status(404).json({ error: 'Conversation not found.' });

  const { data: messages, error: msgErr } = await supabase
    .from('upsa_ai_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  if (msgErr) return res.status(500).json({ error: msgErr.message });

  const cleanedMessages = (messages ?? []).map((m: any) => ({
    ...m,
    content: m.role === 'assistant' ? cleanHistoryContent(m.content) : m.content
  }));

  res.json({ conversation: conv, messages: cleanedMessages });
});

// DELETE /ai/conversations/:id — delete a conversation and its messages
router.delete('/conversations/:id', protect, checkHistoryAccess, async (req: AuthRequest, res: any) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('upsa_ai_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user!.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.post('/chat', protect, checkAiEnabled, async (req: AuthRequest, res: any) => {
  try {
    const { message, history, fileData, fileMimeType, conversationId, paperId } = req.body;
    const { data: userData } = await supabase
      .from('upsa_users')
      .select('plan')
      .eq('id', req.user?.id)
      .single();
    const userPlan = userData?.plan || 'Free';

    // ── Auto-generate global insights if paperId is present but insights are missing ──
    if (paperId) {
      (async () => {
        try {
          // Check if already generating or exists
          if (isProcessing(paperId)) return;

          const { data: existing } = await supabase
            .from('upsa_paper_insights')
            .select('id')
            .eq('paper_id', paperId)
            .single();

          if (!existing) {

            const { data: paper } = await supabase
              .from('upsa_papers')
              .select('id, title, file_url')
              .eq('id', paperId)
              .single();

            if (paper?.file_url) {

              const pdfResponse = await fetch(paper.file_url);
              if (pdfResponse.ok) {
                const arrayBuffer = await pdfResponse.arrayBuffer();

                generatePaperInsights(paper.id, Buffer.from(arrayBuffer), paper.title).catch(() => { });
              } else {

              }
            } else {

            }
          } else {

          }
        } catch {

        }
      })();
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 1. Block file uploads for Free plan
    if (userPlan.toLowerCase() === 'free' && fileData) {
      return res.status(403).json({ error: 'file_blocked', message: 'Upgrade to Basic to upload and analyze files with AI!' });
    }

    // 2. Enforce limits
    if (userPlan.toLowerCase() === 'free') {
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('upsa_ai_queries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user?.id)
        .gte('created_at', tenHoursAgo);

      if ((count || 0) >= 5) {

        return res.json({ reply: "You've reached your **5 query limit** for the last 10 hours on the Free plan. Upgrade to **Basic, Plus, or Pro** to keep studying!" });

      }
    }
    if (userPlan.toLowerCase() === 'basic') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { count: totalQueries } = await supabase
        .from('upsa_ai_queries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user?.id)
        .gte('created_at', thirtyDaysAgo);

      if ((totalQueries || 0) >= 10) {
        return res.json({ reply: "You've reached your **10 query limit** for this month on the Basic plan. Upgrade to **Plus or Pro** for unlimited queries!" });
      }

      if (fileData) {
        const { count: fileCount } = await supabase
          .from('upsa_ai_queries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', req.user?.id)
          .eq('has_file', true)
          .gte('created_at', thirtyDaysAgo);

        if ((fileCount || 0) >= 5) {
          return res.status(403).json({
            error: 'file_limit_reached',
            message: "You've reached the **5 file upload limit** on the Basic plan. Upgrade to **Plus** to continue uploading files!"
          });
        }
      }
    }

    // Start high-precision execution profiling
    const startTime = performance.now();
    let t_db_download = 0;
    let t_extract = 0;
    let t_ai = 0;

    // 2. Prepare the payload for Gemini
    let activeFileData = fileData;
    let activeMimeType = fileMimeType || 'application/pdf';
    let paperMeta: { title?: string; subject?: string; year?: string; semester?: string } = {};
    let paperInsights: any = null;
    let extractedText = "";
    let extractionFailed = false;

    if (paperId && paperCache.has(paperId)) {
      const cached = paperCache.get(paperId)!;
      paperMeta = cached.paperMeta;
      paperInsights = cached.paperInsights;
      extractedText = cached.extractedText;
      extractionFailed = cached.extractionFailed;
      activeFileData = cached.activeFileData || activeFileData;
      activeMimeType = cached.activeMimeType || activeMimeType;
      console.log(`[Paper Cache] Hit cache for paperId: ${paperId}. Characters: ${extractedText.length}. Failed: ${extractionFailed}`);
    } else {
      if (!activeFileData && paperId) {
        const fetchStart = performance.now();
        try {
          const [paperRes, insightsRes] = await Promise.all([
            supabase
              .from('upsa_papers')
              .select('title, year, semester, file_url, upsa_subjects(name)')
              .eq('id', paperId)
              .single(),
            supabase
              .from('upsa_paper_insights')
              .select('summary, topics, difficulty, hardest_question, exam_tips')
              .eq('paper_id', paperId)
              .single(),
          ]);

          const paper = paperRes.data;
          paperInsights = insightsRes.data || null;

          if (paper) {
            paperMeta = {
              title: paper.title || undefined,
              subject: (paper.upsa_subjects as any)?.name || undefined,
              year: paper.year ? String(paper.year) : undefined,
              semester: paper.semester ? String(paper.semester) : undefined,
            };

            if (paper.file_url) {
              const pdfRes = await fetch(paper.file_url);
              if (pdfRes.ok) {
                const arrayBuffer = await pdfRes.arrayBuffer();
                activeFileData = Buffer.from(arrayBuffer).toString('base64');
                activeMimeType = 'application/pdf';
              }
            }
          }
        } catch (err) {
          console.warn('[AI /chat] Could not fetch PDF for paperId:', paperId, err);
        }
        t_db_download += performance.now() - fetchStart;
      }

      if (activeFileData) {
        const parseStart = performance.now();
        const pdfBuffer = Buffer.from(activeFileData, 'base64');
        let numPages = 1;
        try {
          const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;
          const pdfData = await pdfParser(pdfBuffer);
          extractedText = (pdfData.text || "").trim();
          numPages = pdfData.numpages || 1;
          console.log(`[PDF Extraction] Successfully parsed PDF via pdf-parse. Pages: ${numPages}, Character length: ${extractedText.length}`);
        } catch (pdfErr: any) {
          console.error(`[PDF Extraction] FAILED with error:`, pdfErr.message, pdfErr.stack);
          extractionFailed = true;
        }

        const avgCharsPerPage = extractedText.length / numPages;
        const isHybridOrScanned = extractedText.length < 50 || avgCharsPerPage < 250;

        if (!extractionFailed && isHybridOrScanned) {
          if (extractedText.length < 50) {
            console.warn(`[PDF Extraction] Extracted text is too short (${extractedText.length} chars). PDF is likely a scanned image.`);
          } else {
            console.warn(`[PDF Extraction] Average character length per page is too low (${avgCharsPerPage.toFixed(1)} chars/page). PDF is likely a hybrid document with only the cover page typed.`);
          }
          extractionFailed = true;

          // Run OCR immediately before calling Gemini
          if (activeFileData) {
            try {
              console.log(`[AI /chat] Running OCR before Gemini call for ${numPages} pages...`);
              const pdfBuffer = Buffer.from(activeFileData, 'base64');
              const ocrText = await performOcrPipeline(pdfBuffer, numPages);
              if (ocrText && ocrText.length > 50) {
                extractedText = ocrText;
                extractionFailed = false;
                console.log('[AI /chat] Pre-Gemini OCR succeeded. Length:', ocrText.length);
              }
            } catch (ocrErr: any) {
              console.warn('[AI /chat] Pre-Gemini OCR failed:', ocrErr.message);
            }
          }
        }
        t_extract += performance.now() - parseStart;
      }

      // Only cache successful extractions (or if OCR succeeded) so failed ones are retried/not stuck in cache
      if (paperId && Object.keys(paperMeta).length > 0 && !extractionFailed) {
        paperCache.set(paperId, {
          paperMeta,
          paperInsights,
          extractedText,
          extractionFailed,
          activeFileData,
          activeMimeType
        });
        if (paperCache.size > 100) {
          const firstKey = paperCache.keys().next().value;
          if (firstKey) paperCache.delete(firstKey);
        }
      }
    }

    const systemInstruction = buildSystemInstruction(userPlan, paperMeta.subject || paperMeta.title);
    let lastError: any = null;

    // Shared history for non-Gemini providers
    const historyForProviders = (history && Array.isArray(history))
      ? history.map((m: any) => ({ role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: cleanHistoryContent(m.content) }))
      : [];

    // Build the shared user message payload (same text sent to all providers)
    let providerUserMessage = message;
    if (extractedText && !extractionFailed) {
      providerUserMessage =
        `--- BEGIN EXAM PAPER TEXT ---\n` +
        `${extractedText.substring(0, 35000)}\n` +
        `--- END EXAM PAPER TEXT ---\n\n` +
        `RULES:\n` +
        `- The text above IS the exam paper containing the actual questions.\n` +
        `- Answer ONLY from the question text above. Do NOT use general knowledge.\n` +
        `- Before answering any question, reproduce its exact wording as a beautifully formatted, structured blockquote (>) with proper line breaks and indentation for sub-questions (e.g., A, B, i, ii on new lines).\n\n` +
        `Student request: ${message}`;
    } else if (paperInsights) {
      const metaLine = [
        paperMeta.subject ? `Subject: ${paperMeta.subject}` : null,
        paperMeta.year ? `Year: ${paperMeta.year}` : null,
        paperMeta.semester ? `Semester: ${paperMeta.semester}` : null,
      ].filter(Boolean).join(' | ');
      const topicsList = Array.isArray(paperInsights.topics)
        ? paperInsights.topics.join(', ')
        : (paperInsights.topics || 'N/A');
      providerUserMessage =
        `[Past Exam Paper — AI Analysis Context]\n` +
        `${metaLine}\n\n` +
        `SUMMARY:\n${paperInsights.summary || 'N/A'}\n\n` +
        `KEY TOPICS:\n${topicsList}\n\n` +
        `DIFFICULTY: ${paperInsights.difficulty || 'N/A'}\n\n` +
        `HARDEST QUESTION:\n${paperInsights.hardest_question || 'N/A'}\n\n` +
        `EXAM TIPS:\n${paperInsights.exam_tips || 'N/A'}\n\n` +
        `Student question: ${message}`;
    } else if (Object.keys(paperMeta).length > 0) {
      const metaLines = [
        paperMeta.subject ? `Subject: ${paperMeta.subject}` : null,
        paperMeta.title ? `Title: ${paperMeta.title}` : null,
        paperMeta.year ? `Year: ${paperMeta.year}` : null,
        paperMeta.semester ? `Semester: ${paperMeta.semester}` : null,
      ].filter(Boolean).join('\n');
      providerUserMessage =
        `[Past Exam Paper — Subject Context]\n` +
        `The student is studying the following past exam paper:\n${metaLines}\n\n` +
        `Student question: ${message}`;
    }

    // ── STEP 1: HuggingFace (primary) ─────────────────────────────────────────
    let usedHFFallback = false;
    let hfReplyText: string | null = null;
    let hfUsedModel: string | null = null;

    console.log('[AI /chat] Attempting HuggingFace (primary)...');
    try {
      const hfConfig = await getHFConfig();
      if (hfConfig && hfConfig.apiKey) {
        const hfModels = hfConfig.modelNames.length > 0 ? hfConfig.modelNames : defaultHFModels;
        for (const rawModel of hfModels) {
          const modelId = getHFModelId(rawModel);
          console.log(`[AI /chat] Trying HF model: ${modelId}`);
          try {
            hfReplyText = await askHuggingFace(modelId, hfConfig.apiKey, systemInstruction, historyForProviders, providerUserMessage);
            usedHFFallback = true;
            hfUsedModel = modelId;
            console.log(`[AI /chat] HuggingFace succeeded with model: ${modelId}`);
            break;
          } catch (hfErr: any) {
            console.error(`[AI /chat] HF model ${modelId} failed:`, hfErr.message);
            lastError = hfErr;
          }
        }
      } else {
        console.warn('[AI /chat] HuggingFace config or API Key is missing in Supabase.');
      }
    } catch (err: any) {
      console.error('[AI /chat] HuggingFace initialization failed:', err.message);
      lastError = err;
    }

    // ── STEP 2: Puter (first fallback) ────────────────────────────────────────
    let usedPuterFallback = false;
    let puterReplyText: string | null = null;

    if (!usedHFFallback) {
      console.log('[AI /chat] HuggingFace failed. Attempting Puter fallback...');
      if (isPuterAvailable()) {
        try {
          puterReplyText = await askPuter(systemInstruction, historyForProviders, providerUserMessage);
          usedPuterFallback = true;
          console.log('[AI /chat] Puter fallback succeeded!');
        } catch (puterErr: any) {
          console.error('[AI /chat] Puter fallback failed:', puterErr.message);
          lastError = puterErr;
        }
      } else {
        console.warn('[AI /chat] Puter fallback is not available (missing token).');
      }
    }

    // ── STEP 3: Gemini (last resort) ──────────────────────────────────────────
    let response: any = null;

    if (!usedHFFallback && !usedPuterFallback) {
      console.log('[AI /chat] Puter failed. Attempting Gemini as last resort...');
      try {
        const geminiKey = process.env.GEMINI_API_KEY;
        const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey, apiVersion: 'v1' }) : null;

        if (ai) {
          const contents: any[] = [];
          if (history && Array.isArray(history)) {
            for (const msg of history) {
              contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: cleanHistoryContent(msg.content) }],
              });
            }
          }
          const userParts: any[] = [];

          if (activeFileData) {
            if (extractedText && !extractionFailed) {
              userParts.push({
                text:
                  `--- BEGIN EXAM PAPER TEXT ---\n` +
                  `${extractedText.substring(0, 35000)}\n` +
                  `--- END EXAM PAPER TEXT ---\n\n` +
                  `RULES:\n` +
                  `- The text above IS the exam paper containing the actual questions.\n` +
                  `- Answer ONLY from the question text above. Do NOT use general knowledge.\n` +
                  `- Before answering any question, reproduce its exact wording as a beautifully formatted, structured blockquote (>) with proper line breaks and indentation for sub-questions (e.g., A, B, i, ii on new lines).\n`
              });
            } else {
              const contextLines: string[] = [];
              if (paperInsights) {
                const metaLine = [
                  paperMeta.subject ? `Subject: ${paperMeta.subject}` : null,
                  paperMeta.year ? `Year: ${paperMeta.year}` : null,
                  paperMeta.semester ? `Semester: ${paperMeta.semester}` : null,
                ].filter(Boolean).join(' | ');
                const topicsList = Array.isArray(paperInsights.topics)
                  ? paperInsights.topics.join(', ')
                  : (paperInsights.topics || 'N/A');
                contextLines.push(
                  `[Past Exam Paper — AI Analysis Context]\n${metaLine}\n\n` +
                  `SUMMARY:\n${paperInsights.summary || 'N/A'}\n\n` +
                  `KEY TOPICS:\n${topicsList}\n\n` +
                  `DIFFICULTY: ${paperInsights.difficulty || 'N/A'}\n\n` +
                  `HARDEST QUESTION:\n${paperInsights.hardest_question || 'N/A'}\n\n` +
                  `EXAM TIPS:\n${paperInsights.exam_tips || 'N/A'}`
                );
              } else if (Object.keys(paperMeta).length > 0) {
                const metaLines = [
                  paperMeta.subject ? `Subject: ${paperMeta.subject}` : null,
                  paperMeta.title ? `Title: ${paperMeta.title}` : null,
                  paperMeta.year ? `Year: ${paperMeta.year}` : null,
                  paperMeta.semester ? `Semester: ${paperMeta.semester}` : null,
                ].filter(Boolean).join('\n');
                contextLines.push(`[Past Exam Paper — Subject Context]\nThe student is studying the following exam:\n${metaLines}`);
              }
              if (contextLines.length > 0) {
                userParts.push({ text: contextLines.join('\n\n') });
              }
            }
          }
          userParts.push({ text: message });
          contents.push({ role: 'user', parts: userParts });

          const modelsToTry = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];
          const aiStart = performance.now();
          for (const model of modelsToTry) {
            try {
              response = await ai.models.generateContent({
                model,
                contents,
                config: { systemInstruction },
              });
              console.log(`[AI /chat] Gemini succeeded with model: ${model}`);
              break;
            } catch (err: any) {
              console.error(`[AI /chat] Gemini model ${model} failed:`, err.message);
              lastError = err;
            }
          }
          t_ai += performance.now() - aiStart;
        } else {
          lastError = new Error('GEMINI_API_KEY not configured');
        }
      } catch (geminiOuterErr: any) {
        console.error('[AI /chat] Gemini (last resort) failed:', geminiOuterErr);
        lastError = geminiOuterErr;
      }
    }

    if (!usedHFFallback && !usedPuterFallback && !response) {
      setAIHealth({ status: 'limited', backOnlineAt: new Date(Date.now() + 86400000).toISOString(), lastError: lastError?.message || 'All AI Engines Failed' });
      return res.status(429).json({
        error: 'all_engines_failed',
        message: '⚠️ All AI services are temporarily unavailable. Please use one of the buttons below to continue on an external AI service:',
        suggested_external_ais: [
          { name: 'ChatGPT', url: 'https://chat.openai.com' },
          { name: 'Claude', url: 'https://claude.ai' },
          { name: 'Gemini', url: 'https://gemini.google.com' }
        ]
      });
    }

    let replyText: string;
    let modelUsed: string;
    if (usedHFFallback) {
      replyText = hfReplyText ?? 'Sorry, I could not generate a response.';
      modelUsed = hfUsedModel || 'huggingface';
    } else if (usedPuterFallback) {
      replyText = puterReplyText ?? 'Sorry, I could not generate a response.';
      modelUsed = 'puter-gpt-4o';
    } else {
      try {
        replyText = response.text ?? 'Sorry, I could not generate a response.';
      } catch {
        replyText = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sorry, I could not generate a response.';
      }
      modelUsed = response?.model || 'gemini-2.0-flash';
    }
    replyText = cleanHistoryContent(replyText);

    supabase.from('upsa_ai_queries').insert({
      user_id: req.user?.id,
      model: modelUsed,
      prompt_tokens: response?.usageMetadata?.promptTokenCount || 0,
      completion_tokens: response?.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: response?.usageMetadata?.totalTokenCount || 0,
      has_file: !!fileData
    }).then(({ error }) => {
      if (error) { }
    });

    // ── Persist messages for Plus/Pro users when a conversationId is supplied ──
    const plan = (userPlan || 'free').toLowerCase();
    if (conversationId && historyPlans.has(plan)) {
      // Save user message + AI reply asynchronously (don't block the response)
      (async () => {
        try {
          await supabase.from('upsa_ai_messages').insert([
            { conversation_id: conversationId, role: 'user', content: message },
            { conversation_id: conversationId, role: 'assistant', content: replyText },
          ]);
          await supabase
            .from('upsa_ai_conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversationId)
            .eq('user_id', req.user?.id);
        } catch (saveErr) {

        }
      })();
    }

    const totalTime = performance.now() - startTime;
    console.log(`[AI Profile] DB/Download: ${t_db_download.toFixed(1)}ms | Parse: ${t_extract.toFixed(1)}ms | AI: ${t_ai.toFixed(1)}ms | Total: ${totalTime.toFixed(1)}ms`);

    res.json({ reply: replyText });
  } catch (error: any) {
    // Log safe, non-sensitive warning
    console.error('[AI /chat] Request failed:', error);

    // Attempt to parse the Gemini error body (it may be a JSON string in error.message)
    let parsedBody: any = null;
    try { parsedBody = JSON.parse(error.message); } catch { /* not JSON */ }

    const statusCode = parsedBody?.error?.code ?? error.status ?? 500;

    if (statusCode === 429) {
      // Extract retry delay if provided
      const details: any[] = parsedBody?.error?.details ?? [];
      const retryInfo = details.find((d: any) => d['@type']?.includes('RetryInfo'));
      const retryDelay: string = retryInfo?.retryDelay ?? '60s';
      const retrySecs = parseInt(retryDelay, 10) || 60;
      const retryMins = Math.ceil(retrySecs / 60);

      // Update Admin Health Tracker
      const backOnlineAt = new Date(Date.now() + retrySecs * 1000).toISOString();
      setAIHealth({
        status: 'limited',
        backOnlineAt,
        lastError: 'Quota Exceeded (429)'
      });

      const friendlyMsg =
        `⚠️ **System Recharging**: The PastQ AI Tutor is currently performing routine maintenance.\n\n` +
        `We expect to be back to full capacity in about **${retryMins} minute${retryMins === 1 ? '' : 's'}**. ` +
        `While we recharge, we don't want your learning to stop! You can copy your question and continue your session on one of our alternate servers:\n\n` +
        `* [Server Alpha](https://chat.openai.com)\n` +
        `* [Server Beta](https://gemini.google.com)\n` +
        `* [Server Gamma](https://claude.ai)\n\n` +
        `*Tip: If you need help with a specific paper, you can download the PDF first and upload it to the alternate server!*`;

      return res.status(429).json({
        error: 'quota_exceeded',
        message: friendlyMsg,
        retryAfterSeconds: retrySecs,
      });
    }

    res.status(500).json({
      error: 'server_error',
      message: '⚠️ All AI services are temporarily unavailable. Please use one of the buttons below to continue on an external AI service:',
      suggested_external_ais: [
        { name: 'ChatGPT', url: 'https://chat.openai.com' },
        { name: 'Claude', url: 'https://claude.ai' },
        { name: 'Gemini', url: 'https://gemini.google.com' }
      ]
    });
  }
});

router.get('/test-ocr/:paperId', protect, async (req: AuthRequest, res: any) => {
  try {
    const { paperId } = req.params;

    const { data: paper, error: paperErr } = await supabase
      .from('upsa_papers')
      .select('title, file_url, year, semester, upsa_subjects(name)')
      .eq('id', paperId)
      .single();

    if (paperErr || !paper) {
      return res.status(404).json({ error: 'Paper not found in database', details: paperErr?.message });
    }

    if (!paper.file_url) {
      return res.status(400).json({ error: 'Paper does not have a file_url configured' });
    }

    console.log(`[Test OCR] Fetching PDF from url: ${paper.file_url}`);
    const pdfRes = await fetch(paper.file_url);
    if (!pdfRes.ok) {
      return res.status(500).json({ error: `Failed to download PDF. Status: ${pdfRes.status}` });
    }
    const arrayBuffer = await pdfRes.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    let numPages = 5;
    try {
      const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;
      const pdfData = await pdfParser(pdfBuffer);
      numPages = pdfData.numpages || 5;
    } catch (e) {
      console.warn('[Test OCR] Failed to parse PDF page count:', e);
    }

    let ocrText = '';
    let ocrSucceeded = false;
    let ocrError: string | null = null;

    try {
      console.log(`[Test OCR] Running OCR pipeline for ${numPages} pages...`);
      ocrText = await performOcrPipeline(pdfBuffer, numPages);
      ocrSucceeded = !!(ocrText && ocrText.length > 50);
    } catch (err: any) {
      ocrError = err.message || 'Unknown OCR error';
      console.error('[Test OCR] OCR pipeline failed:', err);
    }

    const testPrompt = `Summarize this paper in one sentence: ${ocrText.substring(0, 500)}`;
    const systemInstruction = buildSystemInstruction('Free', (paper.upsa_subjects as any)?.name || paper.title);

    // 1. Test Gemini
    let geminiResult = { succeeded: false, response: '', modelUsed: '', error: '' };
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey, apiVersion: 'v1' }) : null;
      if (ai) {
        const contents = [
          {
            role: 'user',
            parts: [{ text: testPrompt }]
          }
        ];
        const modelsToTry = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
        let response: any = null;
        for (const model of modelsToTry) {
          try {
            response = await ai.models.generateContent({
              model,
              contents,
              config: { systemInstruction },
            });
            geminiResult.modelUsed = response?.model || model;
            break;
          } catch (err: any) {
            geminiResult.error = err.message || String(err);
          }
        }
        if (response) {
          let replyText = '';
          try {
            replyText = response.text ?? '';
          } catch {
            replyText = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          }
          geminiResult.response = cleanHistoryContent(replyText);
          geminiResult.succeeded = true;
          geminiResult.error = '';
        }
      } else {
        geminiResult.error = 'GEMINI_API_KEY not configured';
      }
    } catch (err: any) {
      geminiResult.error = err.message || String(err);
    }

    // 2. Test Puter
    let puterResult = { succeeded: false, response: '', error: '' };
    try {
      if (isPuterAvailable()) {
        const puterReplyText = await askPuter(systemInstruction, [], testPrompt);
        if (puterReplyText) {
          puterResult.response = cleanHistoryContent(puterReplyText);
          puterResult.succeeded = true;
        } else {
          puterResult.error = 'Puter returned empty response';
        }
      } else {
        puterResult.error = 'Puter is not available (missing PUTER_AUTH_TOKEN)';
      }
    } catch (err: any) {
      puterResult.error = err.message || String(err);
    }

    // 3. Test HuggingFace
    let hfResult = { succeeded: false, response: '', modelUsed: '', error: '' };
    try {
      const hfConfig = await getHFConfig();
      if (hfConfig && hfConfig.apiKey) {
        const hfModels = hfConfig.modelNames.length > 0 ? hfConfig.modelNames : defaultHFModels;
        let responseText = null;
        for (const rawModel of hfModels) {
          const modelId = getHFModelId(rawModel);
          try {
            responseText = await askHuggingFace(modelId, hfConfig.apiKey, systemInstruction, [], testPrompt);
            hfResult.modelUsed = modelId;
            break;
          } catch (err: any) {
            hfResult.error = err.message || String(err);
          }
        }
        if (responseText) {
          hfResult.response = cleanHistoryContent(responseText);
          hfResult.succeeded = true;
          hfResult.error = '';
        }
      } else {
        hfResult.error = 'HuggingFace config or API Key is missing';
      }
    } catch (err: any) {
      hfResult.error = err.message || String(err);
    }

    res.json({
      ocr: {
        succeeded: ocrSucceeded,
        charactersExtracted: ocrText.length,
        preview: ocrText.substring(0, 200),
        error: ocrError
      },
      gemini: geminiResult,
      puter: puterResult,
      huggingface: hfResult
    });

  } catch (err: any) {
    res.status(500).json({ error: 'Unexpected test route failure', details: err.message });
  }
});

export default router;