import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MapFilter } from '@motogram/shared';

import { fetchNearbyRiders } from '../api/map.api';
import { useMapStore } from '../store/map.store';

// Spec 2.3.1 - Filtre degisiminde harita yeni pinleri otomatik yukler.
// react-query cache + skeleton loader UI tarafinda (isFetching) okunur.

export interface UseNearbyRidersArgs {
  lat: number | null;
  lng: number | null;
  city?: string;
  filter: MapFilter;
  radiusMeters: number;
  enabled?: boolean;
}

export function useNearbyRiders(args: UseNearbyRidersArgs) {
  const setRiders = useMapStore((s) => s.setRiders);
  const { lat, lng, filter, radiusMeters, city, enabled = true } = args;

  const query = useQuery({
    queryKey: ['map', 'nearby', lat, lng, radiusMeters, filter, city ?? null] as const,
    enabled: enabled && lat !== null && lng !== null,
    queryFn: () =>
      fetchNearbyRiders({
        lat: lat as number,
        lng: lng as number,
        radius: radiusMeters,
        filter,
        city,
      }),
    staleTime: 5_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (query.data) {
      setRiders(query.data.riders, query.data.queryDurationMs);
    }
  }, [query.data, setRiders]);

  return query;
}
