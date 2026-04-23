import { Platform } from 'react-native';

import { env } from '../config/env';

/** Google id token isteği için o platform client id gerekir — `expo-auth-session` zorunluluğu. */
export function isGoogleIdTokenAvailable(): boolean {
  if (Platform.OS === 'ios') return Boolean(env.googleIosClientId);
  if (Platform.OS === 'android') return Boolean(env.googleAndroidClientId);
  return Boolean(env.googleWebClientId);
}
