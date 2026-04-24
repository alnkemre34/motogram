import { MMKV } from 'react-native-mmkv';

// Keep MMKV (AsyncStorage is forbidden in repo conventions).
export const storage = new MMKV({ id: 'motogram' });

export const StorageKeys = {
  AccessToken: 'auth.accessToken',
  RefreshToken: 'auth.refreshToken',
  Language: 'settings.language',
  UserId: 'auth.userId',
  EulaAccepted: 'auth.eulaAccepted',
  // Map & location
  MapFilter: 'map.filters',
  LocationSharingMode: 'location.sharingMode',
  // Push prompt state
  PushSoftPromptState: 'push.softPromptState',
  // Push device token (platform-specific token value, e.g. EXPO/FCM/APNs)
  PushToken: 'push.token',
} as const;

export const getString = (key: string): string | undefined => storage.getString(key);
export const setString = (key: string, value: string): void => storage.set(key, value);
export const deleteKey = (key: string): void => storage.delete(key);
export const getBoolean = (key: string): boolean | undefined => storage.getBoolean(key);
export const setBoolean = (key: string, value: boolean): void => storage.set(key, value);

