import Geolocation, { type GeoPosition } from 'react-native-geolocation-service';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

export interface ForegroundLocationFix {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export type ForegroundLocationStatus = 'idle' | 'requesting' | 'denied' | 'watching' | 'error';

export interface UseForegroundLocationArgs {
  enabled: boolean;
  /** Minimum distance between updates (meters). */
  distanceFilterMeters?: number;
}

export interface UseForegroundLocationResult {
  status: ForegroundLocationStatus;
  fix: ForegroundLocationFix | null;
  error: string | null;
}

async function requestWhenInUsePermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const res = await Geolocation.requestAuthorization('whenInUse');
    return res === 'granted';
  }
  const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return fine === PermissionsAndroid.RESULTS.GRANTED;
}

function toFix(pos: GeoPosition): ForegroundLocationFix {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? undefined,
    heading: pos.coords.heading ?? undefined,
    speed: pos.coords.speed ?? undefined,
    timestamp: typeof pos.timestamp === 'number' ? pos.timestamp : Date.now(),
  };
}

export function useForegroundLocation(args: UseForegroundLocationArgs): UseForegroundLocationResult {
  const { enabled, distanceFilterMeters = 5 } = args;
  const [status, setStatus] = useState<ForegroundLocationStatus>(enabled ? 'requesting' : 'idle');
  const [fix, setFix] = useState<ForegroundLocationFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setStatus('idle');
      return;
    }

    let cancelled = false;

    const start = async () => {
      setStatus('requesting');
      setError(null);
      const granted = await requestWhenInUsePermission();
      if (!granted) {
        if (!cancelled) setStatus('denied');
        return;
      }
      if (cancelled) return;

      setStatus('watching');

      Geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          setFix(toFix(pos));
        },
        (err) => {
          if (cancelled) return;
          setError(err.message);
          setStatus('error');
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5_000 },
      );

      watchIdRef.current = Geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          setFix(toFix(pos));
        },
        (err) => {
          if (cancelled) return;
          setError(err.message);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: distanceFilterMeters,
          interval: 3000,
          fastestInterval: 2000,
          showsBackgroundLocationIndicator: false,
        },
      );
    };

    void start();

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, distanceFilterMeters]);

  return useMemo(() => ({ status, fix, error }), [status, fix, error]);
}

