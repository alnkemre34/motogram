import Config from 'react-native-config';

// RN CLI env:
// - reads from react-native-config (.env files / native build env)
// - falls back to safe defaults for local dev
const DEMO_MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

interface AppEnv {
  apiUrl: string;
  wsUrl: string;
  /** MapLibre style URL (JSON). Dev default: MapLibre demo tiles (no key). */
  mapStyleUrl: string;
  sentryDsn?: string;
  strictSchema: boolean;
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

const apiUrl = (Config.API_URL || Config.EXPO_PUBLIC_API_URL || 'http://localhost:3000/v1') as string;

export const env: AppEnv = {
  apiUrl,
  wsUrl: (Config.WS_URL || Config.EXPO_PUBLIC_WS_URL || deriveWsUrl(apiUrl)) as string,
  mapStyleUrl: (Config.MAP_STYLE_URL || Config.EXPO_PUBLIC_MAP_STYLE_URL || DEMO_MAP_STYLE) as string,
  sentryDsn: (Config.SENTRY_DSN || Config.EXPO_PUBLIC_SENTRY_DSN) as string | undefined,
  strictSchema: (Config.STRICT_SCHEMA === 'true') as boolean,
  googleWebClientId: (Config.GOOGLE_WEB_CLIENT_ID || Config.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) as string | undefined,
  googleIosClientId: (Config.GOOGLE_IOS_CLIENT_ID || Config.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) as string | undefined,
  googleAndroidClientId: (Config.GOOGLE_ANDROID_CLIENT_ID || Config.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) as
    | string
    | undefined,
};

