/**
 * This utility tracks the live health of the Gemini API.
 * Since quota limits are temporary, we keep this in memory.
 * If the server restarts, it defaults back to 'online'.
 */

export interface AIHealth {
  status: 'online' | 'limited';
  lastModelTried: string;
  backOnlineAt: string | null; // ISO string
  lastError: string | null;
}

let health: AIHealth = {
  status: 'online',
  lastModelTried: 'gemini-2.0-flash',
  backOnlineAt: null,
  lastError: null,
};

export const getAIHealth = () => {
  // If we are marked as limited but the time has passed, reset to online
  if (health.status === 'limited' && health.backOnlineAt) {
    if (new Date() > new Date(health.backOnlineAt)) {
      health.status = 'online';
      health.backOnlineAt = null;
    }
  }
  return health;
};

export const setAIHealth = (update: Partial<AIHealth>) => {
  health = { ...health, ...update };
};
