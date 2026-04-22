import type { DiscoverFilters } from '@motogram/shared';

import { applyDiscoverFiltersPatch, parsePersistedDiscoverFilters } from './map-filters';

const base: DiscoverFilters = {
  filter: 'NEARBY',
  radiusMeters: 5000,
  ridingStyle: [],
};

describe('map-filters (DiscoverFiltersSchema, R6)', () => {
  it('applyDiscoverFiltersPatch updates filter', () => {
    const next = applyDiscoverFiltersPatch(base, { filter: 'FRIENDS' });
    expect(next.filter).toBe('FRIENDS');
    expect(next.radiusMeters).toBe(5000);
  });

  it('applyDiscoverFiltersPatch rejects invalid radius and keeps current', () => {
    const next = applyDiscoverFiltersPatch(base, { radiusMeters: 999_999 });
    expect(next).toEqual(base);
  });

  it('parsePersistedDiscoverFilters merges valid JSON', () => {
    const next = parsePersistedDiscoverFilters({ filter: 'EVENTS', radiusMeters: 8000 }, base);
    expect(next.filter).toBe('EVENTS');
    expect(next.radiusMeters).toBe(8000);
  });

  it('parsePersistedDiscoverFilters falls back on garbage', () => {
    expect(parsePersistedDiscoverFilters({ radiusMeters: -1 }, base)).toEqual(base);
  });
});
