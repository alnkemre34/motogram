import { DiscoverFiltersSchema, type DiscoverFilters } from '@motogram/shared';

/** Mevcut filtre + yama; shared semaya uymuyorsa `current` korunur. */
export function applyDiscoverFiltersPatch(
  current: DiscoverFilters,
  patch: Partial<DiscoverFilters>,
): DiscoverFilters {
  const merged = { ...current, ...patch };
  const r = DiscoverFiltersSchema.safeParse(merged);
  return r.success ? r.data : current;
}

/** MMKV / JSON hydrate — gecersizse `fallback`. */
export function parsePersistedDiscoverFilters(raw: unknown, fallback: DiscoverFilters): DiscoverFilters {
  if (!raw || typeof raw !== 'object') return fallback;
  const r = DiscoverFiltersSchema.safeParse({ ...fallback, ...(raw as object) });
  return r.success ? r.data : fallback;
}
