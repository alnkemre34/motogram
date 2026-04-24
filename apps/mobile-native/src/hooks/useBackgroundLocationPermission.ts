import { useEffect, useMemo, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

export type BackgroundLocationPermissionStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

export interface UseBackgroundLocationPermissionArgs {
  enabled: boolean;
}

export interface UseBackgroundLocationPermissionResult {
  status: BackgroundLocationPermissionStatus;
  canAsk: boolean;
  request: () => Promise<boolean>;
}

async function checkGranted(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version < 29) return true; // Android < 10: background permission not separate
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
}

async function requestBackground(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version < 29) return true;
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export function useBackgroundLocationPermission(
  args: UseBackgroundLocationPermissionArgs,
): UseBackgroundLocationPermissionResult {
  const { enabled } = args;
  const [status, setStatus] = useState<BackgroundLocationPermissionStatus>(enabled ? 'requesting' : 'idle');

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    const run = async () => {
      if (Platform.OS !== 'android') {
        setStatus('unavailable');
        return;
      }
      setStatus('requesting');
      const ok = await checkGranted();
      if (cancelled) return;
      setStatus(ok ? 'granted' : 'denied');
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const request = async () => {
    setStatus('requesting');
    const ok = await requestBackground();
    setStatus(ok ? 'granted' : 'denied');
    return ok;
  };

  const canAsk = Platform.OS === 'android' && Platform.Version >= 29;

  return useMemo(() => ({ status, canAsk, request }), [status, canAsk]);
}

