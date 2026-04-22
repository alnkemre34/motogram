import type { NearbyRider } from '@motogram/shared';

import { applyMarkerUpdate, pruneStaleMarkers } from './markers';

// Spec 7.1.1 - Optimistic UI pure function testi (native module gerekmez)
// Spec 7.3.3 - Client-side zombi cleanup

function rider(overrides: Partial<NearbyRider>): NearbyRider {
  return {
    userId: 'u',
    username: 'test',
    avatarUrl: null,
    lat: 41,
    lng: 29,
    distance: 100,
    inParty: false,
    partyId: null,
    heading: null,
    lastPingAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('applyMarkerUpdate (Spec 7.1.1)', () => {
  it('overwrites lat/lng/heading for existing rider (immutably)', () => {
    const before: NearbyRider[] = [rider({ userId: 'u1' }), rider({ userId: 'u2' })];
    const after = applyMarkerUpdate(before, {
      userId: 'u1',
      lat: 41.5,
      lng: 29.5,
      heading: 180,
      distance: 50,
      lastPingAt: 1_700_000_500_000,
    });
    expect(after).not.toBe(before);
    expect(after[0]).not.toBe(before[0]);
    expect(after[0]!.lat).toBe(41.5);
    expect(after[0]!.lng).toBe(29.5);
    expect(after[0]!.heading).toBe(180);
    expect(after[1]).toBe(before[1]); // diger referans degismez
  });

  it('removes rider when update.removed=true', () => {
    const before: NearbyRider[] = [rider({ userId: 'u1' }), rider({ userId: 'u2' })];
    const after = applyMarkerUpdate(before, {
      userId: 'u1',
      lat: 0,
      lng: 0,
      removed: true,
    });
    expect(after.map((r) => r.userId)).toEqual(['u2']);
  });

  it('does not mutate original array or items', () => {
    const before: NearbyRider[] = [rider({ userId: 'u1', lat: 41 })];
    const snapshot = JSON.parse(JSON.stringify(before));
    applyMarkerUpdate(before, { userId: 'u1', lat: 42, lng: 29 });
    expect(before).toEqual(snapshot);
  });

  it('no-op for unknown userId when lastPingAt absent (Kural 5 - no mock data)', () => {
    const before: NearbyRider[] = [rider({ userId: 'u1' })];
    const after = applyMarkerUpdate(before, { userId: 'ghost', lat: 0, lng: 0 });
    expect(after).toEqual(before);
    expect(after).not.toBe(before); // yine de copy (referential immutability)
  });

  it('preserves existing fields when update omits optional ones', () => {
    const before: NearbyRider[] = [
      rider({ userId: 'u1', inParty: true, partyId: 'p1', heading: 90 }),
    ];
    const after = applyMarkerUpdate(before, { userId: 'u1', lat: 41.1, lng: 29.1 });
    expect(after[0]!.inParty).toBe(true);
    expect(after[0]!.partyId).toBe('p1');
    expect(after[0]!.heading).toBe(90);
  });
});

describe('pruneStaleMarkers (Spec 7.3.3)', () => {
  it('filters markers older than 5 minutes', () => {
    const now = Date.now();
    const fresh = rider({ userId: 'fresh', lastPingAt: now - 60_000 });
    const stale = rider({ userId: 'stale', lastPingAt: now - 6 * 60_000 });
    const result = pruneStaleMarkers([fresh, stale], now);
    expect(result.map((m) => m.userId)).toEqual(['fresh']);
  });

  it('respects custom TTL', () => {
    const now = Date.now();
    const r = rider({ userId: 'x', lastPingAt: now - 10_000 });
    expect(pruneStaleMarkers([r], now, 5_000)).toEqual([]);
    expect(pruneStaleMarkers([r], now, 30_000)).toEqual([r]);
  });
});
