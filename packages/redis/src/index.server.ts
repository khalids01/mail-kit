import Redis from "ioredis";
import { env } from "../../env/src/env.server";

let redisClient: Redis | null = null;

export function getRedis() {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      keyPrefix: env.REDIS_KEY_PREFIX,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableAutoPipelining: true,
      retryStrategy: () => null,
    });
  }

  return redisClient;
}

export async function connectRedis() {
  const redis = getRedis();

  if (redis.status === "wait") {
    try {
      await redis.connect();
    } catch (error) {
      redis.disconnect();
      redisClient = null;
      throw error;
    }
  }

  return redis;
}

export async function getCache<T>(key: string) {
  const redis = await connectRedis();

  const value = await redis.get(key);
  if (!value) {
    return null;
  }

  return JSON.parse(value) as T;
}

export async function setCache(key: string, value: unknown, ttlInSeconds?: number) {
  const redis = await connectRedis();

  const payload = JSON.stringify(value);

  if (ttlInSeconds) {
    await redis.set(key, payload, "EX", ttlInSeconds);
    return;
  }

  await redis.set(key, payload);
}

export async function deleteCache(key: string) {
  const redis = await connectRedis();

  await redis.del(key);
}
