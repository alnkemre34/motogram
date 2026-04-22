import { ForbiddenException } from '@nestjs/common';

import { LocationService } from './location.service';
import { REDIS_KEYS, TTL } from './location.constants';

// Spec 3.3 (Redis GEO) + 5.1 (Privacy) + 5.2 (5dk ZREM + 7gun purge) +
// 7.3.3 (Zombi temizligi) + 7.3.5 (Rate limit) + 8.1.2 (Idempotent insert) +
// 8.3 (Sharding) testleri.

interface PipelineMock {
  geoadd: jest.Mock;
  hset: jest.Mock;
  expire: jest.Mock;
  set: jest.Mock;
  sadd: jest.Mock;
  zrem: jest.Mock;
  del: jest.Mock;
  hgetall: jest.Mock;
  get: jest.Mock;
  exec: jest.Mock;
}

function createPipelineMock(results: Array<[Error | null, unknown]> = []): PipelineMock {
  const mock: PipelineMock = {
    geoadd: jest.fn().mockReturnThis(),
    hset: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    zrem: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    hgetall: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(results),
  };
  return mock;
}

interface RedisMock {
  raw: {
    incr: jest.Mock;
    expire: jest.Mock;
    pipeline: jest.Mock;
    multi: jest.Mock;
    call: jest.Mock;
    smembers: jest.Mock;
    zrange: jest.Mock;
    zrem: jest.Mock;
    zcard: jest.Mock;
    hset: jest.Mock;
    del: jest.Mock;
  };
}

function createRedisMock(): RedisMock {
  const pipelines: PipelineMock[] = [];
  return {
    raw: {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      pipeline: jest.fn(() => {
        const p = createPipelineMock();
        pipelines.push(p);
        return p;
      }),
      multi: jest.fn(() => {
        const m = createPipelineMock();
        pipelines.push(m);
        return m;
      }),
      call: jest.fn(),
      smembers: jest.fn().mockResolvedValue([]),
      zrange: jest.fn().mockResolvedValue([]),
      zrem: jest.fn().mockResolvedValue(0),
      zcard: jest.fn().mockResolvedValue(0),
      hset: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
    },
  };
}

