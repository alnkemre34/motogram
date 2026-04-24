import { useEffect, useRef } from 'react';
import type { ThermalState } from '@motogram/shared';

import { sendLocationUpdate } from '../api/map.api';
import { captureException } from '../lib/sentry';

import { computeLocationIntervalMs } from './useThermalFrequency';

export interface UseLocationBroadcastArgs {
  enabled: boolean;
  lat: number;
  lng: number;
  accuracyMeters?: number;
  heading?: number;
  speed?: number;
  thermalState?: ThermalState;
  city?: string;
  partyId?: string;
  wsPartySendLocation?: (payload: {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
    clientTimestamp: number;
  }) => void;
}

/**
 * Foreground konum yayını: MapLibre `UserLocation` ile gelen son fix'i periyodik REST ile sunucuya iletir.
 * (Expo `watchPositionAsync` yerine interval + ref — Phase 5'te RN geolocation ile sıkılaştırılabilir.)
 */
export function useLocationBroadcast(args: UseLocationBroadcastArgs): void {
  const {
    enabled,
    lat,
    lng,
    accuracyMeters,
    heading,
    speed,
    thermalState = 'NORMAL',
    city,
    partyId,
    wsPartySendLocation,
  } = args;

  const coordsRef = useRef({ lat, lng, accuracyMeters, heading, speed, city });
  coordsRef.current = { lat, lng, accuracyMeters, heading, speed, city };

  useEffect(() => {
    if (!enabled) return;
    const intervalMs = computeLocationIntervalMs(thermalState, enabled);
    if (intervalMs <= 0) return;

    const tick = () => {
      const c = coordsRef.current;
      const now = Date.now();
      if (partyId && wsPartySendLocation) {
        wsPartySendLocation({
          lat: c.lat,
          lng: c.lng,
          heading: c.heading,
          speed: c.speed,
          accuracy: c.accuracyMeters,
          clientTimestamp: now,
        });
      }
      void sendLocationUpdate({
        lat: c.lat,
        lng: c.lng,
        heading: c.heading,
        speed: c.speed,
        accuracy: c.accuracyMeters,
        thermalState,
        city: c.city,
        partyId,
        clientTimestamp: now,
      }).catch((err) => captureException(err));
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [enabled, thermalState, partyId]);
}
