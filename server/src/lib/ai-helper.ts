import { GoogleGenAI } from '@google/genai';
import { getHFConfigs, getHFModelId, defaultHFModels, askHuggingFace } from './huggingface';
import { askPuter, isPuterAvailable } from './puter';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Shared AI completion helper — chains HuggingFace → Puter → Gemini.
 * Returns the AI reply string or throws if all providers fail.
 */
export async function getAiCompletion(
  systemInstruction: string,
  history: AiMessage[],
  userMessage: string
): Promise<string> {
  let lastError: any = null;

  // ── Step 1: HuggingFace (primary) ──────────────────────────────────────
  try {
    const hfConfigs = await getHFConfigs();
    for (const config of hfConfigs) {
      if (config.apiKey) {
        const hfModels = config.modelNames.length > 0 ? config.modelNames : defaultHFModels;
        for (const rawModel of hfModels) {
          const modelId = getHFModelId(rawModel);
          try {
            const reply = await askHuggingFace(modelId, config.apiKey, systemInstruction, history, userMessage);
            return reply;
          } catch (err: any) {
            lastError = err;
            console.warn(`[ai-helper] HF key ending in ...${config.apiKey.slice(-5)} model ${modelId} failed:`, err.message);
            // If key has no credits (402) or invalid auth (401), skip remaining models for this key
            if (err.message?.includes('402') || err.message?.includes('401')) {
              break;
            }
          }
        }
      }
    }
  } catch (err: any) {
    lastError = err;
    console.warn('[ai-helper] HuggingFace init error:', err.message);
  }

  // ── Step 2: Puter (fallback) ────────────────────────────────────────────
  if (isPuterAvailable()) {
    try {
      const reply = await askPuter(systemInstruction, history, userMessage);
      return reply;
    } catch (err: any) {
      lastError = err;
      console.warn('[ai-helper] Puter fallback failed:', err.message);
    }
  }

  // ── Step 3: Gemini (last resort) ────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey, apiVersion: 'v1beta' });
      const contents = [
        ...history.map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        })),
        { role: 'user', parts: [{ text: userMessage }] },
      ];
      const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
      for (const model of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
            config: { systemInstruction },
          });
          if (response?.text) {
            return response.text;
          }
        } catch (geminiErr: any) {
          lastError = geminiErr;
          console.warn(`[ai-helper] Gemini model ${model} failed:`, geminiErr.message);
        }
      }
    } catch (err: any) {
      lastError = err;
      console.warn('[ai-helper] Gemini init error:', err.message);
    }
  }

  throw lastError ?? new Error('All AI providers failed.');
}
