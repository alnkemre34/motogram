import type { NearbyQueryDto } from '@motogram/shared';

import { MapService } from './map.service';

// Spec 2.3.1 - Keşif Modu filtreleri (NEARBY/FRIENDS/PARTIES/EVENTS)
// Spec 5.1 - Privacy + inParty bypass
// Spec 7.2.2 - Block: iki taraf da goremez

interface LocationMock {
  queryNearbyRaw: jest.Mock;
  canViewBasedOnPrivacy: jest.Mock;
}

function buildRaw(userId: string, overrides: Partial<{
  inParty: boolean;
  partyId: string | null;
  privacyMode: string;
  distance: number;
}> = {}) {
  return {
    userId,
    lat: 41.0,
    lng: 29.0,
    distance: overrides.distance ?? 100,
    inParty: overrides.inParty ?? false,
    partyId: overrides.partyId ?? null,
    heading: null,
    privacyMode: overrides.privacyMode ?? 'PUBLIC',
    lastPingAt: 1_700_000_000_000,
  };
}

describe('MapService.getNearbyRiders (Spec 2.3.1, 5.1, 7.2.2)', () => {
  let location: LocationMock;
  let prisma: {
    user: { findUnique: jest.Mock };
    follow: { findMany: jest.Mock };
  };
  let redis: { raw: { smembers: jest.Mock; zcard: jest.Mock } };
  let service: MapService;

  beforeEach(() => {
    location = {
      queryNearbyRaw: jest.fn(),
      canViewBasedOnPrivacy: jest.fn().mockResolvedValue(true),
    };
    prisma = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({
            id: where.id,
            username: `${where.id}_user`,
            avatarUrl: null,
            deletedAt: null,
            isBanned: false,
          }),
        ),
      },
      follow: { findMany: jest.fn().mockResolvedValue([]) },
    };
    redis = { raw: { smembers: jest.fn(), zcard: jest.fn() } };
    service = new MapService(location as never, prisma as never, redis as never);
  });

  const baseQuery: NearbyQueryDto = {
    lat: 41.0,
    lng: 29.0,
    radius: 5000,
    filter: 'NEARBY',
    limit: 50,
  };

  it('excludes viewer itself from results', async () => {
    location.queryNearbyRaw.mockResolvedValue({
      riders: [buildRaw('viewer'), buildRaw('u2')],
      shard: 'user_locations:istanbul',
      durationMs: 5,
    });
    const res = await service.getNearbyRiders('viewer', baseQuery, { city: 'istanbul', partyId: null });
    expect(res.riders.map((r) => r.userId)).toEqual(['u2']);
    expect(res.queryDurationMs).toBe(5);
  });

  it('sorts by distance ASC (comes pre-sorted from Redis GEOSEARCH)', async () => {
    // Spec 3.3.3 - GEOSEARCH ASC; service sadece filtreler
    location.queryNearbyRaw.mockResolvedValue({
      riders: [
        buildRaw('u1', { distance: 50 }),
        buildRaw('u2', { distance: 150 }),
        buildRaw('u3', { distance: 350 }),
      ],
      shard: 'user_locations:istanbul',
      durationMs: 3,
    });
    const res = await service.getNearbyRiders('v', baseQuery, { city: 'istanbul', partyId: null });
    expect(res.riders.map((r) => r.distance)).toEqual([50, 150, 350]);
  });

  it('filter=FRIENDS -> only mutual followers visible', async () => {
    location.queryNearbyRaw.mockResolvedValue({
      riders: [buildRaw('f1'), buildRaw('stranger')],
      shard: 'user_locations:istanbul',
      durationMs: 2,
    });
    // Spec 2.3.1 FRIENDS = MUTUAL follow.
    // First findMany: viewer -> following (ACCEPTED)
    // Second findMany: those following back viewer (ACCEPTED)
    prisma.follow.findMany
      .mockResolvedValueOnce([{ followingId: 'f1' }, { followingId: 'stranger' }])
      .mockResolvedValueOnce([{ followerId: 'f1' }]);
    const res = await service.getNearbyRiders(
      'v',
      { ...baseQuery, filter: 'FRIENDS' },
      { city: 'istanbul', partyId: null },
    );
    expect(res.riders.map((r) => r.userId)).toEqual(['f1']);
  });

  it('filter=PARTIES -> only riders with inParty=true', async () => {
    location.queryNearbyRaw.mockResolvedValue({
      riders: [
        buildRaw('pRider', { inParty: true, partyId: 'p1' }),
        buildRaw('solo', { inParty: false }),
      ],
      shard: 'user_locations:istanbul',
      durationMs: 2,
    });
    const res = await service.getNearbyRiders(
      'v',
      { ...baseQuery, filter: 'PARTIES' },
      { city: 'istanbul', partyId: null },
    );
    expect(res.riders.map((r) => r.userId)).toEqual(['pRider']);
  });

  it('privacy filter hides riders when canView=false (Spec 5.1)', async () => {
    location.queryNearbyRaw.mockResolvedValue({
      riders: [buildRaw('hidden'), buildRaw('shown')],
      shard: 'user_locations:istanbul',
      durationMs: 1,
    });
    location.canViewBasedOnPrivacy = jest.fn(async (_v, target) => target === 'shown');
    const res = await service.getNearbyRiders('v', baseQuery, { city: 'istanbul', partyId: null });
    expect(res.riders.map((r) => r.userId)).toEqual(['shown']);
  });

  it('inParty bypass: viewer ve target ayni partideyse her zaman gorunur (Spec 5.1)', async () => {
    location.queryNearbyRaw.mockResolvedValue({
      riders: [buildRaw('partyMate', { inParty: true, partyId: 'p1', privacyMode: 'OFF' })],
      shard: 'user_locations:istanbul',
      durationMs: 1,
    });
    let captured: unknown[] = [];
    location.canViewBasedOnPrivacy = jest.fn(async (...args) => {
      captured = args;
      return true;
    });
    await service.getNearbyRiders('v', baseQuery, { city: 'istanbul', partyId: 'p1' });
    // args: viewerId, targetId, privacyMode, targetInParty, viewerInSameParty
    expect(captured[3]).toBe(true);
    expect(captured[4]).toBe(true);
  });

  it('excludes soft-deleted / banned users', async () => {
    location.queryNearbyRaw.mockResolvedValue({
      riders: [buildRaw('deleted'), buildRaw('banned'), buildRaw('ok')],
      shard: 'user_locations:istanbul',
      durationMs: 1,
    });
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === 'deleted')
        return Promise.resolve({ id: 'deleted', username: 'x', avatarUrl: null, deletedAt: new Date(), isBanned: false });
      if (where.id === 'banned')
        return Promise.resolve({ id: 'banned', username: 'x', avatarUrl: null, deletedAt: null, isBanned: true });
      return Promise.resolve({ id: where.id, username: 'ok_user', avatarUrl: null, deletedAt: null, isBanned: false });
    });
    const res = await service.getNearbyRiders('v', baseQuery, { city: 'istanbul', partyId: null });
    expect(res.riders.map((r) => r.userId)).toEqual(['ok']);
  });

  it('passes city through to LocationService (Spec 8.3 - sharding)', async () => {
    location.queryNearbyRaw.mockResolvedValue({ riders: [], shard: 'user_locations:ankara', durationMs: 1 });
    await service.getNearbyRiders('v', { ...baseQuery, city: 'ankara' }, { city: 'istanbul', partyId: null });
    expect(location.queryNearbyRaw).toHaveBeenCalledWith(41.0, 29.0, 5000, {
      city: 'ankara',
      limit: 50,
    });
  });
});
