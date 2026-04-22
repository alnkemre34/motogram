import {
  DiscoverFiltersSchema,
  LocationBroadcastSchema,
  MapMarkerSchema,
} from './map.schema';

// Spec 2.3.1 - Harita marker + filtre semalari

describe('MapMarkerSchema', () => {
  it('accepts RIDER/PARTY/EVENT markers with required coords', () => {
    const ok = MapMarkerSchema.safeParse({
      id: 'u1',
      type: 'RIDER',
      lat: 41,
      lng: 29,
      label: 'rider1',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects unknown marker type', () => {
    expect(
      MapMarkerSchema.safeParse({ id: 'x', type: 'NPC', lat: 41, lng: 29 }).success,
    ).toBe(false);
  });
});

describe('DiscoverFiltersSchema', () => {
  it('defaults to NEARBY/5km/empty ridingStyle', () => {
    const parsed = DiscoverFiltersSchema.parse({});
    expect(parsed.filter).toBe('NEARBY');
    expect(parsed.radiusMeters).toBe(5000);
    expect(parsed.ridingStyle).toEqual([]);
  });

  it('caps ridingStyle array length at 10', () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => `style_${i}`);
    expect(DiscoverFiltersSchema.safeParse({ ridingStyle: tooMany }).success).toBe(false);
  });
});

describe('LocationBroadcastSchema', () => {
  it('accepts canonical broadcast payload', () => {
    const ok = LocationBroadcastSchema.safeParse({
      userId: '00000000-0000-0000-0000-000000000001',
      lat: 41.0,
      lng: 29.0,
      heading: 90,
      speed: 20,
      timestamp: Date.now(),
      inParty: true,
    });
    expect(ok.success).toBe(true);
  });
});
