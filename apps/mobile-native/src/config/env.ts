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

const apiUrl = (Config.API_URL || 'http://localhost:3000/v1') as string;

function optionalString(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

export const env: AppEnv = {
  apiUrl,
  wsUrl: (Config.WS_URL || deriveWsUrl(apiUrl)) as string,
  mapStyleUrl: (optionalString(Config.MAP_STYLE_URL) ?? DEMO_MAP_STYLE) as string,
  sentryDsn: optionalString(Config.SENTRY_DSN),
  strictSchema: (Config.STRICT_SCHEMA === 'true') as boolean,
  googleWebClientId: optionalString(Config.GOOGLE_WEB_CLIENT_ID),
  googleIosClientId: optionalString(Config.GOOGLE_IOS_CLIENT_ID),
  googleAndroidClientId: optionalString(Config.GOOGLE_ANDROID_CLIENT_ID),
};

