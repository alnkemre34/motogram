import { create } from 'zustand';
import type { DiscoverFilters, MapFilter, NearbyRider } from '@motogram/shared';

import { StorageKeys, getString, setString } from '../lib/storage';

import { applyDiscoverFiltersPatch, parsePersistedDiscoverFilters } from './map-filters';

interface MapState {
  filters: DiscoverFilters;
  riders: NearbyRider[];
  selectedRiderId: string | null;
  panelOpen: boolean;
  lastQueryDurationMs: number | null;
  setFilter: (filter: MapFilter) => void;
  setRadius: (radiusMeters: number) => void;
  setRiders: (riders: NearbyRider[], durationMs: number) => void;
  selectRider: (id: string | null) => void;
  togglePanel: () => void;
  hydrate: () => void;
}

const DEFAULT_FILTERS: DiscoverFilters = {
  filter: 'NEARBY',
  radiusMeters: 5000,
  ridingStyle: [],
};

export const useMapStore = create<MapState>((set, get) => ({
  filters: DEFAULT_FILTERS,
  riders: [],
  selectedRiderId: null,
  panelOpen: false,
  lastQueryDurationMs: null,
  setFilter: (filter) => {
    const next = applyDiscoverFiltersPatch(get().filters, { filter });
    set({ filters: next });
    setString(StorageKeys.MapFilter, JSON.stringify(next));
  },
  setRadius: (radiusMeters) => {
    const next = applyDiscoverFiltersPatch(get().filters, { radiusMeters });
    set({ filters: next });
    setString(StorageKeys.MapFilter, JSON.stringify(next));
  },
  setRiders: (riders, durationMs) => set({ riders, lastQueryDurationMs: durationMs }),
  selectRider: (id) => set({ selectedRiderId: id }),
  togglePanel: () => set({ panelOpen: !get().panelOpen }),
  hydrate: () => {
    const raw = getString(StorageKeys.MapFilter);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      set({ filters: parsePersistedDiscoverFilters(parsed, DEFAULT_FILTERS) });
    } catch {
      // ignore corrupted persist
    }
  },
}));