interface PrismaMock {
  follow: { findUnique: jest.Mock; findMany: jest.Mock };
  block: { findFirst: jest.Mock };
  liveLocationSession: { upsert: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  locationPing: { create: jest.Mock; deleteMany: jest.Mock };
  user: { findUnique: jest.Mock };
}

function createPrismaMock(): PrismaMock {
  return {
    follow: { findUnique: jest.fn(), findMany: jest.fn() },
    block: { findFirst: jest.fn().mockResolvedValue(null) },
    liveLocationSession: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    locationPing: { create: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    user: { findUnique: jest.fn() },
  };
}

describe('LocationService (Spec 3.3, 5.1, 5.2, 7.3.3, 7.3.5, 8.1.2, 8.3)', () => {
  let redis: RedisMock;
  let prisma: PrismaMock;
  let service: LocationService;

  beforeEach(() => {
    redis = createRedisMock();
    prisma = createPrismaMock();
    service = new LocationService(
      { raw: redis.raw } as never,
      prisma as never,
    );
  });

  describe('updateLocation', () => {
    const baseUser = {
      city: 'istanbul',
      locationSharing: 'FOLLOWERS_ONLY' as const,
      isBanned: false,
    };

    it('writes GEOADD to user_locations:{city} shard (Spec 8.3.2)', async () => {
      const pipelineResults: Array<[Error | null, unknown]> = [];
      let capturedPipeline: PipelineMock | null = null;
      redis.raw.pipeline.mockImplementationOnce(() => {
        capturedPipeline = createPipelineMock(pipelineResults);
        return capturedPipeline;
      });

      const result = await service.updateLocation(
        'u1',
        { lat: 41.0, lng: 29.0, clientTimestamp: Date.now() },
        baseUser,
      );

      expect(result.accepted).toBe(true);
      expect(result.shard).toBe('user_locations:istanbul');
      const p = capturedPipeline as PipelineMock | null;
      expect(p).not.toBeNull();
      expect(p!.geoadd).toHaveBeenCalledWith('user_locations:istanbul', 29.0, 41.0, 'u1');
      expect(p!.sadd).toHaveBeenCalledWith(REDIS_KEYS.userLocationShardIndex(), 'user_locations:istanbul');
      expect(p!.expire).toHaveBeenCalledWith(REDIS_KEYS.userStatus('u1'), TTL.userStatus);
    });

    it('falls back to :global shard when city missing (Spec 8.3.2)', async () => {
      let captured: PipelineMock | null = null;
      redis.raw.pipeline.mockImplementationOnce(() => {
        captured = createPipelineMock();
        return captured;
      });
      const result = await service.updateLocation(
        'u1',
        { lat: 41.0, lng: 29.0, clientTimestamp: Date.now() },
        { ...baseUser, city: null },
      );
      expect(result.shard).toBe('user_locations:global');
      const p = captured as PipelineMock | null;
      expect(p).not.toBeNull();
      expect(p!.geoadd).toHaveBeenCalledWith('user_locations:global', 29.0, 41.0, 'u1');
    });

    it('rejects when rate limit exceeded (Spec 7.3.5 - 1/sn)', async () => {
      redis.raw.incr.mockResolvedValueOnce(2);
      const result = await service.updateLocation(
        'u1',
        { lat: 41.0, lng: 29.0, clientTimestamp: Date.now() },
        baseUser,
      );
      expect(result.accepted).toBe(false);
      expect(result.skipped).toBe('rate_limited');
      expect(redis.raw.pipeline).not.toHaveBeenCalled();
    });

    it('removes from Redis and skips when sharing=OFF (Spec 5.1)', async () => {
      const result = await service.updateLocation(
        'u1',
        { lat: 41.0, lng: 29.0, clientTimestamp: Date.now() },
        { ...baseUser, locationSharing: 'OFF' },
      );
      expect(result.accepted).toBe(false);
      expect(result.skipped).toBe('sharing_disabled');
      expect(redis.raw.multi).toHaveBeenCalled(); // removeFromRedis uses multi
    });

    it('throws ForbiddenException when user is banned', async () => {
      await expect(
        service.updateLocation(
          'u1',
          { lat: 41.0, lng: 29.0, clientTimestamp: Date.now() },
          { ...baseUser, isBanned: true },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('adds user to party set when partyId given (Spec 3.3.2)', async () => {
      let captured: PipelineMock | null = null;
      redis.raw.pipeline.mockImplementationOnce(() => {
        captured = createPipelineMock();
        return captured;
      });
      await service.updateLocation(
        'u1',
        { lat: 41.0, lng: 29.0, clientTimestamp: Date.now(), partyId: 'p1' },
        baseUser,
      );
      const p = captured as PipelineMock | null;
      expect(p).not.toBeNull();
      expect(p!.sadd).toHaveBeenCalledWith(REDIS_KEYS.partyMembers('p1'), 'u1');
    });
  });

  describe('queryNearbyRaw (Spec 3.3.3)', () => {
    it('uses GEOSEARCH on city shard + pipeline HGETALL', async () => {
      // GEOSEARCH donusu: [userId, distance, [lng, lat]]
      redis.raw.call.mockResolvedValueOnce([
        ['u2', '100.5', ['29.01', '41.01']],
        ['u3', '250.0', ['29.02', '41.02']],
      ]);
      const captured = createPipelineMock([
        [null, { online: 'true', inParty: '', privacyMode: 'PUBLIC', lastPing: '1700000000000' }],
        [null, { online: 'true', inParty: 'p1', privacyMode: 'PUBLIC', lastPing: '1700000000000' }],
      ]);
      redis.raw.pipeline.mockReturnValueOnce(captured);

      const res = await service.queryNearbyRaw(41.0, 29.0, 5000, { city: 'istanbul', limit: 50 });

      expect(redis.raw.call).toHaveBeenCalledWith(
        'GEOSEARCH',
        'user_locations:istanbul',
        'FROMLONLAT',
        '29',
        '41',
        'BYRADIUS',
        '5000',
        'm',
        'WITHCOORD',
        'WITHDIST',
        'ASC',
        'COUNT',
        '50',
      );
      expect(res.riders).toHaveLength(2);
      expect(res.riders[0]!.userId).toBe('u2');
      expect(res.riders[0]!.distance).toBe(100.5);
      expect(res.riders[0]!.lng).toBeCloseTo(29.01);
      expect(res.riders[0]!.inParty).toBe(false);
      expect(res.riders[1]!.inParty).toBe(true);
      expect(res.riders[1]!.partyId).toBe('p1');
    });

    it('skips riders with expired status (zombi - Spec 7.3.3)', async () => {
      redis.raw.call.mockResolvedValueOnce([['u2', '100.0', ['29.0', '41.0']]]);
      redis.raw.pipeline.mockReturnValueOnce(createPipelineMock([[null, null]]));
      const res = await service.queryNearbyRaw(41.0, 29.0, 5000, { city: 'istanbul' });
      expect(res.riders).toHaveLength(0);
    });

    it('returns empty fast path when GEOSEARCH empty', async () => {
      redis.raw.call.mockResolvedValueOnce([]);
      const res = await service.queryNearbyRaw(41.0, 29.0, 5000, { city: 'istanbul' });
      expect(res.riders).toHaveLength(0);
      expect(redis.raw.pipeline).not.toHaveBeenCalled();
    });
  });

  describe('canViewBasedOnPrivacy (Spec 5.1)', () => {
    it('bypasses privacy when both users in same party', async () => {
      const ok = await service.canViewBasedOnPrivacy('v', 't', 'OFF', true, true);
      expect(ok).toBe(true);
    });

    it('hides when mode=OFF', async () => {
      const ok = await service.canViewBasedOnPrivacy('v', 't', 'OFF', false, false);
      expect(ok).toBe(false);
    });

    it('returns true for PUBLIC when no block', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      const ok = await service.canViewBasedOnPrivacy('v', 't', 'PUBLIC', false, false);
      expect(ok).toBe(true);
    });

    it('returns false for PUBLIC when a block exists', async () => {
      prisma.block.findFirst.mockResolvedValue({ id: 'b1' });
      const ok = await service.canViewBasedOnPrivacy('v', 't', 'PUBLIC', false, false);
      expect(ok).toBe(false);
    });

    it('FOLLOWERS_ONLY: viewer follows target -> visible', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      prisma.follow.findUnique.mockResolvedValue({ status: 'ACCEPTED' });
      const ok = await service.canViewBasedOnPrivacy('v', 't', 'FOLLOWERS_ONLY', false, false);
      expect(ok).toBe(true);
    });

    it('MUTUAL_FOLLOWERS: only when both directions ACCEPTED', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      prisma.follow.findUnique
        .mockResolvedValueOnce({ status: 'ACCEPTED' })
        .mockResolvedValueOnce({ status: 'PENDING' });
      const ok = await service.canViewBasedOnPrivacy('v', 't', 'MUTUAL_FOLLOWERS', false, false);
      expect(ok).toBe(false);
    });

    it('PARTY_ONLY hides when not in same party (Spec 5.1)', async () => {
      const ok = await service.canViewBasedOnPrivacy('v', 't', 'PARTY_ONLY', false, false);
      expect(ok).toBe(false);
    });

    it('GROUP_MEMBERS defaults to false in Faz 2 (Faz 4 aktif)', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      const ok = await service.canViewBasedOnPrivacy('v', 't', 'GROUP_MEMBERS', false, false);
      expect(ok).toBe(false);
    });
  });

  describe('sweepZombies (Spec 7.3.3 + 5.2)', () => {
    it('ZREM users whose lastPing older than 5min threshold', async () => {
      const now = Date.now();
      redis.raw.smembers.mockResolvedValue(['user_locations:istanbul']);
      redis.raw.zrange.mockResolvedValueOnce(['u1', 'u2', 'u3']);
      // Pipeline 1: GET userPing for 3 users
      const pipelineGet = createPipelineMock([
        [null, String(now - 400_000)], // u1: 6.67dk, zombi
        [null, String(now)],             // u2: fresh
        [null, null],                    // u3: TTL expired, zombi
      ]);
      // Pipeline 2: cleanup (ZREM + HSET online=false)
      const pipelineClean = createPipelineMock();
      redis.raw.pipeline
        .mockReturnValueOnce(pipelineGet)
        .mockReturnValueOnce(pipelineClean);

      const result = await service.sweepZombies();

      expect(result.removed).toBe(2);
      expect(result.scanned).toBe(3);
      expect(pipelineClean.zrem).toHaveBeenCalledWith('user_locations:istanbul', 'u1', 'u3');
    });

    it('returns zero when no shards tracked', async () => {
      redis.raw.smembers.mockResolvedValue([]);
      const result = await service.sweepZombies();
      expect(result).toEqual({ removed: 0, scanned: 0, shardsChecked: 0 });
    });
  });

  describe('persistPing (Spec 8.1.2 - idempotent)', () => {
    it('inserts LocationPing on success', async () => {
      prisma.locationPing.create.mockResolvedValue({ id: 'p1' });
      const result = await service.persistPing({
        sessionId: 's1',
        userId: 'u1',
        lat: 41,
        lng: 29,
        heading: null,
        speed: null,
        accuracy: null,
        batteryLevel: null,
        timestamp: new Date(),
      });
      expect(result).toBe('inserted');
    });

    it('swallows P2002 UNIQUE conflicts (idempotent per Spec 8.1.2)', async () => {
      prisma.locationPing.create.mockRejectedValue({ code: 'P2002' });
      const result = await service.persistPing({
        sessionId: 's1',
        userId: 'u1',
        lat: 41,
        lng: 29,
        heading: null,
        speed: null,
        accuracy: null,
        batteryLevel: null,
        timestamp: new Date(),
      });
      expect(result).toBe('skipped');
    });

    it('propagates non-conflict errors', async () => {
      prisma.locationPing.create.mockRejectedValue(new Error('boom'));
      await expect(
        service.persistPing({
          sessionId: 's1',
          userId: 'u1',
          lat: 41,
          lng: 29,
          heading: null,
          speed: null,
          accuracy: null,
          batteryLevel: null,
          timestamp: new Date(),
        }),
      ).rejects.toThrow('boom');
    });
  });

  describe('purgeOldPings (Spec 5.2 - 7 gun)', () => {
    it('deletes pings older than 7 days', async () => {
      prisma.locationPing.deleteMany.mockResolvedValue({ count: 42 });
      const count = await service.purgeOldPings();
      expect(count).toBe(42);
      const arg = prisma.locationPing.deleteMany.mock.calls[0]![0];
      const cutoff: Date = arg.where.timestamp.lt;
      const diff = Date.now() - cutoff.getTime();
      // 7 gun civari ~ 7*24*60*60*1000 = 604800000
      expect(diff).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
      expect(diff).toBeLessThan(7.1 * 24 * 60 * 60 * 1000);
    });
  });
});
