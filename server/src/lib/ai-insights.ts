import { GoogleGenAI } from '@google/genai';
import { supabase } from './supabase';
import { getAIHealth, setAIHealth } from './ai-health';
import { askPuter, isPuterAvailable } from './puter';
import { getHFConfig, getHFModelId, defaultHFModels, askHuggingFace } from './huggingface';
import { getAiCompletion } from './ai-helper';
import { performOcrPipeline } from './ocr';
import { logFallbackEvent, getErrorMeaning, FallbackAttempt } from './fallback-logger';

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
    const ai = process.env.GEMINI_API_KEY
      ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1beta' })
      : null;

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
        const ocrRes = await performOcrPipeline(pdfBuffer, numPages);
        if (ocrRes && ocrRes.text.length > 50) {
          extractedText = ocrRes.text;
          console.log(`[AI Insights] OCR succeeded. Extracted length: ${extractedText.length}`);
        }
      } catch (ocrErr: any) {
        console.error(`[AI Insights] OCR pipeline failed during insights generation:`, ocrErr.message);
      }

      // Gemini Vision fallback for text extraction when OCR fails
      if (!extractedText || extractedText.length < 50) {
        const MAX_INLINE_PDF_BYTES = 20 * 1024 * 1024;
        if (pdfBuffer.length <= MAX_INLINE_PDF_BYTES && process.env.GEMINI_API_KEY) {
          try {
            console.log(`[AI Insights] OCR failed. Attempting Gemini Vision text extraction for insights (${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB)...`);
            const geminiExtractAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1beta' });
            const base64Pdf = pdfBuffer.toString('base64');
            const extractModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
            for (const extractModel of extractModels) {
              try {
                const extractResult = await geminiExtractAI.models.generateContent({
                  model: extractModel,
                  contents: [{
                    role: 'user',
                    parts: [
                      { inlineData: { mimeType: 'application/pdf', data: base64Pdf } },
                      { text: 'Extract ALL text from this PDF document exactly as it appears. Include every question, instruction, header, numbering, and sub-question. Output ONLY the raw text content, nothing else. Do not summarize or paraphrase.' }
                    ]
                  }]
                });
                const geminiText = extractResult.text?.trim();
                if (geminiText && geminiText.length > 100) {
                  extractedText = geminiText;
                  console.log(`[AI Insights] Gemini Vision extraction succeeded with ${extractModel}! Length: ${geminiText.length}`);
                  break;
                }
              } catch (geminiModelErr: any) {
                console.warn(`[AI Insights] Gemini Vision extraction failed with ${extractModel}:`, geminiModelErr.message);
              }
            }
          } catch (geminiExtractErr: any) {
            console.warn('[AI Insights] Gemini Vision extraction initialization failed:', geminiExtractErr.message);
          }
        }
      }
    }

    const geminiPrompt = extractedText
      ? `[Extracted Paper Content]\n${extractedText.substring(0, 35000)}\n\n${prompt}`
      : `[PDF content unavailable for paper: "${paperTitle}"]\n\n${prompt}`;

    const insightAttempts: FallbackAttempt[] = [];

    if (ai) {
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
          insightAttempts.push({
            model_or_service: `Gemini (${modelName})`,
            status: 'success'
          });

          break; // Success!
        } catch (err: any) {
          lastError = err;
          let parsed: any = null;
          try { parsed = JSON.parse(err.message); } catch { /* ignore */ }
          const code = parsed?.error?.code ?? err.status;

          if (code === 429) {
            quotaExhausted = true;
          }
          const errInfo = getErrorMeaning(code, err.message);
          insightAttempts.push({
            model_or_service: `Gemini (${modelName})`,
            status: 'failed',
            error_code: errInfo.code,
            error_message: err.message,
            error_meaning: errInfo.meaning
          });
          continue;
        }
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
            insightAttempts.push({
              model_or_service: 'Puter GPT-4o Sandbox',
              status: 'success'
            });

            // Reset health — Puter is serving fine
            setAIHealth({ status: 'online', backOnlineAt: null, lastError: null });
          } else {
            throw new Error('Puter returned an empty response');
          }
        } catch (puterErr: any) {
          const errInfo = getErrorMeaning(puterErr.status || puterErr.code, puterErr.message);
          insightAttempts.push({
            model_or_service: 'Puter GPT-4o Sandbox',
            status: 'failed',
            error_code: errInfo.code,
            error_message: puterErr.message,
            error_meaning: errInfo.meaning
          });
        }
      } else {
        const errMsg = 'Puter is not available (missing PUTER_AUTH_TOKEN)';
        const errInfo = getErrorMeaning('ENOENT', errMsg);
        insightAttempts.push({
          model_or_service: 'Puter GPT-4o Sandbox',
          status: 'failed',
          error_code: errInfo.code,
          error_message: errMsg,
          error_meaning: errInfo.meaning
        });
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
                  insightAttempts.push({
                    model_or_service: `HuggingFace (${modelId})`,
                    status: 'success'
                  });
                  setAIHealth({ status: 'online', backOnlineAt: null, lastError: null });
                  break;
                } else {
                  throw new Error('HuggingFace returned empty response');
                }
              } catch (hfErr: any) {
                console.warn(`[HF Insights] Model "${modelId}" failed:`, hfErr.message);
                const errInfo = getErrorMeaning(hfErr.status || hfErr.code, hfErr.message);
                insightAttempts.push({
                  model_or_service: `HuggingFace (${modelId})`,
                  status: 'failed',
                  error_code: errInfo.code,
                  error_message: hfErr.message,
                  error_meaning: errInfo.meaning
                });
              }
            }
          } else {
            const errMsg = 'HuggingFace config or API Key is missing';
            const errInfo = getErrorMeaning('ENOENT', errMsg);
            insightAttempts.push({
              model_or_service: 'HuggingFace Fallback',
              status: 'failed',
              error_code: errInfo.code,
              error_message: errMsg,
              error_meaning: errInfo.meaning
            });
          }
        } catch (err: any) {
          console.error('[HF Insights] Error in HF fallback:', err.message);
          const errInfo = getErrorMeaning(err.status || err.code, err.message);
          insightAttempts.push({
            model_or_service: 'HuggingFace Fallback',
            status: 'failed',
            error_code: errInfo.code,
            error_message: err.message,
            error_meaning: errInfo.meaning
          });
        }
      }

      if (!responseText) {
        try {
          const fallbackPrompt = `${prompt}\n\n${extractedText ? `Extracted paper content:\n\n${extractedText.substring(0, 15000)}` : `Paper title: "${paperTitle}"`}\n\nReturn ONLY a strictly valid JSON object.`;
          const helperRes = await getAiCompletion('You are an expert academic tutor returning strictly valid JSON.', [], fallbackPrompt);
          if (helperRes) {
            responseText = helperRes;
            setAIHealth({ status: 'online', backOnlineAt: null, lastError: null });
          }
        } catch {
          // Handled below
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

        await logFallbackEvent({
          request_type: 'Insights Generator',
          title: `Static Insights Generation - ${paperTitle}`,
          success: false,
          selected_model_or_service: null,
          attempts: insightAttempts
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

    let finalModelUsed = 'Unknown';
    if (result) {
      finalModelUsed = result.model || 'Gemini';
    } else if (responseText) {
      if (insightAttempts.some(a => a.model_or_service.includes('Puter') && a.status === 'success')) {
        finalModelUsed = 'Puter GPT-4o';
      } else {
        const hfSuccess = insightAttempts.find(a => a.model_or_service.includes('HuggingFace') && a.status === 'success');
        finalModelUsed = hfSuccess ? hfSuccess.model_or_service : 'HuggingFace';
      }
    }

    await logFallbackEvent({
      request_type: 'Insights Generator',
      title: `Static Insights Generation - ${paperTitle}`,
      success: true,
      selected_model_or_service: finalModelUsed,
      attempts: insightAttempts
    });


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

const inFlightInsightPromises = new Map<string, Promise<any>>();

function normalizeDifficultyRating(val: any): 'Beginner' | 'Intermediate' | 'Advanced' {
  const s = String(val || '').toLowerCase();
  if (s.includes('adv') || s.includes('hard')) return 'Advanced';
  if (s.includes('beg') || s.includes('easy')) return 'Beginner';
  return 'Intermediate';
}

function normalizeInsightsPayload(raw: any, paperTitle: string, subjectLabel: string) {
  const summary = typeof raw?.summary === 'string' && raw.summary.trim()
    ? raw.summary.trim()
    : `Study overview and examination analysis for ${paperTitle}${subjectLabel ? ` (${subjectLabel})` : ''}.`;

  let topics: string[] = [];
  if (Array.isArray(raw?.topics)) {
    topics = raw.topics.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 6);
  } else if (typeof raw?.topics === 'string') {
    topics = raw.topics.split(/[\n,;]+/).map((t: string) => t.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean).slice(0, 6);
  }
  if (topics.length === 0) {
    topics = [subjectLabel || paperTitle, 'Core Principles & Applications', 'Problem Solving & Exam Technique'];
  }

  let hardestQuestion = '';
  if (typeof raw?.hardest_question === 'string' && raw.hardest_question.trim()) {
    hardestQuestion = raw.hardest_question.trim();
  } else if (raw?.hardest_question && typeof raw.hardest_question === 'object') {
    const q = raw.hardest_question.question || '';
    const sol = raw.hardest_question.solution || '';
    hardestQuestion = `Question: ${q}\n\nSolution: ${sol}`.trim();
  }
  if (!hardestQuestion) {
    hardestQuestion = `Question: Critically evaluate the core theoretical and applied concepts assessed in ${paperTitle}.\n\nSolution: Break down the key principles covered in ${subjectLabel || paperTitle}, define relevant terms accurately, apply frameworks to practical UPSA case examples, and structure a clear conclusion.`;
  }

  let examTips = '';
  if (Array.isArray(raw?.exam_tips)) {
    examTips = raw.exam_tips.map((t: any, i: number) => `${i + 1}. ${String(t).trim()}`).join('\n');
  } else if (typeof raw?.exam_tips === 'string' && raw.exam_tips.trim()) {
    examTips = raw.exam_tips.trim();
  }
  if (!examTips) {
    examTips = `1. Allocate your time carefully across compulsory and optional sections.\n2. Support theoretical explanations with real-world and academic examples.\n3. Review past exam phrasing in ${subjectLabel || paperTitle} before sitting the paper.`;
  }

  return {
    summary,
    topics,
    hardest_question: hardestQuestion,
    exam_tips: examTips,
    difficulty: normalizeDifficultyRating(raw?.difficulty),
  };
}

/**
 * Ensures AI insights exist for a paper, returning the existing row from `upsa_paper_insights`
 * or generating, storing, and returning new insights on demand using verified questions, PDF text,
 * or course metadata via the multi-provider `getAiCompletion` pipeline.
 */
export async function ensurePaperInsights(paperId: string): Promise<any> {
  // 1. Check DB first
  const { data: existingList } = await supabase
    .from('upsa_paper_insights')
    .select('*')
    .eq('paper_id', paperId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (existingList && existingList.length > 0) {
    return existingList[0];
  }

  // 2. Deduplicate concurrent requests for the same paper
  const existingPromise = inFlightInsightPromises.get(paperId);
  if (existingPromise) {
    return existingPromise;
  }

  const task = (async () => {
    markProcessingStarted(paperId);
    try {
      // Re-check once inside lock
      const { data: recheck } = await supabase
        .from('upsa_paper_insights')
        .select('*')
        .eq('paper_id', paperId)
        .limit(1);
      if (recheck && recheck.length > 0) return recheck[0];

      const { data: paper, error: paperErr } = await supabase
        .from('upsa_papers')
        .select('id, title, year, semester, file_url, questions_verified, upsa_subjects(name, code)')
        .eq('id', paperId)
        .single();

      if (paperErr || !paper) {
        throw new Error('Paper not found.');
      }

      const subjectObj = Array.isArray((paper as any).upsa_subjects)
        ? (paper as any).upsa_subjects[0]
        : (paper as any).upsa_subjects;
      const subjectName = subjectObj?.name || '';
      const subjectCode = subjectObj?.code || '';
      const subjectLabel = [subjectCode, subjectName].filter(Boolean).join(' - ');
      const paperTitle = (paper as any).title || subjectName || 'Past Examination Paper';

      let contextText = '';

      // 3a. Use verified questions if available (fastest & cleanest)
      if ((paper as any).questions_verified) {
        const { data: vQuestions } = await supabase
          .from('upsa_paper_questions')
          .select('question_no, body, marks, sub_parts')
          .eq('paper_id', paperId)
          .order('question_no', { ascending: true });

        if (vQuestions && vQuestions.length > 0) {
          contextText = vQuestions.map((q: any) => {
            const parts = Array.isArray(q.sub_parts)
              ? q.sub_parts.map((sp: any) => `   (${sp.label}) ${sp.text}`).join('\n')
              : '';
            return `Question ${q.question_no}: ${q.body}${parts ? '\n' + parts : ''}`;
          }).join('\n\n');
        }
      }

      // 3b. Otherwise parse selectable text from PDF (fast path, non-blocking fallback if scanned)
      if (!contextText && (paper as any).file_url) {
        try {
          const pdfRes = await fetch((paper as any).file_url);
          if (pdfRes.ok) {
            const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
            const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;
            const pdfData = await pdfParser(pdfBuffer);
            const parsed = (pdfData?.text || '').trim();
            if (parsed.length >= 100) {
              contextText = parsed;
            } else if (pdfBuffer.length <= 15 * 1024 * 1024 && process.env.GEMINI_API_KEY) {
              // Quick Gemini Vision extraction for scanned PDFs
              try {
                const geminiExtractAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1beta' });
                const base64Pdf = pdfBuffer.toString('base64');
                const extractResult = await geminiExtractAI.models.generateContent({
                  model: 'gemini-2.0-flash',
                  contents: [{
                    role: 'user',
                    parts: [
                      { inlineData: { mimeType: 'application/pdf', data: base64Pdf } },
                      { text: 'Extract the exam questions from this PDF as plain text. Output only raw extracted text.' }
                    ]
                  }]
                });
                const gText = extractResult.text?.trim();
                if (gText && gText.length >= 60) {
                  contextText = gText;
                }
              } catch {
                // Continue with metadata context if vision extraction fails
              }
            }
          }
        } catch (fetchErr: any) {
          console.warn('[ensurePaperInsights] PDF text extraction skipped:', fetchErr?.message);
        }
      }

      const systemInstruction = 'You are an expert university academic tutor. Return ONLY a strictly valid JSON object with no markdown fences or extra commentary.';
      const userPrompt = `
Analyze the university past paper below and produce structured study insights for students.

Course Metadata:
- Title: "${paperTitle}"
- Subject: "${subjectLabel || 'University Course'}"
- Year / Semester: ${(paper as any).year || 'N/A'} / ${(paper as any).semester || 'N/A'}

${contextText ? `Extracted Paper Content:\n${contextText.substring(0, 18000)}\n` : 'Note: Base your academic insights on the specific course title, course code, and curriculum topics listed above.'}

Return strictly valid JSON with these exact keys:
{
  "summary": "A concise 2-3 sentence executive summary of what this paper assesses and its main themes.",
  "topics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4"],
  "hardest_question": "Question: ...\\n\\nSolution: ...",
  "exam_tips": "1. ...\\n2. ...\\n3. ...",
  "difficulty": "Beginner" | "Intermediate" | "Advanced"
}
      `.trim();

      const rawResponse = await getAiCompletion(systemInstruction, [], userPrompt);

      let jsonStr = rawResponse.trim().replace(/```json|```/g, '').trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];

      const parsedJson = JSON.parse(jsonStr);
      const normalized = normalizeInsightsPayload(parsedJson, paperTitle, subjectLabel);

      const { data: insertedRow, error: insertErr } = await supabase
        .from('upsa_paper_insights')
        .insert({
          paper_id: paperId,
          ...normalized,
        })
        .select('*')
        .single();

      if (insertErr) {
        console.warn('[ensurePaperInsights] DB insert warning:', insertErr.message);
        return { paper_id: paperId, ...normalized };
      }

      return insertedRow;
    } finally {
      markProcessingDone(paperId);
      inFlightInsightPromises.delete(paperId);
    }
  })();

  inFlightInsightPromises.set(paperId, task);
  return task;
}