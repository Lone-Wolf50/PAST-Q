import { GoogleGenAI } from '@google/genai';
import { supabase } from './supabase';
import { askPuter, isPuterAvailable } from './puter';
import { getHFConfig, getHFModelId, defaultHFModels, askHuggingFace } from './huggingface';

export interface GeneratedQuestion {
  body: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  correct_answer: string;
  options: string[];
  time_limit_seconds: number;
}

/**
 * Generates a unique, practical question using the fallback hierarchy:
 * 1. Google Gemini AI (primary)
 * 2. Hugging Face (fallback)
 * 3. Puter.js (second fallback)
 */
export async function generateQuestion(selectedSubjectName?: string): Promise<GeneratedQuestion> {
  // 1. Fetch a random paper insight
  let insightData: any = null;
  let subjectName = selectedSubjectName || 'General Academics';

  try {
    let query = supabase
      .from('upsa_paper_insights')
      .select('*, upsa_papers!inner(*, upsa_subjects!inner(name))');

    if (selectedSubjectName) {
      query = query.eq('upsa_papers.upsa_subjects.name', selectedSubjectName);
    }

    const { data: insights, error: insightsErr } = await query;

    if (!insightsErr && insights && insights.length > 0) {
      // Pick random
      const randomInsight = insights[Math.floor(Math.random() * insights.length)];
      insightData = randomInsight;
      subjectName = randomInsight.upsa_papers?.upsa_subjects?.name || subjectName;
    } else if (!selectedSubjectName) {
      // Fallback: Pick a random subject name from upsa_subjects only if no subject was specified
      const { data: subjects } = await supabase.from('upsa_subjects').select('name');
      if (subjects && subjects.length > 0) {
        subjectName = subjects[Math.floor(Math.random() * subjects.length)].name;
      }
    }
  } catch (err) {
    console.error('⚠️ [Question Generator] Failed to fetch database data:', err);
  }

  // 2. Formulate prompt
  const systemPrompt = `You are an expert academic examiner. You output strictly valid JSON conforming to the requested schema.`;
  const userPrompt = `
    Based on the subject "${subjectName}"${insightData ? ` and these paper insights:
    - Topics: ${JSON.stringify(insightData.topics)}
    - Summary: ${insightData.summary}
    - Hardest Question details: ${insightData.hardest_question}` : ''},
    
    Generate a single, unique, practical multiple-choice question (MCQ) that requires deep thinking and scenario analysis (increasing the time the student needs to solve it).
    
    Return your response in strictly valid JSON format with these exact keys:
    {
      "body": "A clear, descriptive, and analytical scenario-based question.",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A", // Must match one of the strings in the options array EXACTLY.
      "difficulty": "Medium", // Must be "Easy", "Medium", or "Hard".
      "time_limit_seconds": 60 // Must be 30, 45, 60, or 90. Give more time (e.g. 60 or 90) for analytical questions.
    }
    
    Do not include markdown backticks or any other text outside the JSON object.
  `.trim();

  let responseText: string | null = null;
  let errorMsg = '';

  // ─── 1. Primary: Google Gemini ───
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log('📡 [Question Gen] Attempting primary model: Gemini...');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1beta' });
      const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
      let geminiRes: any = null;

      for (const m of models) {
        try {
          geminiRes = await ai.models.generateContent({
            model: m,
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          });
          break;
        } catch {
          continue;
        }
      }

      if (geminiRes) {
        try {
          responseText = geminiRes.text ?? '';
        } catch {
          responseText = geminiRes?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Question Gen] Gemini failed:', err.message);
      errorMsg += `Gemini: ${err.message}. `;
    }
  }

  // ─── 2. Fallback: Hugging Face ───
  if (!responseText) {
    try {
      console.log('📡 [Question Gen] Gemini failed or key missing. Attempting Hugging Face...');
      const hfConfig = await getHFConfig();
      if (hfConfig && hfConfig.apiKey) {
        const models = hfConfig.modelNames.length > 0 ? hfConfig.modelNames : defaultHFModels;
        for (const rawModel of models) {
          const modelId = getHFModelId(rawModel);
          try {
            const hfRes = await askHuggingFace(
              modelId,
              hfConfig.apiKey,
              systemPrompt,
              [],
              userPrompt
            );
            if (hfRes) {
              responseText = hfRes;
              console.log(`✅ [Question Gen] Hugging Face success with model: ${modelId}`);
              break;
            }
          } catch (err: any) {
            console.warn(`⚠️ [Question Gen] Hugging Face model ${modelId} failed:`, err.message);
          }
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Question Gen] Hugging Face overall failed:', err.message);
      errorMsg += `HuggingFace: ${err.message}. `;
    }
  }

  // ─── 3. Second Fallback: Puter.js ───
  if (!responseText && isPuterAvailable()) {
    try {
      console.log('📡 [Question Gen] Hugging Face failed or missing. Attempting Puter...');
      const puterRes = await askPuter(
        systemPrompt,
        [],
        userPrompt
      );
      if (puterRes) {
        responseText = puterRes;
        console.log('✅ [Question Gen] Puter AI success.');
      }
    } catch (err: any) {
      console.warn('⚠️ [Question Gen] Puter failed:', err.message);
      errorMsg += `Puter: ${err.message}. `;
    }
  }

  // Handle absolute failure
  if (!responseText) {
    throw new Error(`[Question Gen] All AI backends failed to generate a question. Errors: ${errorMsg}`);
  }

  // Robust parsing of response JSON
  try {
    let jsonStr = responseText.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    jsonStr = jsonStr.replace(/```json|```/g, '').trim();

    const parsed: any = JSON.parse(jsonStr);

    // Validate structure
    if (!parsed.body || !Array.isArray(parsed.options) || parsed.options.length < 2 || !parsed.correct_answer) {
      throw new Error('Invalid JSON structure returned by AI');
    }

    // Ensure correct answer is strictly inside options
    if (!parsed.options.includes(parsed.correct_answer)) {
      parsed.options.push(parsed.correct_answer);
    }

    return {
      body: parsed.body,
      category: subjectName,
      difficulty: parsed.difficulty || 'Medium',
      correct_answer: parsed.correct_answer,
      options: parsed.options,
      time_limit_seconds: parsed.time_limit_seconds || 60,
    };
  } catch (parseErr: any) {
    console.error('❌ [Question Gen] Failed to parse generated JSON:', responseText);
    throw new Error(`[Question Gen] AI response JSON parsing failed: ${parseErr.message}`);
  }
}
