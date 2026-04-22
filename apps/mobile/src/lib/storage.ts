import { MMKV } from 'react-native-mmkv';

// Spec 3.1 / .cursorrules madde 3 - MMKV kullanilmasi ZORUNLU (AsyncStorage yasak)

export const storage = new MMKV({ id: 'motogram' });

export const StorageKeys = {
  AccessToken: 'auth.accessToken',
  RefreshToken: 'auth.refreshToken',
  Language: 'settings.language',
  UserId: 'auth.userId',
  EulaAccepted: 'auth.eulaAccepted',
  // Faz 2 - Harita & Konum (Spec 2.3, 5.1)
  MapFilter: 'map.filters',
  LocationSharingMode: 'location.sharingMode',
  // Faz 4 - Push notification soft prompt (Spec 9.3, Faz 1 Adim 24)
  PushSoftPromptState: 'push.softPromptState',
} as const;

export const getString = (key: string): string | undefined => storage.getString(key);
export const setString = (key: string, value: string): void => storage.set(key, value);
export const deleteKey = (key: string): void => storage.delete(key);
export const getBoolean = (key: string): boolean | undefined => storage.getBoolean(key);
export const setBoolean = (key: string, value: boolean): void => storage.set(key, value);
