import { getHFConfig, getHFModelId, defaultHFModels, askHuggingFace } from './huggingface';
import { askPuter, isPuterAvailable } from './puter';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Shared AI completion helper — chains HuggingFace → Puter.
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
    const hfConfig = await getHFConfig();
    if (hfConfig && hfConfig.apiKey) {
      const hfModels = hfConfig.modelNames.length > 0 ? hfConfig.modelNames : defaultHFModels;
      for (const rawModel of hfModels) {
        const modelId = getHFModelId(rawModel);
        try {
          const reply = await askHuggingFace(modelId, hfConfig.apiKey, systemInstruction, history, userMessage);
          return reply;
        } catch (err: any) {
          lastError = err;
          console.warn(`[ai-helper] HF model ${modelId} failed:`, err.message);
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

  throw lastError ?? new Error('All AI providers failed.');
}
