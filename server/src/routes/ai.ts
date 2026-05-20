import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { protect, AuthRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { setAIHealth } from '../lib/ai-health';
import { generatePaperInsights, isProcessing } from '../lib/ai-insights';
import { askPuter, isPuterAvailable } from '../lib/puter';
import fs from 'fs';
import path from 'path';

const pdf = require('pdf-parse');

const router = express.Router();
const aiConfigPath = path.join(__dirname, '../../ai-config.json');

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

// Build a tailored system instruction based on the student's plan
function buildSystemInstruction(plan: string): string {
  const base = `
You are **PastQ Advanced AI Tutor**, a world-class academic assistant specialized in helping university students master their course materials and excel in exams.

== YOUR PERSONALITY ==
Direct, highly organized, authoritative yet encouraging. You write like a premium educational consultant.

== FORMATTING & VISUAL STANDARDS (STRICT) ==
1. **Tables are Mandatory**: Whenever comparing concepts, listing pros/cons, or presenting data (like accounting entries, economic variables, or scientific constants), you MUST use beautifully formatted **Markdown Tables**.
2. **Double Spacing**: Always leave two full line breaks between headers, paragraphs, and tables to ensure the UI looks "breathable" and premium.
3. **Typography**: Use **bold text** for critical terms, final numerical results, and key takeaways.
4. **Hierarchy**: Use \`###\` for major sections and \`####\` for sub-points. Use \`#### 🎯 FINAL ANSWER\` for your ultimate conclusion or solution.
5. **Mobile First**: Keep paragraphs short (3 sentences max). Use bullet points for lists to prevent "text clumping" on small screens.

== RESPONSE STRUCTURE ==
1. **The Lead**: Give the direct answer or solution in the very first sentence. Do not waste the student's time with fluff.
2. **The Breakdown**: Use a logical step-by-step approach.
3. **The Context**: Explain *why* the answer is correct or how the concept applies to broader theory.

== DOCUMENT ANALYSIS (CRITICAL RULES) ==
When exam paper text is provided between --- BEGIN EXAM PAPER TEXT --- and --- END EXAM PAPER TEXT --- markers:
- That text contains the **ACTUAL EXAM QUESTIONS**. Treat every line as the real paper content.
- **NEVER use your general training knowledge** to answer — your response must be grounded entirely in that text.
- **Always reproduce the exact question wording** as a blockquote (>) before answering it.
- Respond to whatever the student requests by working through the relevant question(s) found in the paper text.
- Reference question numbers and sub-parts exactly as written in the paper.
- If a question cannot be located in the provided text, say so explicitly.
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
  res.json({ conversation: conv, messages: messages ?? [] });
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

    // NOTE: We intentionally do NOT hard-fail here if GEMINI_API_KEY is missing.
    // The model loop below will simply skip all Gemini models and fall through to
    // the Puter.js fallback, which does not require a Gemini key.

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
      
      // Check overall query count (10 queries per month billing cycle as per UI)
      const { count: totalQueries } = await supabase
        .from('upsa_ai_queries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user?.id)
        .gte('created_at', thirtyDaysAgo);

      if ((totalQueries || 0) >= 10) {
        return res.json({ reply: "You've reached your **10 query limit** for this month on the Basic plan. Upgrade to **Plus or Pro** for unlimited queries!" });
      }

      // Check file upload limit for Basic (5 files per month cycle)
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

    // 2. Prepare the payload for Gemini
    let activeFileData = fileData;
    let activeMimeType = fileMimeType || 'application/pdf';
    // Paper metadata + pre-generated insights — fetched when paperId is provided
    let paperMeta: { title?: string; subject?: string; year?: string; semester?: string } = {};
    let paperInsights: any = null;

    // If no manual file is uploaded, but a paperId is provided, fetch it from R2
    if (!activeFileData && paperId) {
      try {
        // Fetch paper metadata and pre-generated insights in parallel
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
          // Store metadata so the Puter fallback can provide academic context
          paperMeta = {
            title: paper.title || undefined,
            subject: (paper.upsa_subjects as any)?.name || undefined,
            year: paper.year ? String(paper.year) : undefined,
            semester: paper.semester || undefined,
          };

          if (paper.file_url) {
            const pdfRes = await fetch(paper.file_url);
            if (pdfRes.ok) {
              const arrayBuffer = await pdfRes.arrayBuffer();
              activeFileData = Buffer.from(arrayBuffer).toString('base64');
              activeMimeType = 'application/pdf';
            } else {
              console.warn(`[AI /chat] PDF fetch failed: HTTP ${pdfRes.status} for paperId=${paperId}`);
            }
          }
        }
      } catch (err) {
        console.warn('[AI /chat] Could not fetch PDF for paperId:', paperId, err);
      }
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      }
    }
    const userParts: any[] = [];

    // --- PDF Content Extraction (Token-Efficient Hybrid Strategy) ---
    // Step 1: Try pdf-parse first — completely free, zero AI tokens consumed.
    // Step 2: Only if pdf-parse returns empty (scanned/image PDF), fall back to Gemini inlineData.
    let extractedText = "";
    let hasPdfInline = false;

    if (activeFileData) {
      const pdfBuffer = Buffer.from(activeFileData, 'base64');
      console.log(`[PDF-PARSE] Buffer size: ${pdfBuffer.length} bytes | Source: ${paperId ? `paperId=${paperId}` : 'manual upload'}`);

      try {
        const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;
        const pdfData = await pdfParser(pdfBuffer);
        extractedText = (pdfData.text || "").trim();

        if (extractedText) {
          console.log(`[PDF-PARSE] ✅ SUCCESS — extracted ${extractedText.length} characters (${pdfData.numpages} pages). Using text injection (no vision tokens).`);
        } else {
          console.warn(`[PDF-PARSE] ⚠️  EMPTY — pdf-parse ran without error but returned no text. PDF is likely scanned/image-based or encrypted. Pages: ${pdfData.numpages ?? 'unknown'}.`);
        }
      } catch (pdfErr: any) {
        console.error(`[PDF-PARSE] ❌ FAILED — pdf-parse threw an error. Cause: ${pdfErr?.message}`);
        console.error(`[PDF-PARSE]    Error type : ${pdfErr?.name ?? 'Unknown'}`);
        if (pdfErr?.stack) {
          console.error(`[PDF-PARSE]    Stack      : ${pdfErr.stack.split('\n').slice(0, 4).join(' | ')}`);
        }
      }

      if (extractedText) {
        // pdf-parse succeeded — inject as plain text (token-efficient, no AI vision tokens used)
        userParts.push({
          text:
            `--- BEGIN EXAM PAPER TEXT ---\n` +
            `${extractedText.substring(0, 35000)}\n` +
            `--- END EXAM PAPER TEXT ---\n\n` +
            `RULES:\n` +
            `- The text above IS the exam paper containing the actual questions.\n` +
            `- Answer ONLY from the question text above. Do NOT use general knowledge.\n` +
            `- Before answering any question, reproduce its exact wording as a blockquote (>).\n`
        });
      } else {
        // pdf-parse returned nothing — fall back to Gemini native vision (higher token cost)
        console.warn(`[PDF-PARSE] 🔄 FALLBACK — sending raw PDF bytes to Gemini as inlineData (vision tokens will be used).`);
        userParts.push({
          inlineData: {
            mimeType: activeMimeType || 'application/pdf',
            data: activeFileData,
          },
        });
        hasPdfInline = true;
      }
    } else {
      console.log(`[PDF-PARSE] ⏭️  SKIPPED — no activeFileData available (no paperId PDF fetched and no manual upload).`);
    }
    userParts.push({ text: message });
    contents.push({ role: 'user', parts: userParts });

    const systemInstruction = buildSystemInstruction(userPlan);

    // Try models in order; fall back on quota (429) or model-not-found (404).
    // NOTE: The SDK automatically prepends 'models/' — do NOT include it here.
    // NOTE: gemini-1.5-x models are NOT available on the default v1beta endpoint.
    const modelsToTry = [
      'gemini-2.0-flash',        // primary stable
      'gemini-2.0-flash-lite',   // lightweight fallback
      'gemini-1.5-flash',        // stable legacy
      'gemini-1.5-flash-latest', // latest stable v1.5
    ];
    let response: any = null;
    let lastError: any = null;

    if (ai) {
      for (const model of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model,
            contents,
            config: { systemInstruction },
          });
          break;
        } catch (err: any) {
          lastError = err;
          const body = (() => { try { return JSON.parse(err.message); } catch { return null; } })();
          const code = body?.error?.code ?? err.status;
          console.warn(`[AI] Model "${model}" failed (code=${code})`);
          // Always continue to the next model — let Puter be the final fallback
          continue;
        }
      }
    } else {
      // No Gemini key configured — go straight to Puter fallback
      lastError = new Error('GEMINI_API_KEY not configured');
    }

    let usedPuterFallback = false;
    let puterReplyText: string | null = null;

    if (!response) {
      // All Gemini models exhausted — try Puter.js fallback before giving up
      if (isPuterAvailable()) {

        try {
          const historyForPuter = (history && Array.isArray(history))
            ? history.map((m: any) => ({ role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.content }))
            : [];
          // Puter cannot read binary PDF data. Build the richest context we can:
          // Priority 1: pdf-parse extracted text (full content)
          // Priority 2: Pre-generated paper insights (summary, topics, hardest Q, tips)
          // Priority 3: Paper metadata only (subject, year, semester)
          // Priority 4: Plain message (general knowledge fallback)
          let userMsgForPuter: string;
          if (extractedText) {
            userMsgForPuter =
              `--- BEGIN EXAM PAPER TEXT ---\n` +
              `${extractedText.substring(0, 10000)}\n` +
              `--- END EXAM PAPER TEXT ---\n\n` +
              `RULES:\n` +
              `- The text above IS the exam paper containing the actual questions.\n` +
              `- Answer ONLY from the question text above. Do NOT use general knowledge.\n` +
              `- Before answering any question, reproduce its exact wording as a blockquote (>).\n\n` +
              `Student request: ${message}`;
          } else if (paperInsights) {
            // We have pre-generated AI insights for this paper — use them as context
            const topicsList = Array.isArray(paperInsights.topics)
              ? paperInsights.topics.join(', ')
              : (paperInsights.topics || '');
            const metaLine = [
              paperMeta.subject  ? `Subject: ${paperMeta.subject}` : null,
              paperMeta.year     ? `Year: ${paperMeta.year}`       : null,
              paperMeta.semester ? `Semester: ${paperMeta.semester}` : null,
            ].filter(Boolean).join(' | ');
            userMsgForPuter =
              `[Past Exam Paper — AI Analysis Context]\n` +
              `${metaLine}\n\n` +
              `PAPER SUMMARY:\n${paperInsights.summary || 'N/A'}\n\n` +
              `KEY TOPICS COVERED:\n${topicsList || 'N/A'}\n\n` +
              `DIFFICULTY: ${paperInsights.difficulty || 'N/A'}\n\n` +
              `HARDEST QUESTION & SOLUTION:\n${paperInsights.hardest_question || 'N/A'}\n\n` +
              `EXAM TIPS:\n${paperInsights.exam_tips || 'N/A'}\n\n` +
              `---\n` +
              `Using the above exam paper analysis as your context, please answer the student's question thoroughly. ` +
              `Do NOT say you cannot access the PDF.\n\n` +
              `Student question: ${message}`;
          } else if (Object.keys(paperMeta).length > 0) {
            const metaLines = [
              paperMeta.subject  ? `Subject  : ${paperMeta.subject}`  : null,
              paperMeta.title    ? `Title    : ${paperMeta.title}`    : null,
              paperMeta.year     ? `Year     : ${paperMeta.year}`     : null,
              paperMeta.semester ? `Semester : ${paperMeta.semester}` : null,
            ].filter(Boolean).join('\n');
            userMsgForPuter =
              `[Past Exam Paper — Academic Context]\n` +
              `The student is studying the following past exam paper:\n${metaLines}\n\n` +
              `Please answer the student's question using your academic knowledge of this subject. ` +
              `Do not say you cannot access the PDF — help based on the subject context above.\n\n` +
              `Student question: ${message}`;
          } else {
            userMsgForPuter = message;
          }

          puterReplyText = await askPuter(systemInstruction, historyForPuter, userMsgForPuter);
          usedPuterFallback = true;

          // Reset health — Puter is serving fine even if Gemini is limited
          setAIHealth({ status: 'online', backOnlineAt: null, lastError: null });
        } catch (puterErr: any) {

        }
      }

      if (!usedPuterFallback) {
        // Both Gemini and Puter have failed — set health to limited and surface a quota message

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        setAIHealth({ status: 'limited', backOnlineAt: tomorrow.toISOString(), lastError: lastError?.message });
        throw lastError;
      }
    }

    // ── Extract reply text (from Gemini or Puter fallback) ──────────────────
    let replyText: string;
    if (usedPuterFallback) {
      replyText = puterReplyText ?? 'Sorry, I could not generate a response. Please try again.';
    } else {
      // Reset health to online on Gemini success
      setAIHealth({ status: 'online', backOnlineAt: null, lastError: null });
      // In @google/genai v1, response.text is a getter that THROWS (not returns undefined)
      // when the response has no text content (e.g. blocked, empty candidates).
      try {
        replyText = response.text ?? 'Sorry, I could not generate a response. Please try again.';
      } catch {
        replyText =
          response?.candidates?.[0]?.content?.parts?.[0]?.text
          ?? 'Sorry, I could not generate a response. Please try again.';
      }
    }

    // ── Log the query to Supabase for stats ────────────────────────────────
    supabase.from('upsa_ai_queries').insert({
      user_id: req.user?.id,
      model: usedPuterFallback ? 'puter-gpt-4o' : (response?.model || 'gemini-2.5-flash'),
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

    res.json({ reply: replyText });
  } catch (error: any) {
    // Log safe, non-sensitive warning
    console.error('[AI /chat] Request failed');

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

    res.status(500).json({ error: 'Failed to generate AI response.' });
  }
});

export default router;