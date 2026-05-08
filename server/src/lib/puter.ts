/**
 * puter.ts — Puter.js AI Fallback Utility
 *
 * Uses @heyputer/puter.js to provide an alternative AI backend
 * when the primary Gemini API is rate-limited (429).
 *
 * Authentication: Requires PUTER_AUTH_TOKEN in server/.env
 * How to get a token: log into https://puter.com, open DevTools,
 * and run: JSON.parse(localStorage.getItem('puter.auth.token') || '{}')
 * Or use the Puter CLI: npx @heyputer/puter-cli login
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { init } = require('@heyputer/puter.js/src/init.cjs');

// The Puter model to use for fallback. GPT-4o gives excellent academic answers.
// Alternatives: 'claude-3-5-sonnet', 'claude-3-haiku', 'gpt-4o-mini'
const PUTER_FALLBACK_MODEL = 'gpt-4o';

let puterInstance: any = null;

/**
 * Lazily initializes and returns the authenticated Puter instance.
 * Returns null if PUTER_AUTH_TOKEN is not configured.
 */
function getPuter(): any | null {
  if (!process.env.PUTER_AUTH_TOKEN) {
    console.warn('[Puter] PUTER_AUTH_TOKEN is not set. Puter fallback disabled.');
    return null;
  }
  if (!puterInstance) {
    try {
      puterInstance = init(process.env.PUTER_AUTH_TOKEN);
      console.log('[Puter] Instance initialized successfully.');
    } catch (err) {
      console.error('[Puter] Failed to initialize:', err);
      return null;
    }
  }
  return puterInstance;
}

export interface PuterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Sends a chat request to Puter.js and returns the text reply.
 *
 * @param systemInstruction - The system prompt for the AI persona.
 * @param history - Prior conversation messages (user/assistant turns).
 * @param userMessage - The latest user message.
 * @returns The AI reply text, or throws if unavailable.
 */
export async function askPuter(
  systemInstruction: string,
  history: PuterMessage[],
  userMessage: string,
): Promise<string> {
  const puter = getPuter();
  if (!puter) {
    throw new Error('Puter fallback is not configured (missing PUTER_AUTH_TOKEN).');
  }

  // Build the messages array in the format Puter expects (OpenAI-compatible)
  const messages: PuterMessage[] = [
    { role: 'system', content: systemInstruction },
    ...history,
    { role: 'user', content: userMessage },
  ];

  console.log(`[Puter] Sending request to model: ${PUTER_FALLBACK_MODEL}`);

  const response = await puter.ai.chat(messages, { model: PUTER_FALLBACK_MODEL });

  // Puter resolves with { message: { role, content } }
  const text: string =
    response?.message?.content ??
    response?.content ??
    response?.text ??
    null;

  if (!text) {
    throw new Error('[Puter] Received an empty or unrecognized response from Puter AI.');
  }

  console.log(`[Puter] Response received (${text.length} chars).`);
  return text;
}

export const isPuterAvailable = (): boolean => !!process.env.PUTER_AUTH_TOKEN;
