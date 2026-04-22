import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { ThermalState } from '@motogram/shared';

import { sendLocationUpdate } from '../api/map.api';
import { captureException } from '../lib/sentry';
import { computeLocationIntervalMs } from './useThermalFrequency';

// Spec 2.3 + 3.3.2 - Kesif modunda kullanicinin konumu:
// - Foreground izin (Faz 2 varsayilan; background izin Faz 3 parti modunda)
// - Termal duruma gore frekans (Spec 7.1.2)
// - REST PUT /location/update (Faz 2 REST, Faz 3'te Socket.IO emit)
// - Network hatasi icin Sentry'e bildir, UI bozma (zombi veri 5dk sonra sunucu tarafinda silinir - Spec 7.3.3)

export interface UseLocationBroadcastArgs {
  enabled: boolean;           // paylasim acik mi
  partyId?: string;           // Faz 3'te aktif
  thermalState?: ThermalState;
  city?: string;
}

export interface LocationBroadcastState {
  lastPosition: Location.LocationObject | null;
  lastError: string | null;
  status: 'idle' | 'requesting_permission' | 'broadcasting' | 'paused' | 'denied';
}

export function useLocationBroadcast(args: UseLocationBroadcastArgs) {
  const { enabled, partyId, thermalState = 'NORMAL', city } = args;
  const [state, setState] = useState<LocationBroadcastState>({
    lastPosition: null,
    lastError: null,
    status: enabled ? 'requesting_permission' : 'idle',
  });

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastSentRef = useRef<number>(0);

  const stop = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    setState((prev) => ({ ...prev, status: 'paused' }));
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    let cancelled = false;

    const start = async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          setState((prev) => ({ ...prev, status: 'denied', lastError: 'permission_denied' }));
          return;
        }
        if (cancelled) return;

        const intervalMs = computeLocationIntervalMs(thermalState, enabled);
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: intervalMs,
            distanceInterval: 5,
          },
          async (pos) => {
            setState((prev) => ({ ...prev, lastPosition: pos, status: 'broadcasting' }));
            const now = Date.now();
            if (now - lastSentRef.current < intervalMs) return; // client-side debounce
            lastSentRef.current = now;

            try {
              await sendLocationUpdate({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                heading: pos.coords.heading ?? undefined,
                speed: pos.coords.speed ?? undefined,
                accuracy: pos.coords.accuracy ?? undefined,
                thermalState,
                city,
                partyId,
                clientTimestamp: now,
              });
            } catch (err) {
              captureException(err);
              setState((prev) => ({
                ...prev,
                lastError: err instanceof Error ? err.message : String(err),
              }));
            }
          },
        );
        watchRef.current = sub;
      } catch (err) {
        captureException(err);
        setState((prev) => ({
          ...prev,
          status: 'paused',
          lastError: err instanceof Error ? err.message : String(err),
        }));
      }
    };

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, thermalState, partyId, city, stop]);

  return state;
}
