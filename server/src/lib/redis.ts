import { Redis } from '@upstash/redis';
import * as Sentry from '@sentry/node';

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;

if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
  try {
    console.log('📡 [Redis] Initializing HTTP REST client...');
    redis = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('✅ [Redis] Connection established successfully.');
  } catch (err: any) {
    console.error('🔴 [Redis] Failed to initialize connection:', err.message);
    Sentry.captureException(err);
    redis = null;
  }
} else {
  console.log('ℹ️ [Redis] UPSTASH_REDIS_REST_URL/TOKEN not set. Running in serverless-fallback / local-memory mode.');
}

export { redis };

const SESSION_TTL = 86400; // 24 hours in seconds

/**
 * Fetch cached session metadata from Redis.
 * Safely falls back to null on any Redis failures.
 */
export async function getCachedSession(userId: string): Promise<{ status: string; session_version: number; role?: string } | null> {
  if (!redis) return null;
  try {
    const key = `user:session:${userId}`;
    const cached = await redis.get(key);
    if (!cached) return null;
    
    if (typeof cached === 'string') {
      return JSON.parse(cached);
    }
    return cached as { status: string; session_version: number; role?: string };
  } catch (err: any) {
    console.error(`⚠️ [Redis] getCachedSession failed for user ${userId}:`, err.message);
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Write session metadata to Redis with a 24-hour expiration time.
 * Safely ignores failures.
 */
export async function setCachedSession(
  userId: string,
  data: { status: string; session_version: number; role?: string }
): Promise<void> {
  if (!redis) return;
  try {
    const key = `user:session:${userId}`;
    await redis.set(key, JSON.stringify(data), { ex: SESSION_TTL });
  } catch (err: any) {
    console.error(`⚠️ [Redis] setCachedSession failed for user ${userId}:`, err.message);
    Sentry.captureException(err);
  }
}

/**
 * Evict session cache record from Redis to enforce updates instantly.
 * Safely ignores failures.
 */
export async function invalidateCachedSession(userId: string): Promise<void> {
  if (!redis) return;
  try {
    const key = `user:session:${userId}`;
    await redis.del(key);
    console.log(`🧹 [Redis] Evicted session cache for user: ${userId}`);
  } catch (err: any) {
    console.error(`⚠️ [Redis] invalidateCachedSession failed for user ${userId}:`, err.message);
    Sentry.captureException(err);
  }
}
