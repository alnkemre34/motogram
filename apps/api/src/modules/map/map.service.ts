import { Injectable } from '@nestjs/common';
import type { NearbyQueryDto, NearbyRider, NearbyRidersResponse } from '@motogram/shared';

import { PrismaService } from '../prisma/prisma.service';
import { LocationService } from '../location/location.service';
import { REDIS_KEYS } from '../location/location.constants';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class MapService {
  constructor(
    private readonly location: LocationService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Spec 3.3.3 - Yakindaki suruculer + Spec 5.1 privacy filter + Spec 2.3.1
   * filtre secimleri (NEARBY/FRIENDS/PARTIES/EVENTS).
   */
  async getNearbyRiders(
    viewerId: string,
    query: NearbyQueryDto,
    viewerContext: { city: string | null; partyId: string | null },
  ): Promise<NearbyRidersResponse> {
    const { riders, shard, durationMs } = await this.location.queryNearbyRaw(
      query.lat,
      query.lng,
      query.radius,
      { city: query.city ?? viewerContext.city, limit: query.limit },
    );

    if (riders.length === 0) {
      return { riders: [], shard, queryDurationMs: durationMs };
    }

    // Kendisini disla
    const candidates = riders.filter((r) => r.userId !== viewerId);

    // FRIENDS filtresi: viewer'in MUTUAL takip ettigi kullanicilar
    let allowedIds: Set<string> | null = null;
    if (query.filter === 'FRIENDS') {
      const mutuals = await this.getMutualFollowerIds(viewerId);
      allowedIds = mutuals;
    }

    // PARTIES / EVENTS filtreleri Faz 3/4'te backend tarafi genisletilecek.
    // Faz 2: sadece rider listesi; PARTIES filtresinde iceride olanlar gosterilir.
    const visible: NearbyRider[] = [];
    for (const r of candidates) {
      if (allowedIds && !allowedIds.has(r.userId)) continue;
      if (query.filter === 'PARTIES' && !r.inParty) continue;

      const viewerInSameParty = Boolean(
        viewerContext.partyId && r.partyId && viewerContext.partyId === r.partyId,
      );
      const canView = await this.location.canViewBasedOnPrivacy(
        viewerId,
        r.userId,
        r.privacyMode,
        r.inParty,
        viewerInSameParty,
      );
      if (!canView) continue;

      const userRow = await this.prisma.user.findUnique({
        where: { id: r.userId },
        select: { id: true, username: true, avatarUrl: true, deletedAt: true, isBanned: true },
      });
      if (!userRow || userRow.deletedAt || userRow.isBanned) continue;

      visible.push({
        userId: r.userId,
        username: userRow.username,
        avatarUrl: userRow.avatarUrl,
        lat: r.lat,
        lng: r.lng,
        distance: r.distance,
        inParty: r.inParty,
        partyId: r.partyId,
        heading: r.heading,
        lastPingAt: r.lastPingAt,
      });
    }

    return {
      riders: visible,
      shard,
      queryDurationMs: durationMs,
    };
  }

  /**
   * Spec 2.3.1 - Arkadaslar filtresi: MUTUAL takip (karsilikli ACCEPTED).
   */
  private async getMutualFollowerIds(userId: string): Promise<Set<string>> {
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);
    if (followingIds.length === 0) return new Set();

    const mutualRows = await this.prisma.follow.findMany({
      where: {
        followerId: { in: followingIds },
        followingId: userId,
        status: 'ACCEPTED',
      },
      select: { followerId: true },
    });
    return new Set(mutualRows.map((m) => m.followerId));
  }

  /**
   * Spec 8.3 - Komsu shard'larda paralel sorgu (buyuk radius icin).
   */
  async getRiderCountPerShard(): Promise<Array<{ shard: string; count: number }>> {
    const shards = await this.redis.raw.smembers(REDIS_KEYS.userLocationShardIndex());
    const counts = await Promise.all(
      shards.map(async (s) => ({ shard: s, count: await this.redis.raw.zcard(s) })),
    );
    return counts.sort((a, b) => b.count - a.count);
  }
}
