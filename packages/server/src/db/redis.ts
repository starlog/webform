import { Redis } from 'ioredis';
import { env } from '../config/index.js';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 10) return null;
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  redis.on('connect', () => console.log('[redis] connected'));
  redis.on('error', (err: Error) => console.error('[redis] error:', err.message));
  redis.on('close', () => console.log('[redis] connection closed'));

  await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
