import { useEffect, useRef } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { googleSignInRequest } from '../../api/auth.api';
import { env } from '../../config/env';
import { isGoogleIdTokenAvailable } from '../../lib/google-oauth';
import { useAuthStore } from '../../store/auth.store';
import { mapAuthErrorToMessage } from './map-auth-error';

// Blueprint §6 - Google: POST /v1/auth/oauth/google + GoogleSignInSchema

type Props = {
  eulaAccepted: boolean;
  onBusyChange?: (busy: boolean) => void;
  onError: (message: string) => void;
};

/**
 * Sadece ilgili platform için `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` tanımlıysa mount edilir
 * ( `useIdTokenAuthRequest` client id yokken throw eder).
 */
export function GoogleSignInButtonIfConfigured(props: Props) {
  if (!isGoogleIdTokenAvailable()) return null;
  return <GoogleSignInButtonInner {...props} />;
}

function GoogleSignInButtonInner({ eulaAccepted, onBusyChange, onError }: Props) {
  const { t, i18n } = useTranslation();
  const setSession = useAuthStore((s) => s.setSession);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: env.googleWebClientId,
    iosClientId: env.googleIosClientId,
    androidClientId: env.googleAndroidClientId,
  });

  const preferredLanguage = i18n.language?.startsWith('en') ? 'en' : 'tr';
  const lastHandledId = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    if (response.type === 'dismiss' || response.type === 'cancel' || response.type === 'error') {
      onBusyChange?.(false);
      if (response.type === 'error' && 'error' in response && response.error) {
        onError(String(response.error));
      }
      return;
    }
    if (response.type !== 'success' || !('params' in response)) {
      onBusyChange?.(false);
      return;
    }
    const idToken = response.params.id_token;
    if (typeof idToken !== 'string' || idToken.length < 10) {
      onError(t('auth.errors.google_token_invalid'));
      onBusyChange?.(false);
      return;
    }
    if (lastHandledId.current === idToken) return;
    lastHandledId.current = idToken;
    (async () => {
      onBusyChange?.(true);
      try {
        const data = await googleSignInRequest({
          idToken,
          eulaAccepted: true,
          preferredLanguage,
        });
        setSession(data.userId, data.tokens);
      } catch (e) {
        onError(mapAuthErrorToMessage(e, t));
      } finally {
        onBusyChange?.(false);
      }
    })();
  }, [response, onError, onBusyChange, setSession, t, preferredLanguage]);

  return (
    <Pressable
      style={({ pressed }) => [styles.gBtn, pressed && styles.pressed]}
      disabled={!request || !eulaAccepted}
      onPress={() => {
        if (!eulaAccepted) return;
        onBusyChange?.(true);
        void promptAsync();
      }}
      accessibilityRole="button"
      accessibilityLabel={t('auth.social.google')}
    >
      {request == null ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.gText}>{t('auth.social.google')}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  gText: { color: '#fff', fontWeight: '700' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
