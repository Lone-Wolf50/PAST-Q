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

// The Puter model to use for fallback. GPT-4o gives excellent academic answers.
// Alternatives: 'claude-3-5-sonnet', 'claude-3-haiku', 'gpt-4o-mini'
const PUTER_FALLBACK_MODEL = 'gpt-4o';

export interface PuterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Sends a chat request to Puter.js and returns the text reply.
 * Uses a direct fetch call to Puter's OpenAI-compatible endpoint
 * to avoid ESM/CommonJS dependency issues with the @heyputer/puter.js library.
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
  const token = process.env.PUTER_AUTH_TOKEN;
  if (!token) {
    throw new Error('Puter fallback is not configured (missing PUTER_AUTH_TOKEN).');
  }

  // Build the messages array in standard OpenAI format
  const messages = [
    { role: 'system', content: systemInstruction },
    ...history,
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await fetch('https://api.puter.com/puterai/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: PUTER_FALLBACK_MODEL,
        messages: messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`[Puter API] ${response.status} ${response.statusText}: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error('[Puter] Received an empty or unrecognized response from Puter AI.');
    }

    return text;
  } catch (err: any) {
    console.error('❌ Puter API Error:', err.message);
    throw err;
  }
}

export const isPuterAvailable = (): boolean => !!process.env.PUTER_AUTH_TOKEN;
