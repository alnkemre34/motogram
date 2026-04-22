import {
  BoundingBoxQuerySchema,
  NearbyQuerySchema,
  NearbyRiderSchema,
  StartLiveSessionSchema,
  UpdateLocationSchema,
  UpdateLocationSharingSchema,
} from './location.schema';

// Spec 7.3.6 - SSOT Zod validation (frontend + backend)
// Spec 3.3.2 - UpdateLocation semasi

describe('UpdateLocationSchema (Spec 3.3.2)', () => {
  it('accepts minimal valid payload', () => {
    const res = UpdateLocationSchema.safeParse({
      lat: 41.0,
      lng: 29.0,
      clientTimestamp: Date.now(),
    });
    expect(res.success).toBe(true);
  });

  it('rejects lat/lng out of WGS84 range', () => {
    expect(UpdateLocationSchema.safeParse({ lat: 91, lng: 29, clientTimestamp: 1 }).success).toBe(false);
    expect(UpdateLocationSchema.safeParse({ lat: 41, lng: 181, clientTimestamp: 1 }).success).toBe(false);
    expect(UpdateLocationSchema.safeParse({ lat: -91, lng: 29, clientTimestamp: 1 }).success).toBe(false);
  });

  it('rejects heading > 360 or negative', () => {
    expect(
      UpdateLocationSchema.safeParse({ lat: 41, lng: 29, heading: 361, clientTimestamp: 1 }).success,
    ).toBe(false);
    expect(
      UpdateLocationSchema.safeParse({ lat: 41, lng: 29, heading: -1, clientTimestamp: 1 }).success,
    ).toBe(false);
  });

  it('rejects impossible speed (motosiklet max ~300 m/s sanity)', () => {
    expect(
      UpdateLocationSchema.safeParse({ lat: 41, lng: 29, speed: 500, clientTimestamp: 1 }).success,
    ).toBe(false);
  });

  it('accepts optional thermalState + partyId', () => {
    const res = UpdateLocationSchema.safeParse({
      lat: 41,
      lng: 29,
      thermalState: 'SERIOUS',
      partyId: '00000000-0000-0000-0000-000000000001',
      clientTimestamp: Date.now(),
    });
    expect(res.success).toBe(true);
  });

  it('rejects non-UUID partyId', () => {
    const res = UpdateLocationSchema.safeParse({
      lat: 41,
      lng: 29,
      partyId: 'not-uuid',
      clientTimestamp: Date.now(),
    });
    expect(res.success).toBe(false);
  });
});

describe('NearbyQuerySchema (Spec 2.3.1, 3.3.3)', () => {
  it('applies defaults (radius=5000, filter=NEARBY, limit=50)', () => {
    const res = NearbyQuerySchema.parse({ lat: 41, lng: 29 });
    expect(res.radius).toBe(5000);
    expect(res.filter).toBe('NEARBY');
    expect(res.limit).toBe(50);
  });

  it('caps radius at 50km', () => {
    expect(
      NearbyQuerySchema.safeParse({ lat: 41, lng: 29, radius: 100_000 }).success,
    ).toBe(false);
  });

  it('rejects unknown filter', () => {
    expect(
      NearbyQuerySchema.safeParse({ lat: 41, lng: 29, filter: 'RANDOM' }).success,
    ).toBe(false);
  });
});

describe('BoundingBoxQuerySchema', () => {
  it('accepts viewport corners', () => {
    const res = BoundingBoxQuerySchema.safeParse({
      swLat: 40.9,
      swLng: 28.9,
      neLat: 41.1,
      neLng: 29.1,
    });
    expect(res.success).toBe(true);
  });
});

describe('NearbyRiderSchema', () => {
  it('requires distance>=0 and uuid userId', () => {
    const bad = NearbyRiderSchema.safeParse({
      userId: 'not-uuid',
      username: 'x',
      lat: 41,
      lng: 29,
      distance: -1,
      lastPingAt: 1,
    });
    expect(bad.success).toBe(false);
  });
});

describe('StartLiveSessionSchema + UpdateLocationSharingSchema', () => {
  it('applies defaults for session start', () => {
    const res = StartLiveSessionSchema.parse({});
    expect(res.source).toBe('GLOBAL_VISIBILITY');
    expect(res.visibility).toBe('FOLLOWERS_ONLY');
    expect(res.expiresInMinutes).toBe(120);
  });

  it('rejects expiresInMinutes > 480 (8h max)', () => {
    expect(
      StartLiveSessionSchema.safeParse({ expiresInMinutes: 600 }).success,
    ).toBe(false);
  });

  it('validates LocationSharingMode enum', () => {
    expect(UpdateLocationSharingSchema.safeParse({ mode: 'PUBLIC' }).success).toBe(true);
    expect(UpdateLocationSharingSchema.safeParse({ mode: 'WEIRD' }).success).toBe(false);
  });
});
