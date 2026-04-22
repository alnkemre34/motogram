import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type Redis as RedisClient } from 'ioredis';

import type { MetricsService } from '../metrics/metrics.service';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: RedisClient) {}

  get raw(): RedisClient {
    return this.client;
  }

  // Spec 8.6 - Refresh token storage: refresh_token:{userId}:{tokenId}
  async setRefreshToken(userId: string, tokenId: string, ttlSeconds: number): Promise<void> {
    await this.client.set(`refresh_token:${userId}:${tokenId}`, '1', 'EX', ttlSeconds);
  }

  async isRefreshTokenValid(userId: string, tokenId: string): Promise<boolean> {
    const val = await this.client.get(`refresh_token:${userId}:${tokenId}`);
    return val === '1';
  }

  async revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
    await this.client.del(`refresh_token:${userId}:${tokenId}`);
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<number> {
    const pattern = `refresh_token:${userId}:*`;
    const keys = await this.client.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    return this.client.del(...keys);
  }

  // Spec 8.7.2 - Sahte hesap tespiti icin spam skoru (Faz 1'de temel infra)
  async incrementActionCount(userId: string, action: string, windowSeconds: number): Promise<number> {
    const key = `rate:${action}:${userId}`;
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, windowSeconds);
    }
    return count;
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}

export function createRedisClient(config: ConfigService, metrics?: MetricsService): RedisClient {
  const url = config.get<string>('REDIS_URL', 'redis://localhost:6379');
  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  if (metrics) {
    client.on('error', (err: Error & { command?: { name?: string } }) => {
      const cmd = err.command?.name ?? 'unknown';
      metrics.redisCommandErrors.inc({ command: cmd });
    });
  }
  return client;
}
