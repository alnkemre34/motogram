import Constants from 'expo-constants';

// Spec 9.5 - Env vars Expo extra'dan okunur (EXPO_PUBLIC_* de destekli)
interface AppEnv {
  apiUrl: string;
  wsUrl: string;                // Spec 3.5 - Socket.IO /realtime namespace
  sentryDsn?: string;
  mapboxAccessToken?: string;  // Spec 9.1 - Mapbox zorunlu, hardcoded yasak
  mapboxStyleUrl: string;       // Spec 9.1 - koyu tema default
  /** R12: `expo.extra.strictSchema` (EAS); true iken parse hata fırlatır — `docs/DEPLOY_RUNBOOK.md`. */
  strictSchema: boolean;
  /** Google id-token akışı — `expo-auth-session` platform uygun client. Boşsa Google butonu gizlenir. */
  googleWebClientId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
}

function deriveWsUrl(apiUrl: string): string {
  try {
    const url = new URL(apiUrl);
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.origin;
  } catch {
    return 'http://localhost:3000';
  }
}

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | boolean | undefined>;

const apiUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (typeof extra.apiUrl === 'string' ? extra.apiUrl : undefined) ??
  'http://localhost:3000/v1';

export const env: AppEnv = {
  apiUrl,
  wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? (typeof extra.wsUrl === 'string' ? extra.wsUrl : undefined) ?? deriveWsUrl(apiUrl),
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? (typeof extra.sentryDsn === 'string' ? extra.sentryDsn : undefined),
  mapboxAccessToken:
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? (typeof extra.mapboxAccessToken === 'string' ? extra.mapboxAccessToken : undefined),
  // Spec 9.1 - minimalist / yuksek kontrast / koyu zemin. Custom NFS-tarzi tema
  // ileride Mapbox Studio'da uretilip bu URL buraya yapistirilir.
  mapboxStyleUrl:
    process.env.EXPO_PUBLIC_MAPBOX_STYLE ??
    (typeof extra.mapboxStyleUrl === 'string' ? extra.mapboxStyleUrl : undefined) ??
    'mapbox://styles/mapbox/dark-v11',
  strictSchema: extra.strictSchema === true,
  googleWebClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
    (typeof extra.googleWebClientId === 'string' ? extra.googleWebClientId : undefined),
  googleIosClientId:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
    (typeof extra.googleIosClientId === 'string' ? extra.googleIosClientId : undefined),
  googleAndroidClientId:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
    (typeof extra.googleAndroidClientId === 'string' ? extra.googleAndroidClientId : undefined),
};
