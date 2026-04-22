// Spec 8.11.1 - Feature Flag Sistemi (Redis tabanli)
// Redis hash key: feature_flag:{key}
// Fields: strategy | percentage | userIds (csv) | description | updatedAt | updatedBy
// Evaluate mantigi:
//  - OFF        -> enabled = false
//  - ON         -> enabled = true
//  - PERCENTAGE -> sha1(key + userId) % 100 < percentage
//  - USER_LIST  -> userIds listesinde varsa true
// Hash tabanli bucketing deterministik oldugu icin ayni kullanici hep ayni
// sonucu alir (A/B test ile ayni prensip).
import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import {
  FEATURE_FLAG_REDIS_PREFIX,
  type FeatureFlagEvaluationDto,
  type FeatureFlagStrategy,
  type FeatureFlagValueDto,
  type UpsertFeatureFlagDto,
} from '@motogram/shared';

import { RedisService } from '../redis/redis.service';

const FIELDS = {
  STRATEGY: 'strategy',
  PERCENTAGE: 'percentage',
  USER_IDS: 'userIds',
  DESCRIPTION: 'description',
  UPDATED_AT: 'updatedAt',
  UPDATED_BY: 'updatedBy',
} as const;

@Injectable()
export class FeatureFlagService {
  constructor(private readonly redis: RedisService) {}

  private key(flagKey: string): string {
    return `${FEATURE_FLAG_REDIS_PREFIX}${flagKey}`;
  }

  async upsert(dto: UpsertFeatureFlagDto, updatedBy?: string): Promise<FeatureFlagValueDto> {
    const payload: Record<string, string> = {
      [FIELDS.STRATEGY]: dto.strategy,
      [FIELDS.UPDATED_AT]: new Date().toISOString(),
    };
    if (dto.percentage !== undefined) {
      payload[FIELDS.PERCENTAGE] = String(dto.percentage);
    }
    if (dto.userIds && dto.userIds.length > 0) {
      payload[FIELDS.USER_IDS] = dto.userIds.join(',');
    }
    if (dto.description) {
      payload[FIELDS.DESCRIPTION] = dto.description;
    }
    if (updatedBy) {
      payload[FIELDS.UPDATED_BY] = updatedBy;
    }

    // Onceki degerlerin kirlenmemesi icin del + hset (atomik degil ama multi gereksiz).
    await this.redis.raw.del(this.key(dto.key));
    await this.redis.raw.hset(this.key(dto.key), payload);

    return this.readValue(dto.key) as Promise<FeatureFlagValueDto>;
  }

  async delete(flagKey: string): Promise<boolean> {
    const removed = await this.redis.raw.del(this.key(flagKey));
    return removed > 0;
  }

  async list(): Promise<Array<{ key: string; value: FeatureFlagValueDto }>> {
    const keys = await this.redis.raw.keys(`${FEATURE_FLAG_REDIS_PREFIX}*`);
    if (keys.length === 0) {
      return [];
    }
    const results: Array<{ key: string; value: FeatureFlagValueDto }> = [];
    for (const fullKey of keys) {
      const flagKey = fullKey.slice(FEATURE_FLAG_REDIS_PREFIX.length);
      const value = await this.readValue(flagKey);
      if (value) {
        results.push({ key: flagKey, value });
      }
    }
    results.sort((a, b) => a.key.localeCompare(b.key));
    return results;
  }

  async readValue(flagKey: string): Promise<FeatureFlagValueDto | null> {
    const raw = await this.redis.raw.hgetall(this.key(flagKey));
    if (!raw || Object.keys(raw).length === 0) {
      return null;
    }
    const strategy = (raw[FIELDS.STRATEGY] as FeatureFlagStrategy) || 'OFF';
    const value: FeatureFlagValueDto = {
      strategy,
    };
    if (raw[FIELDS.PERCENTAGE] !== undefined) {
      const pct = Number(raw[FIELDS.PERCENTAGE]);
      value.percentage = Number.isFinite(pct) ? pct : 0;
    }
    const rawUserIds = raw[FIELDS.USER_IDS];
    if (rawUserIds) {
      value.userIds = rawUserIds
        .split(',')
        .map((id: string) => id.trim())
        .filter(Boolean);
    }
    if (raw[FIELDS.DESCRIPTION]) {
      value.description = raw[FIELDS.DESCRIPTION];
    }
    if (raw[FIELDS.UPDATED_AT]) {
      value.updatedAt = raw[FIELDS.UPDATED_AT];
    }
    if (raw[FIELDS.UPDATED_BY]) {
      value.updatedBy = raw[FIELDS.UPDATED_BY];
    }
    return value;
  }

  // Spec 8.11.1 - evaluate(key, userId) -> bool
  async evaluate(flagKey: string, userId?: string): Promise<FeatureFlagEvaluationDto> {
    const value = await this.readValue(flagKey);
    if (!value) {
      // Tanimsiz flag = kapali (guvenli default)
      return { key: flagKey, enabled: false, strategy: 'OFF', reason: 'flag_not_found' };
    }

    switch (value.strategy) {
      case 'OFF':
        return { key: flagKey, enabled: false, strategy: 'OFF', userId };
      case 'ON':
        return { key: flagKey, enabled: true, strategy: 'ON', userId };
      case 'USER_LIST': {
        if (!userId) {
          return {
            key: flagKey,
            enabled: false,
            strategy: 'USER_LIST',
            reason: 'userId_required',
          };
        }
        const inList = (value.userIds ?? []).includes(userId);
        return { key: flagKey, enabled: inList, strategy: 'USER_LIST', userId };
      }
      case 'PERCENTAGE': {
        const pct = value.percentage ?? 0;
        if (pct <= 0) {
          return { key: flagKey, enabled: false, strategy: 'PERCENTAGE', userId };
        }
        if (pct >= 100) {
          return { key: flagKey, enabled: true, strategy: 'PERCENTAGE', userId };
        }
        if (!userId) {
          return {
            key: flagKey,
            enabled: false,
            strategy: 'PERCENTAGE',
            reason: 'userId_required',
          };
        }
        const bucket = FeatureFlagService.hashBucket(flagKey, userId);
        return {
          key: flagKey,
          enabled: bucket < pct,
          strategy: 'PERCENTAGE',
          userId,
        };
      }
      default:
        return { key: flagKey, enabled: false, strategy: 'OFF', reason: 'unknown_strategy' };
    }
  }

  // Deterministik hash bucket: 0-99 arasi deger.
  // Spec 8.11.1 — aynı userId için her zaman aynı değeri döner.
  static hashBucket(flagKey: string, userId: string): number {
    const hex = createHash('sha1').update(`${flagKey}:${userId}`).digest('hex');
    // Ilk 8 hex char -> 32-bit int -> % 100
    const int = parseInt(hex.slice(0, 8), 16);
    return int % 100;
  }
}
