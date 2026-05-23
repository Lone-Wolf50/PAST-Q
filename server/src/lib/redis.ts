import Redis from 'ioredis';
import * as Sentry from '@sentry/node';

const REDIS_URL = process.env.REDIS_URL;

let redis: Redis | null = null;

if (REDIS_URL) {
  try {
    console.log('📡 [Redis] Initializing connection...');
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000, // 5 seconds
      disconnectTimeout: 2000,
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.slice(0, targetError.length) === targetError) {
          return true; // Reconnect on READONLY error
        }
        return false;
      }
    });

    redis.on('connect', () => {
      console.log('✅ [Redis] Connection established successfully.');
    });

    redis.on('error', (err) => {
      console.error('🔴 [Redis] Connection / command error:', err.message);
      Sentry.captureException(err);
    });
  } catch (err: any) {
    console.error('🔴 [Redis] Failed to initialize connection:', err.message);
    Sentry.captureException(err);
    redis = null;
  }
} else {
  console.log('ℹ️ [Redis] REDIS_URL not set. Running in serverless-fallback / local-memory mode.');
}

export { redis };

const SESSION_TTL = 86400; // 24 hours in seconds

/**
 * Fetch cached session metadata from Redis.
 * Safely falls back to null on any Redis failures.
 */
export async function getCachedSession(userId: string): Promise<{ status: string; session_version: number } | null> {
  if (!redis) return null;
  try {
    const key = `user:session:${userId}`;
    const cached = await redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached);
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
  data: { status: string; session_version: number }
): Promise<void> {
  if (!redis) return;
  try {
    const key = `user:session:${userId}`;
    await redis.set(key, JSON.stringify(data), 'EX', SESSION_TTL);
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
