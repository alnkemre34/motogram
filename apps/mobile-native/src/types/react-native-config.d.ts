declare module 'react-native-config' {
  /** Keys read in `src/config/env.ts` (see root `.env.example` mobile section). */
  interface NativeConfig {
    API_URL?: string;
    WS_URL?: string;
    MAP_STYLE_URL?: string;
    SENTRY_DSN?: string;
    STRICT_SCHEMA?: string;
    GOOGLE_WEB_CLIENT_ID?: string;
    GOOGLE_IOS_CLIENT_ID?: string;
    GOOGLE_ANDROID_CLIENT_ID?: string;
  }
  const Config: NativeConfig;
  export default Config;
}

declare module 'react-native-video';
