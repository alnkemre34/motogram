import Geolocation from 'react-native-geolocation-service';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

export type IosBackgroundLocationPermissionStatus = 'idle' | 'unknown' | 'requesting' | 'granted' | 'denied';

export interface UseIosBackgroundLocationPermissionArgs {
  enabled: boolean;
}

export interface UseIosBackgroundLocationPermissionResult {
  status: IosBackgroundLocationPermissionStatus;
  canAsk: boolean;
  request: () => Promise<boolean>;
}

export function useIosBackgroundLocationPermission(
  args: UseIosBackgroundLocationPermissionArgs,
): UseIosBackgroundLocationPermissionResult {
  const { enabled } = args;
  const [status, setStatus] = useState<IosBackgroundLocationPermissionStatus>(enabled ? 'unknown' : 'idle');

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    // We cannot reliably "check" iOS Always permission without prompting.
    // Start as unknown and let the user explicitly request via CTA.
    setStatus('unknown');
  }, [enabled]);

  const request = async () => {
    if (Platform.OS !== 'ios') return true;
    setStatus('requesting');
    const res = await Geolocation.requestAuthorization('always');
    const ok = res === 'granted';
    setStatus(ok ? 'granted' : 'denied');
    return ok;
  };

  const canAsk = Platform.OS === 'ios';

  return useMemo(() => ({ status, canAsk, request }), [status, canAsk]);
}

