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

    // 2. Prepare the payload for Gemini
    let activeFileData = fileData;
    let activeMimeType = fileMimeType || 'application/pdf';
    let paperMeta: { title?: string; subject?: string; year?: string; semester?: string } = {};
    let paperInsights: any = null;

    if (!activeFileData && paperId) {
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

    let extractedText = "";
    if (activeFileData) {
      const pdfBuffer = Buffer.from(activeFileData, 'base64');
      try {
        const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;
        const pdfData = await pdfParser(pdfBuffer);
        extractedText = (pdfData.text || "").trim();
      } catch (pdfErr) {
        console.error(`[PDF-PARSE] FAILED`);
      }

      if (extractedText) {
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
        userParts.push({
          inlineData: {
            mimeType: activeMimeType || 'application/pdf',
            data: activeFileData,
          },
        });
      }
    }
    userParts.push({ text: message });
    contents.push({ role: 'user', parts: userParts });

    const systemInstruction = buildSystemInstruction(userPlan);
    const modelsToTry = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
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
          continue;
        }
      }
    } else {
      lastError = new Error('GEMINI_API_KEY not configured');
    }

    let usedPuterFallback = false;
    let puterReplyText: string | null = null;
    const historyForPuter = (history && Array.isArray(history))
      ? history.map((m: any) => ({ role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.content }))
      : [];

    let fallbackUserMessage = message;
    if (extractedText) {
      fallbackUserMessage = `--- BEGIN EXAM PAPER TEXT ---\n${extractedText.substring(0, 10000)}\n--- END EXAM PAPER TEXT ---\n\nRULES:\n- The text above IS the exam paper containing the actual questions.\n- Answer ONLY from the question text above. Do NOT use general knowledge.\n- Before answering any question, reproduce its exact wording as a blockquote (>).\n\nStudent request: ${message}`;
    } else if (paperInsights) {
      const metaLine = [
        paperMeta.subject ? `Subject: ${paperMeta.subject}` : null,
        paperMeta.year ? `Year: ${paperMeta.year}` : null,
        paperMeta.semester ? `Semester: ${paperMeta.semester}` : null,
      ].filter(Boolean).join(' | ');
      
      const topicsList = Array.isArray(paperInsights.topics)
        ? paperInsights.topics.join(', ')
        : (paperInsights.topics || 'N/A');

      fallbackUserMessage = 
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
        paperMeta.subject  ? `Subject  : ${paperMeta.subject}`  : null,
        paperMeta.title    ? `Title    : ${paperMeta.title}`    : null,
        paperMeta.year     ? `Year     : ${paperMeta.year}`     : null,
        paperMeta.semester ? `Semester : ${paperMeta.semester}` : null,
      ].filter(Boolean).join('\n');
      fallbackUserMessage =
        `[Past Exam Paper — Subject Context]\n` +
        `The student is studying the following past exam paper:\n${metaLines}\n\n` +
        `Student question: ${message}`;
    }

    // ─── Scanned PDF Check for Fallback ──────────────────────────────────────
    const isScannedPdfNoInsights = !!activeFileData && (!extractedText || extractedText.trim().length < 50) && !paperInsights;

    if (!response && isScannedPdfNoInsights) {
      console.log('[AI /chat] Gemini failed and scanned PDF with no insights detected. Direct fallback response.');
      const scannedPdfMsg = `
### ⚠️ Scanned PDF Detected (Fallback Mode)

Our primary AI model (Gemini), which has the ability to "see" and read scanned PDFs or images, is currently offline.

We have successfully connected to our secondary AI backup. However, because this PDF is a scanned image containing no selectable text, we cannot extract or read its contents in this text-only backup mode.

**To continue studying right now, you can:**

- **Copy & Paste**: Extract the text of the question you want help with and paste it directly into the chat.
- **Type Manually**: Type the question or problem directly into your message.
- **Check Back Later**: Try again in a little while once our primary visual AI systems are fully restored!
      `.trim();

      supabase.from('upsa_ai_queries').insert({
        user_id: req.user?.id,
        model: 'scanned-pdf-fallback',
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        has_file: true
      }).then(({ error }) => {
        if (error) { }
      });

      const plan = (userPlan || 'free').toLowerCase();
      if (conversationId && historyPlans.has(plan)) {
        (async () => {
          try {
            await supabase.from('upsa_ai_messages').insert([
              { conversation_id: conversationId, role: 'user', content: message },
              { conversation_id: conversationId, role: 'assistant', content: scannedPdfMsg },
            ]);
            await supabase
              .from('upsa_ai_conversations')
              .update({ last_message_at: new Date().toISOString() })
              .eq('id', conversationId)
              .eq('user_id', req.user?.id);
          } catch (saveErr) { }
        })();
      }

      return res.json({ reply: scannedPdfMsg });
    }

    if (!response) {
      console.log('[AI /chat] Gemini failed or not configured. Attempting Puter fallback...');
      if (isPuterAvailable()) {
        try {
          puterReplyText = await askPuter(systemInstruction, historyForPuter, fallbackUserMessage);
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

    let usedHFFallback = false;
    let hfReplyText: string | null = null;
    let hfUsedModel: string | null = null;

    if (!response && !usedPuterFallback) {
      console.log('[AI /chat] Puter failed or not available. Attempting Hugging Face fallback...');
      try {
        const hfConfig = await getHFConfig();
        console.log('[AI /chat] HF config fetched:', hfConfig ? 'Successfully' : 'Failed (returned null)');
        if (hfConfig && hfConfig.apiKey) {
          const hfModels = hfConfig.modelNames.length > 0 ? hfConfig.modelNames : defaultHFModels;
          console.log('[AI /chat] HF Models to try:', hfModels);

          for (const rawModel of hfModels) {
            const modelId = getHFModelId(rawModel);
            console.log(`[AI /chat] Trying HF model: ${modelId}`);
            try {
              hfReplyText = await askHuggingFace(modelId, hfConfig.apiKey, systemInstruction, historyForPuter, fallbackUserMessage);
              usedHFFallback = true;
              hfUsedModel = modelId;
              console.log(`[AI /chat] HF model ${modelId} succeeded!`);
              break;
            } catch (hfErr: any) {
              console.error(`[AI /chat] HF model ${modelId} failed:`, hfErr.message);
              lastError = hfErr;
            }
          }
        } else {
          console.warn('[AI /chat] Hugging Face config or API Key is missing in Supabase.');
        }
      } catch (err: any) {
        console.error('[AI /chat] Hugging Face fallback initialization failed:', err.message);
        lastError = err;
      }
    }

    if (!response && !usedPuterFallback && !usedHFFallback) {
      setAIHealth({ status: 'limited', backOnlineAt: new Date(Date.now() + 86400000).toISOString(), lastError: lastError?.message || 'All AI Fallbacks Failed' });
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
    if (response) {
      try {
        replyText = response.text ?? 'Sorry, I could not generate a response.';
      } catch {
        replyText = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sorry, I could not generate a response.';
      }
      modelUsed = response?.model || 'gemini-2.0-flash';
    } else if (usedPuterFallback) {
      replyText = puterReplyText ?? 'Sorry, I could not generate a response.';
      modelUsed = 'puter-gpt-4o';
    } else {
      replyText = hfReplyText ?? 'Sorry, I could not generate a response.';
      modelUsed = hfUsedModel || 'huggingface-fallback';
    }

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

    res.status(500).json({ error: 'Failed to generate AI response.' });
  }
});

export default router;