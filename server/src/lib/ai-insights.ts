import { GoogleGenAI } from '@google/genai';
import { supabase } from './supabase';
import { getAIHealth, setAIHealth } from './ai-health';
import { askPuter, isPuterAvailable } from './puter';
const pdf = require('pdf-parse');

// ── In-memory processing tracker ────────────────────────────────────────────
// Maps paperId → ISO timestamp of when processing started
const processingMap = new Map<string, string>();

export const getProcessingState = (): Record<string, string> => {
  return Object.fromEntries(processingMap.entries());
};

export const markProcessingStarted = (paperId: string) => {
  processingMap.set(paperId, new Date().toISOString());
};

export const markProcessingDone = (paperId: string) => {
  processingMap.delete(paperId);
};

export const isProcessing = (paperId: string) => processingMap.has(paperId);
// ────────────────────────────────────────────────────────────────────────────

export async function generatePaperInsights(paperId: string, pdfBuffer: Buffer, paperTitle: string) {
  // Prevent duplicate concurrent runs for the same paper
  if (isProcessing(paperId)) {
    console.log(`[AI Insights] Already processing paperId=${paperId}, skipping.`);
    return;
  }

  // ── Circuit breaker: don't even try if quota is known-exhausted ──────────
  const health = getAIHealth();
  if (health.status === 'limited') {
    console.warn(`[AI Insights] Skipping "${paperTitle}" — AI quota is limited until ${health.backOnlineAt}`);
    return;
  }

  markProcessingStarted(paperId);

  try {
    console.log(`[AI Insights] Starting for: ${paperTitle} (id=${paperId})`);
    if (!process.env.GEMINI_API_KEY) {
      console.error('[AI Insights] GEMINI_API_KEY missing');
      markProcessingDone(paperId);
      return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `
      You are an expert academic tutor. Analyze this past paper PDF ("${paperTitle}") and provide the following insights for students:
      1. A concise executive summary of the paper (what it tests, the general theme).
      2. A list of 3-5 key topics covered.
      3. Identify the single most difficult or complex question in the paper. Provide the question text and a clear, step-by-step solution.
      4. 3 specific exam tips for this paper.
      5. An overall difficulty rating (Beginner, Intermediate, or Advanced).

      Return your response in strictly valid JSON format with these keys:
      {
        "summary": "...",
        "topics": ["topic1", "topic2", ...],
        "hardest_question": "Question: ... \\n\\nSolution: ...",
        "exam_tips": "1. ... \\n2. ... \\n3. ...",
        "difficulty": "..."
      }
    `.trim();

    // Model list: primary first, followed by stable flash versions
    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
    ];

    let result = null;
    let lastError = null;
    let quotaExhausted = false;
    let responseText: string | null = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`[AI Insights] Trying model: ${modelName}`);
        console.log(`[AI Insights] PDF buffer size: ${pdfBuffer?.length || 0} bytes`);
        
        // 60-second timeout per model
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI Request Timeout')), 60000)
        );

        const aiPromise = ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: pdfBuffer.toString('base64'),
                    mimeType: 'application/pdf',
                  },
                },
                { text: prompt },
              ],
            },
          ],
        });

        const res: any = await Promise.race([aiPromise, timeoutPromise]);
        result = res;
        console.log(`[AI Insights] Model ${modelName} succeeded.`);
        break; // Success!
      } catch (err: any) {
        lastError = err;
        let parsed: any = null;
        try { parsed = JSON.parse(err.message); } catch { /* ignore */ }
        const code = parsed?.error?.code ?? err.status;

        if (code === 429) {
          console.warn(`[AI Insights] Quota exceeded for ${modelName}. Trying next fallback...`);
          // Note: we no longer break here. We will try 1.5-flash just in case it works.
          quotaExhausted = true;
          continue;
        }
        if (code === 404) {
          console.warn(`[AI Insights] Model not found: ${modelName}. Trying next fallback...`);
          continue;
        }
        if (err.message === 'AI Request Timeout') {
          console.warn(`[AI Insights] Timeout for ${modelName}. Trying next fallback...`);
          continue;
        }
        console.error(`[AI Insights] Model ${modelName} failed:`, err.message);
        break;
      }
    }

    if (!result) {
      if (quotaExhausted) {
        console.warn(`[AI Insights] Gemini quota exhausted for all models. Checking Puter.js...`);
      }

      // ── Puter.js Fallback for Insights ──────────────────────────────────
      if (isPuterAvailable()) {
        console.log(`[AI Insights] Attempting Puter.js fallback for paper: "${paperTitle}"`);
        try {
          // Extract text from PDF for Puter (since Puter doesn't handle buffers natively)
          let extractedText = "";
          try {
            console.log(`[AI Insights] Extracting text from PDF buffer (${pdfBuffer.length} bytes)...`);
            // Handle different export styles of pdf-parse
            const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;
            const pdfData = await pdfParser(pdfBuffer);
            extractedText = pdfData.text || "";
            console.log(`[AI Insights] Successfully extracted ${extractedText.length} characters of text.`);
          } catch (pdfErr: any) {
            console.warn(`[AI Insights] PDF text extraction failed: ${pdfErr.message}. Falling back to title-only analysis.`);
          }

          const puterPrompt = `
            ${prompt}
            
            ${extractedText ? `Here is the extracted text content of the paper for your analysis:\n\n${extractedText.substring(0, 15000)}\n\n` : `IMPORTANT: The PDF content is currently unavailable for this fallback.`}
            
            Please provide your BEST academic expert analysis based on the ${extractedText ? 'extracted text above' : `paper title: "${paperTitle}"`}.
            Return ONLY the JSON object. Do not include markdown code blocks.
          `.trim();
          
          const puterResponse = await askPuter(
            "You are an expert academic tutor providing structured paper analysis.",
            [],
            puterPrompt
          );
          
          if (puterResponse) {
            responseText = puterResponse;
            console.log(`[AI Insights] Puter.js fallback succeeded for paper: "${paperTitle}"`);
            // Reset health — Puter is serving fine
            setAIHealth({ status: 'online', backOnlineAt: null, lastError: null });
          }
        } catch (puterErr: any) {
          console.error(`[AI Insights] Puter.js fallback also failed:`, puterErr.message);
        }
      }

      if (!responseText) {
        // BOTH Gemini and Puter failed — activate circuit breaker
        if (quotaExhausted) {
          console.error('[AI Insights] All providers exhausted — activating circuit breaker for 10m.');
          setAIHealth({
            status: 'limited',
            backOnlineAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            lastError: 'All AI providers (Gemini + Puter) quota exhausted',
          });
          await supabase.from('upsa_admin_notifications').insert({
            title: '🔴 AI Quota Exhausted',
            message: `Analysis for "${paperTitle}" blocked — Both Gemini and Puter fallbacks are currently unavailable. Cooldown: 10 minutes.`,
            is_read: false,
          });
        }
        markProcessingDone(paperId);
        return;
      }
    } else {
      // ── Gemini success: Reset health to online ─────────────────────────────
      setAIHealth({ status: 'online', backOnlineAt: null, lastError: null });
      try {
        responseText = result.text ?? '';
      } catch {
        responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      }
    }

    if (!responseText) {
      console.error('[AI Insights] responseText is null, skipping extraction.');
      markProcessingDone(paperId);
      return;
    }

    console.log(`[AI Insights] Got response (length: ${responseText.length})`);

    // Robust JSON extraction
    let jsonStr = '';
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      // Remove any markdown formatting if present
      jsonStr = jsonStr.replace(/```json|```/g, '').trim();
    } catch (extractErr) {
      console.error('[AI Insights] Regex extraction failed, using raw response.');
      jsonStr = responseText.trim();
    }
    
    let insights;
    try {
      insights = JSON.parse(jsonStr);
    } catch (parseErr: any) {
      console.error('[AI Insights] JSON Parse Error:', parseErr.message);
      console.error('[AI Insights] Failed JSON String:', jsonStr.substring(0, 500) + '...');
      
      await supabase.from('upsa_admin_notifications').insert({
        title: '⚠️ AI Analysis Failed',
        message: `Could not parse AI response for paper: "${paperTitle}". Technical error: ${parseErr.message}`,
        is_read: false
      });
      markProcessingDone(paperId);
      return;
    }

    const { error } = await supabase
      .from('upsa_paper_insights')
      .insert({
        paper_id: paperId,
        summary: insights.summary,
        topics: insights.topics,
        hardest_question: insights.hardest_question,
        exam_tips: insights.exam_tips,
        difficulty: insights.difficulty,
      });

    if (error) {
      console.error(`[AI Insights] ❌ Database error saving insights for "${paperTitle}":`, error.message);
      await supabase.from('upsa_admin_notifications').insert({
        title: '⚠️ Database Error',
        message: `Failed to save insights for paper: "${paperTitle}". ${error.message}`,
        is_read: false
      });
    } else {
      console.log('────────────────────────────────────────────────────────────');
      console.log(`[AI Insights] ✅ SUCCESS: Insights for "${paperTitle}" are now PERMANENTLY saved in the database.`);
      console.log(`[AI Insights] ℹ️  All future students who view this paper will now see these answers instantly.`);
      console.log('────────────────────────────────────────────────────────────');
      
      await supabase.from('upsa_admin_notifications').insert({
        title: '✅ AI Insights Ready',
        message: `AI Analysis is complete for "${paperTitle}". Student insights are now live and cached for everyone.`,
        is_read: false
      });
    }
  } catch (err: any) {
    console.error('[AI Insights] Unexpected error:', err?.message || err);
    await supabase.from('upsa_admin_notifications').insert({
      title: '❌ Unexpected AI Error',
      message: `A critical error occurred while analyzing "${paperTitle}". Please check server logs.`,
      is_read: false
    });
  } finally {
    markProcessingDone(paperId);
  }
}
