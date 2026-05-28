import { supabase } from './supabase';

export interface HFConfig {
  apiKey: string;
  modelNames: string[];
}

/**
 * Fetches Hugging Face API key and model names dynamically from Supabase.
 * Looks for environment variables:
 * - HF_TABLE_NAME
 * - HF_KEY_COLUMN
 * - HF_MODEL_COLUMN
 * If not set, returns null.
 */
export async function getHFConfig(): Promise<HFConfig | null> {
  // Fall back to known defaults so production works without needing these env vars
  const tableName  = process.env.HF_TABLE_NAME   || 'upsa_hf_config';
  const keyColumn  = process.env.HF_KEY_COLUMN    || 'hf_api_key';
  const modelColumn = process.env.HF_MODEL_COLUMN || 'model_names';

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(`${keyColumn}, ${modelColumn}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[HuggingFace] Error querying Supabase table "${tableName}":`, error);
      return null;
    }

    if (!data) {
      console.warn(`[HuggingFace] No configuration row found in table "${tableName}".`);
      return null;
    }

    const configData = data as unknown as Record<string, unknown>;
    const apiKey = configData[keyColumn] as string;
    const rawModelNames = configData[modelColumn];

    if (!apiKey) {
      console.warn(`[HuggingFace] API Key column "${keyColumn}" in table "${tableName}" is empty.`);
      return null;
    }

    let modelNames: string[] = [];
    if (Array.isArray(rawModelNames)) {
      modelNames = rawModelNames.map(String);
    } else if (typeof rawModelNames === 'string') {
      const trimmed = rawModelNames.trim();
      if (trimmed.startsWith('[')) {
        try {
          modelNames = JSON.parse(trimmed);
        } catch {
          modelNames = trimmed.split(',').map(s => s.trim());
        }
      } else {
        modelNames = trimmed.split(',').map(s => s.trim());
      }
    }

    return {
      apiKey,
      modelNames: modelNames.filter(Boolean),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[HuggingFace] Critical error fetching Hugging Face config:`, message);
    return null;
  }
}

/**
 * Maps a human-friendly model name or shorthand to a Hugging Face model ID.
 * Supports: Meta Llama, Qwen 3.6, DeepSeek v4 Pro, and mistral 7b.
 */
export function getHFModelId(modelName: string): string {
  const name = modelName.toLowerCase().trim();
  if (name.includes('/')) {
    // If it's already a full HF path, use it directly
    return modelName.trim();
  }

  if (name.includes('llama')) {
    // Meta Llama
    return 'meta-llama/Llama-3.3-70B-Instruct';
  }
  if (name.includes('qwen')) {
    // Qwen 3.6 (using the standard high-quality Qwen2.5-72B-Instruct)
    return 'Qwen/Qwen2.5-72B-Instruct';
  }
  if (name.includes('deepseek')) {
    // DeepSeek v4 Pro (using DeepSeek-V3 or DeepSeek-R1 / Coder-V2 depending on availability)
    return 'deepseek-ai/DeepSeek-V3';
  }
  if (name.includes('mistral')) {
    // Mistral 7B
    return 'mistralai/Mistral-7B-Instruct-v0.3';
  }

  return modelName.trim();
}

export const defaultHFModels = [
  'meta-llama/Llama-3.3-70B-Instruct',
  'Qwen/Qwen2.5-72B-Instruct',
  'deepseek-ai/DeepSeek-V3',
  'mistralai/Mistral-7B-Instruct-v0.3'
];

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * Sends a request to Hugging Face Inference API using OpenAI-compatible chat completion.
 */
export async function askHuggingFace(
  modelId: string,
  apiKey: string,
  systemInstruction: string,
  history: { role: 'user' | 'assistant' | 'system'; content: string }[],
  userMessage: string
): Promise<string> {
  const messages = [
    { role: 'system', content: systemInstruction },
    ...history,
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await fetch(`https://router.huggingface.co/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages,
        max_tokens: 1500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`[Hugging Face API] ${response.status} ${response.statusText}: ${errorText}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('[Hugging Face] Empty or invalid response from API.');
    }

    return text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[HuggingFace API Error] model=${modelId}:`, message);
    throw err;
  }
}
