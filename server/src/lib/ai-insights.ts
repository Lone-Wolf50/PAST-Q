import { GoogleGenAI } from '@google/genai';
import { supabase } from './supabase';
import { getAIHealth, setAIHealth } from './ai-health';
import { askPuter, isPuterAvailable } from './puter';
import { getHFConfig, getHFModelId, defaultHFModels, askHuggingFace } from './huggingface';
import { performOcrPipeline } from './ocr';
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

    return;
  }

  // ── Circuit breaker: don't even try if quota is known-exhausted ──────────
  const health = getAIHealth();
  if (health.status === 'limited') {

    return;
  }

  markProcessingStarted(paperId);

  try {

    if (!process.env.GEMINI_API_KEY) {

      markProcessingDone(paperId);
      return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1' });

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

    // ── Global PDF Extraction ───────────────────────────────────────────────
    let extractedText = "";
    let numPages = 1;
    let extractionFailed = false;

    try {
      const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;
      const pdfData = await pdfParser(pdfBuffer);
      extractedText = (pdfData.text || "").trim();
      numPages = pdfData.numpages || 1;
      console.log(`[AI Insights] Parsed PDF. Pages: ${numPages}, Selectable text length: ${extractedText.length}`);
    } catch (pdfErr: any) {
      console.error(`[AI Insights] Failed to parse PDF:`, pdfErr.message);
      extractionFailed = true;
    }

    // Handle scanned/hybrid PDFs during background insights extraction as well!
    const avgCharsPerPage = numPages > 0 ? extractedText.length / numPages : 0;
    const isHybridOrScanned = extractedText.length < 50 || avgCharsPerPage < 250;

    if (isHybridOrScanned || extractionFailed) {
      console.log(`[AI Insights] Scanned/Hybrid PDF detected (Average chars per page: ${avgCharsPerPage.toFixed(1)}). Triggering OCR...`);
      try {
        const ocrText = await performOcrPipeline(pdfBuffer, numPages);
        if (ocrText && ocrText.length > 50) {
          extractedText = ocrText;
          console.log(`[AI Insights] OCR succeeded. Extracted length: ${extractedText.length}`);
        }
      } catch (ocrErr: any) {
        console.error(`[AI Insights] OCR pipeline failed during insights generation:`, ocrErr.message);
      }
    }

    const geminiPrompt = extractedText
      ? `[Extracted Paper Content]\n${extractedText.substring(0, 35000)}\n\n${prompt}`
      : `[PDF content unavailable for paper: "${paperTitle}"]\n\n${prompt}`;

    for (const modelName of modelsToTry) {
      try {

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
                { text: geminiPrompt },
              ],
            },
          ],
        });

        const res: any = await Promise.race([aiPromise, timeoutPromise]);
        result = res;

        break; // Success!
      } catch (err: any) {
        lastError = err;
        let parsed: any = null;
        try { parsed = JSON.parse(err.message); } catch { /* ignore */ }
        const code = parsed?.error?.code ?? err.status;

        if (code === 429) {
          // Note: we no longer break here. We will try fallback models just in case.
          quotaExhausted = true;
        }
        // Silently fall back to the next model for any error
        continue;
      }
    }

    if (!result) {
      if (quotaExhausted) {

      }

      // ── Puter.js Fallback for Insights ──────────────────────────────────
      if (isPuterAvailable()) {

        try {
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

            // Reset health — Puter is serving fine
            setAIHealth({ status: 'online', backOnlineAt: null, lastError: null });
          }
        } catch (puterErr: any) {

        }
      }

      // ── Hugging Face Fallback for Insights ──────────────────────────────
      if (!responseText) {
        try {
          const hfConfig = await getHFConfig();
          if (hfConfig && hfConfig.apiKey) {
            const hfModels = hfConfig.modelNames.length > 0 ? hfConfig.modelNames : defaultHFModels;
            const hfPrompt = `
              ${prompt}
              
              ${extractedText ? `Here is the extracted text content of the paper for your analysis:\n\n${extractedText.substring(0, 15000)}\n\n` : `IMPORTANT: The PDF content is currently unavailable for this fallback.`}
              
              Please provide your BEST academic expert analysis based on the ${extractedText ? 'extracted text above' : `paper title: "${paperTitle}"`}.
              Return ONLY the JSON object. Do not include markdown code blocks.
            `.trim();

            for (const rawModel of hfModels) {
              const modelId = getHFModelId(rawModel);
              try {
                const hfResponse = await askHuggingFace(
                  modelId,
                  hfConfig.apiKey,
                  "You are an expert academic tutor providing structured paper analysis.",
                  [],
                  hfPrompt
                );

                if (hfResponse) {
                  responseText = hfResponse;
                  setAIHealth({ status: 'online', backOnlineAt: null, lastError: null });
                  break;
                }
              } catch (hfErr: any) {
                console.warn(`[HF Insights] Model "${modelId}" failed:`, hfErr.message);
              }
            }
          }
        } catch (err: any) {
          console.error('[HF Insights] Error in HF fallback:', err.message);
        }
      }

      if (!responseText) {
        // Gemini, Puter, and Hugging Face all failed
        setAIHealth({
          status: 'limited',
          backOnlineAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          lastError: 'All AI providers (Gemini, Puter, Hugging Face) failed',
        });
        await supabase.from('upsa_admin_notifications').insert({
          title: '🔴 AI Quota Exhausted',
          message: `Analysis for "${paperTitle}" blocked — Gemini, Puter, and Hugging Face are all currently unavailable. Cooldown: 10 minutes.`,
          is_read: false,
        });
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

      markProcessingDone(paperId);
      return;
    }

    // Robust JSON extraction
    let jsonStr = '';
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      // Remove any markdown formatting if present
      jsonStr = jsonStr.replace(/```json|```/g, '').trim();
    } catch (extractErr) {

      jsonStr = responseText.trim();
    }

    let insights;
    try {
      insights = JSON.parse(jsonStr);
    } catch (parseErr: any) {


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

      await supabase.from('upsa_admin_notifications').insert({
        title: '⚠️ Database Error',
        message: `Failed to save insights for paper: "${paperTitle}". ${error.message}`,
        is_read: false
      });
    } else {




      await supabase.from('upsa_admin_notifications').insert({
        title: '✅ AI Insights Ready',
        message: `AI Analysis is complete for "${paperTitle}". Student insights are now live and cached for everyone.`,
        is_read: false
      });
    }
  } catch (err: any) {

    await supabase.from('upsa_admin_notifications').insert({
      title: '❌ Unexpected AI Error',
      message: `A critical error occurred while analyzing "${paperTitle}". Please check server logs.`,
      is_read: false
    });
  } finally {
    markProcessingDone(paperId);
  }
}