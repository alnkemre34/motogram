import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ErrorCodes, type LocationSharingMode, type UpdateLocationDto } from '@motogram/shared';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PERF_BUDGET, RATE_LIMITS, REDIS_KEYS, TTL } from './location.constants';

export interface UpdateLocationResult {
  accepted: boolean;
  shard: string;
  durationMs: number;
  skipped?: 'rate_limited' | 'sharing_disabled';
}

export interface NearbyRiderRaw {
  userId: string;
  lat: number;
  lng: number;
  distance: number;
  inParty: boolean;
  partyId: string | null;
  heading: number | null;
  privacyMode: LocationSharingMode;
  lastPingAt: number;
}

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Spec 3.3.2 - Konum guncelleme akisi.
   * - Server-side rate limit (Spec 7.3.5): 1 ping / sn.
   * - Kullanici locationSharing=OFF ise ZREM + skip (Spec 5.1).
   * - GEOADD user_locations:{city} + HSET user:{userId}:status + SADD party members (varsa).
   */
  async updateLocation(
    userId: string,
    dto: UpdateLocationDto,
    user: { city: string | null; locationSharing: LocationSharingMode; isBanned: boolean },
  ): Promise<UpdateLocationResult> {
    const t0 = Date.now();

    if (user.isBanned) {
      throw new ForbiddenException({
        error: 'user_banned',
        code: ErrorCodes.FORBIDDEN,
      });
    }

    // Spec 7.3.5 - saniyede 1 limit (Redis INCR + EX 1)
    const rateKey = `rate:location_ping:${userId}`;
    const count = await this.redis.raw.incr(rateKey);
    if (count === 1) {
      await this.redis.raw.expire(rateKey, 1);
    }
    if (count > RATE_LIMITS.locationPingPerSecond) {
      return {
        accepted: false,
        shard: REDIS_KEYS.userLocationShard(dto.city ?? user.city),
        durationMs: Date.now() - t0,
        skipped: 'rate_limited',
      };
    }

    // Spec 5.1 - Paylasim kapaliysa Redis'e yazma, mevcut kaydi temizle
    if (user.locationSharing === 'OFF' && !dto.partyId) {
      await this.removeFromRedis(userId, user.city);
      return {
        accepted: false,
        shard: REDIS_KEYS.userLocationShard(user.city),
        durationMs: Date.now() - t0,
        skipped: 'sharing_disabled',
      };
    }

    const city = (dto.city ?? user.city ?? undefined) || undefined;
    const shard = REDIS_KEYS.userLocationShard(city);
    const statusKey = REDIS_KEYS.userStatus(userId);
    const pingKey = REDIS_KEYS.userPing(userId);
    const now = Date.now();
    const inParty = Boolean(dto.partyId);

    // Spec 3.3.1 + 3.3.2 - Tek atomic pipeline:
    const pipeline = this.redis.raw.pipeline();
    pipeline.geoadd(shard, dto.lng, dto.lat, userId);
    pipeline.hset(statusKey, {
      online: 'true',
      inParty: dto.partyId ?? '',
      privacyMode: user.locationSharing,
      lastPing: String(now),
      heading: dto.heading !== undefined ? String(dto.heading) : '',
      speed: dto.speed !== undefined ? String(dto.speed) : '',
      city: city ?? '',
    });
    pipeline.expire(statusKey, TTL.userStatus);
    pipeline.set(pingKey, String(now), 'EX', TTL.userPing);
    pipeline.sadd(REDIS_KEYS.userLocationShardIndex(), shard);

    if (inParty && dto.partyId) {
      pipeline.sadd(REDIS_KEYS.partyMembers(dto.partyId), userId);
    }

    await pipeline.exec();

    const durationMs = Date.now() - t0;
    if (durationMs > PERF_BUDGET.locationUpdateMs) {
      this.logger.warn(
        `location_update_slow userId=${userId} durationMs=${durationMs} budget=${PERF_BUDGET.locationUpdateMs}`,
      );
    }

    return { accepted: true, shard, durationMs };
  }

  /**
   * Spec 3.3.3 - GEORADIUS + pipeline ile yakindaki kullanicilari cek.
   * Privacy filtreleme (canViewBasedOnPrivacy) CALLER tarafinda (MapService) yapilir.
   */
  async queryNearbyRaw(
    centerLat: number,
    centerLng: number,
    radiusMeters: number,
    options: { city?: string | null; limit?: number } = {},
  ): Promise<{ riders: NearbyRiderRaw[]; shard: string; durationMs: number }> {
    const t0 = Date.now();
    const shard = REDIS_KEYS.userLocationShard(options.city);
    const limit = options.limit ?? 50;

    // ioredis >=5: georadius is deprecated. GEOSEARCH FROMLONLAT BYRADIUS kullaniyoruz.
    // Spec 3.3.3 ornegiyle ayni semantic.
    const raw = (await this.redis.raw.call(
      'GEOSEARCH',
      shard,
      'FROMLONLAT',
      String(centerLng),
      String(centerLat),
      'BYRADIUS',
      String(radiusMeters),
      'm',
      'WITHCOORD',
      'WITHDIST',
      'ASC',
      'COUNT',
      String(limit),
    )) as Array<[string, string, [string, string]]>;

    if (!raw || raw.length === 0) {
      return { riders: [], shard, durationMs: Date.now() - t0 };
    }

    // Pipeline: her user icin HGETALL (Spec 3.3.3)
    const pipeline = this.redis.raw.pipeline();
    for (const row of raw) {
      const uid = row[0];
      pipeline.hgetall(REDIS_KEYS.userStatus(uid));
    }
    const results = (await pipeline.exec()) ?? [];

    const riders: NearbyRiderRaw[] = [];
    for (let i = 0; i < raw.length; i++) {
      const [uid, distStr, coord] = raw[i]!;
      const pipelineEntry = results[i];
      const status = (pipelineEntry?.[1] as Record<string, string> | null) ?? null;
      if (!status || Object.keys(status).length === 0) {
        // Status expire olmus (60s TTL) - zombi konum, atla
        continue;
      }
      riders.push({
        userId: uid,
        distance: Number(distStr),
        lng: Number(coord[0]),
        lat: Number(coord[1]),
        inParty: Boolean(status.inParty && status.inParty.length > 0),
        partyId: status.inParty && status.inParty.length > 0 ? status.inParty : null,
        heading: status.heading ? Number(status.heading) : null,
        privacyMode: (status.privacyMode as LocationSharingMode) ?? 'OFF',
        lastPingAt: status.lastPing ? Number(status.lastPing) : 0,
      });
    }

    const durationMs = Date.now() - t0;
    if (durationMs > PERF_BUDGET.georadiusMs) {
      this.logger.warn(
        `georadius_slow shard=${shard} found=${riders.length} durationMs=${durationMs} budget=${PERF_BUDGET.georadiusMs}`,
      );
    }

    return { riders, shard, durationMs };
  }

  /**
   * Spec 5.1 - Gizlilik kurali:
   * - inParty bypass: viewer ve target ayni partideyse her zaman gorunur.
   * - OFF: hic kimse goremez.
   * - FOLLOWERS_ONLY: viewer, target'i takip ediyorsa gorur.
   * - MUTUAL_FOLLOWERS: karsilikli takip.
   * - GROUP_MEMBERS: ortak topluluk uyeligi (Faz 4'te tam aktif; Faz 2'de false).
   * - PARTY_ONLY: sadece parti icinde (inParty=false ise gizli).
   * - PUBLIC: herkese acik.
   * - Block varsa her durumda gizli.
   */
  async canViewBasedOnPrivacy(
    viewerId: string,
    targetId: string,
    mode: LocationSharingMode,
    targetInParty: boolean,
    viewerInSameParty: boolean,
  ): Promise<boolean> {
    if (viewerId === targetId) return true;
    if (viewerInSameParty && targetInParty) return true; // Spec 5.1 bypass
    if (mode === 'OFF') return false;
    if (mode === 'PUBLIC') {
      return !(await this.hasBlock(viewerId, targetId));
    }
    if (mode === 'PARTY_ONLY') return false; // sadece parti bypass uzerinden gorunur

    if (await this.hasBlock(viewerId, targetId)) return false;

    if (mode === 'FOLLOWERS_ONLY') {
      const follow = await this.prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
      });
      return follow?.status === 'ACCEPTED';
    }

    if (mode === 'MUTUAL_FOLLOWERS') {
      const [a, b] = await Promise.all([
        this.prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
        }),
        this.prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: targetId, followingId: viewerId } },
        }),
      ]);
      return a?.status === 'ACCEPTED' && b?.status === 'ACCEPTED';
    }

    if (mode === 'GROUP_MEMBERS') {
      // Spec 4 Faz 4 - topluluklar aktif olunca ortak Group sorgusu eklenir.
      // Faz 2'de guvenli default: false.
      return false;
    }

    return false;
  }

  private async hasBlock(viewerId: string, targetId: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { initiatorId: viewerId, targetId },
          { initiatorId: targetId, targetId: viewerId },
        ],
      },
      select: { id: true },
    });
    return Boolean(block);
  }

  /**
   * Spec 5.2 + 7.3.3 - 5dk pasif kullanici temizligi.
   * Cron tarafindan dakika basi cagrilir.
   * Tum aktif shard'larda tarama yapar.
   */
  async sweepZombies(): Promise<{ removed: number; scanned: number; shardsChecked: number }> {
    const threshold = Date.now() - TTL.zombieThreshold * 1000;
    const shards = await this.redis.raw.smembers(REDIS_KEYS.userLocationShardIndex());
    if (shards.length === 0) return { removed: 0, scanned: 0, shardsChecked: 0 };

    let removed = 0;
    let scanned = 0;

    for (const shard of shards) {
      const members = await this.redis.raw.zrange(shard, 0, -1);
      if (members.length === 0) continue;
      scanned += members.length;

      const pipeline = this.redis.raw.pipeline();
      for (const uid of members) {
        pipeline.get(REDIS_KEYS.userPing(uid));
      }
      const pings = (await pipeline.exec()) ?? [];

      const toRemove: string[] = [];
      for (let i = 0; i < members.length; i++) {
        const entry = pings[i];
        const raw = entry?.[1] as string | null | undefined;
        const lastPing = raw ? Number(raw) : 0;
        if (!lastPing || lastPing < threshold) {
          toRemove.push(members[i]!);
        }
      }

      if (toRemove.length > 0) {
        const cleanup = this.redis.raw.pipeline();
        cleanup.zrem(shard, ...toRemove);
        for (const uid of toRemove) {
          cleanup.hset(REDIS_KEYS.userStatus(uid), 'online', 'false');
        }
        await cleanup.exec();
        removed += toRemove.length;
      }
    }

    if (removed > 0) {
      this.logger.log(`zombie_sweep removed=${removed} scanned=${scanned} shards=${shards.length}`);
    }

    return { removed, scanned, shardsChecked: shards.length };
  }

  /**
   * Spec 5.1 - Kullanici offline olunca kayit temizlenir.
   */
  async removeFromRedis(userId: string, city: string | null): Promise<void> {
    const shard = REDIS_KEYS.userLocationShard(city);
    await this.redis.raw
      .multi()
      .zrem(shard, userId)
      .hset(REDIS_KEYS.userStatus(userId), 'online', 'false')
      .del(REDIS_KEYS.userPing(userId))
      .exec();
  }

  /**
   * Spec 3.3.2 - LiveLocationSession (Prisma) baslat.
   */
  async startLiveSession(
    userId: string,
    input: {
      sourceType: 'GLOBAL_VISIBILITY' | 'PARTY' | 'EMERGENCY';
      sourceId?: string;
      visibilityMode: LocationSharingMode;
      expiresInMinutes: number;
    },
  ) {
    const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60 * 1000);
    return this.prisma.liveLocationSession.upsert({
      where: { userId },
      update: {
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        visibilityMode: input.visibilityMode,
        startedAt: new Date(),
        expiresAt,
        isActive: true,
      },
      create: {
        userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        visibilityMode: input.visibilityMode,
        expiresAt,
        isActive: true,
      },
    });
  }

  async stopLiveSession(userId: string): Promise<void> {
    const session = await this.prisma.liveLocationSession.findUnique({ where: { userId } });
    if (!session) return;
    await this.prisma.liveLocationSession.update({
      where: { userId },
      data: { isActive: false },
    });
  }

  /**
   * Spec 8.1.2 - Idempotent Postgres insert (write-behind job tarafindan cagrilir).
   * UNIQUE(user_id, timestamp) + ON CONFLICT DO NOTHING.
   */
  async persistPing(input: {
    sessionId: string;
    userId: string;
    lat: number;
    lng: number;
    heading: number | null;
    speed: number | null;
    accuracy: number | null;
    batteryLevel: number | null;
    timestamp: Date;
  }): Promise<'inserted' | 'skipped'> {
    try {
      await this.prisma.locationPing.create({
        data: {
          sessionId: input.sessionId,
          userId: input.userId,
          latitude: input.lat,
          longitude: input.lng,
          heading: input.heading,
          speed: input.speed,
          accuracy: input.accuracy,
          batteryLevel: input.batteryLevel,
          timestamp: input.timestamp,
        },
      });
      return 'inserted';
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002') {
        // UNIQUE constraint (user_id, timestamp) - idempotent skip (Spec 8.1.2)
        return 'skipped';
      }
      throw err;
    }
  }

  /**
   * Spec 5.2 - 7 gunden eski LocationPing kayitlarini siler. Cron tarafindan
   * gunluk cagrilir.
   */
  async purgeOldPings(): Promise<number> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.locationPing.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
    return result.count;
  }
}
