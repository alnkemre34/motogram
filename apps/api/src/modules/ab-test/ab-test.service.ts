// Spec 8.11.2 - A/B Test Altyapisi
// - Konfig: Redis key `ab_test:config:{key}` (JSON).
// - Atama: Redis key `ab_test:assign:{key}:{userId}` = variantId (string).
// - Hash mantigi: sha1(key + userId) ilk 8 hex % toplamAgirlik -> variant araligi.
// - Atama kalicidir: ayni userId ayni key icin her zaman ayni varianti alir,
//   variantlarin sirasi degismedigi surece. Test yenilenirse cache silinebilir.
import { createHash } from 'node:crypto';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AB_TEST_ASSIGN_PREFIX,
  AB_TEST_CONFIG_PREFIX,
  AbTestConfigSchema,
  ErrorCodes,
  type AbTestConfigDto,
  type UpsertAbTestDto,
} from '@motogram/shared';

import { RedisService } from '../redis/redis.service';

@Injectable()
export class AbTestService {
  private readonly logger = new Logger(AbTestService.name);

  constructor(private readonly redis: RedisService) {}

  async upsert(dto: UpsertAbTestDto, updatedBy?: string): Promise<AbTestConfigDto> {
    const config: AbTestConfigDto = {
      key: dto.key,
      description: dto.description,
      variants: dto.variants,
      enabled: dto.enabled,
      createdAt: new Date().toISOString(),
      updatedBy,
    };
    await this.redis.raw.set(`${AB_TEST_CONFIG_PREFIX}${dto.key}`, JSON.stringify(config));
    return config;
  }

  async delete(key: string): Promise<boolean> {
    const removed = await this.redis.raw.del(`${AB_TEST_CONFIG_PREFIX}${key}`);
    // Eski atamalar da temizlensin (test resetlenirse).
    const assignments = await this.redis.raw.keys(`${AB_TEST_ASSIGN_PREFIX}${key}:*`);
    if (assignments.length > 0) {
      await this.redis.raw.del(...assignments);
    }
    return removed > 0;
  }

  async get(key: string): Promise<AbTestConfigDto | null> {
    const raw = await this.redis.raw.get(`${AB_TEST_CONFIG_PREFIX}${key}`);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      return AbTestConfigSchema.parse(parsed) as AbTestConfigDto;
    } catch (err) {
      this.logger.error(`Invalid ab_test config stored for key=${key}: ${String(err)}`);
      return null;
    }
  }

  async list(): Promise<AbTestConfigDto[]> {
    const keys = await this.redis.raw.keys(`${AB_TEST_CONFIG_PREFIX}*`);
    const out: AbTestConfigDto[] = [];
    for (const k of keys) {
      const raw = await this.redis.raw.get(k);
      if (!raw) continue;
      try {
        const parsed = AbTestConfigSchema.parse(JSON.parse(raw));
        out.push(parsed as AbTestConfigDto);
      } catch {
        // Corrupt entry atlanir
      }
    }
    out.sort((a, b) => a.key.localeCompare(b.key));
    return out;
  }

  // Spec 8.11.2 - assign(key, userId) -> variant (deterministik)
  async assign(key: string, userId: string): Promise<string> {
    const config = await this.get(key);
    if (!config) {
      throw new NotFoundException({
        error: 'ab_test_not_found',
        code: ErrorCodes.NOT_FOUND,
      });
    }
    if (!config.enabled) {
      // Kapali testlerde ilk variant (genelde CONTROL) dondurulur.
      return config.variants[0]!.id;
    }

    const cacheKey = `${AB_TEST_ASSIGN_PREFIX}${key}:${userId}`;
    const cached = await this.redis.raw.get(cacheKey);
    if (cached) {
      // Variant listesinde hala mevcutsa dondur, degilse yeniden hesapla.
      if (config.variants.some((v) => v.id === cached)) {
        return cached;
      }
    }

    const variantId = AbTestService.pickVariant(config, userId);
    await this.redis.raw.set(cacheKey, variantId);
    return variantId;
  }

  // Pure function - test edilebilir.
  static pickVariant(config: AbTestConfigDto, userId: string): string {
    // Variantlari sabit sirayla degerlendir (weight 0 olmaz).
    const total = config.variants.reduce((sum, v) => sum + v.weight, 0);
    const hex = createHash('sha1').update(`${config.key}:${userId}`).digest('hex');
    const bucket = parseInt(hex.slice(0, 8), 16) % total;

    let cum = 0;
    for (const variant of config.variants) {
      cum += variant.weight;
      if (bucket < cum) {
        return variant.id;
      }
    }
    // Asla olmamali; guvenli fallback.
    return config.variants[config.variants.length - 1]!.id;
  }
}
