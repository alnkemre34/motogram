import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

type RideLocationServiceNative = {
  start: () => void;
  stop: () => void;
};

const Native: RideLocationServiceNative | undefined = NativeModules.RideLocationService as
  | RideLocationServiceNative
  | undefined;

export function startRideLocationService(): void {
  if (Platform.OS !== 'android') return;
  if (Platform.Version >= 33) {
    void PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
      .then((granted) => {
        if (granted) return true;
        return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).then(
          (r) => r === PermissionsAndroid.RESULTS.GRANTED,
        );
      })
      .finally(() => {
        Native?.start?.();
      });
    return;
  }
  Native?.start?.();
}

export function stopRideLocationService(): void {
  if (Platform.OS !== 'android') return;
  Native?.stop?.();
}

