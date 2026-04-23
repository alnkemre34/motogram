import { useCallback, useEffect, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { appleSignInRequest } from '../../api/auth.api';
import { isGoogleIdTokenAvailable } from '../../lib/google-oauth';
import { useAuthStore } from '../../store/auth.store';
import { GoogleSignInButtonIfConfigured } from './GoogleSignInButton';
import { mapAuthErrorToMessage } from './map-auth-error';

// FRONTEND_UI_UX_BLUEPRINT §6 — AppleSignInSchema, GoogleSignInSchema, EULA (literal true)

type Props = {
  eulaSatisfiedByParent?: boolean;
};

export function SocialAuthBlock({ eulaSatisfiedByParent = false }: Props) {
  const { t, i18n } = useTranslation();
  const setSession = useAuthStore((s) => s.setSession);
  const [appleSupported, setAppleSupported] = useState<boolean | null>(null);
  const [oauthEula, setOauthEula] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);
  const [outerBusy, setOuterBusy] = useState(false);

  const eulaForApi = eulaSatisfiedByParent || oauthEula;
  const preferredLanguage = i18n.language?.startsWith('en') ? 'en' : 'tr';
  const hasGoogle = isGoogleIdTokenAvailable();

  useEffect(() => {
    void AppleAuthentication.isAvailableAsync().then(setAppleSupported);
  }, []);

  const appleMutation = useMutation({
    mutationFn: async () => {
      if (!eulaForApi) {
        throw new Error('eula');
      }
      try {
        const cred = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!cred.identityToken) {
          throw new Error('no_token');
        }
        return appleSignInRequest({
          identityToken: cred.identityToken,
          authorizationCode: cred.authorizationCode ?? undefined,
          fullName: cred.fullName
            ? {
                givenName: cred.fullName.givenName,
                familyName: cred.fullName.familyName,
              }
            : undefined,
          email: cred.email ?? undefined,
          eulaAccepted: true,
          preferredLanguage,
        });
      } catch (e: unknown) {
        if (
          e &&
          typeof e === 'object' &&
          'code' in e &&
          (e as { code: string }).code === 'ERR_REQUEST_CANCELED'
        ) {
          throw new Error('canceled');
        }
        throw e;
      }
    },
    onSuccess: (data) => {
      setSession(data.userId, data.tokens);
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === 'canceled') {
        setErrorLine(null);
        return;
      }
      if (e instanceof Error) {
        if (e.message === 'eula') {
          setErrorLine(t('auth.errors.eula_required'));
          return;
        }
        if (e.message === 'no_token') {
          setErrorLine(t('auth.errors.apple_token_invalid'));
          return;
        }
      }
      setErrorLine(mapAuthErrorToMessage(e, t));
    },
  });

  const onApple = useCallback(() => {
    setErrorLine(null);
    if (!eulaForApi) {
      setErrorLine(t('auth.errors.eula_required'));
      return;
    }
    appleMutation.mutate();
  }, [eulaForApi, appleMutation, t]);

  const showApple = appleSupported === true;
  const hasAnySocial = showApple || hasGoogle;

  if (appleSupported === null) {
    return null;
  }

  if (!hasAnySocial) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {!eulaSatisfiedByParent ? (
        <View style={styles.eulaRow}>
          <Switch
            value={oauthEula}
            onValueChange={setOauthEula}
            trackColor={{ false: '#333', true: '#ff6a00' }}
            accessibilityLabel={t('auth.social.eulaA11y')}
          />
          <Text style={styles.eulaText}>{t('auth.register.eula')}</Text>
        </View>
      ) : null}

      {errorLine ? <Text style={styles.error}>{errorLine}</Text> : null}

      <View style={styles.rowGap}>
        {showApple ? (
          <Pressable
            onPress={onApple}
            disabled={!eulaForApi || appleMutation.isPending || outerBusy}
            style={({ pressed }) => [styles.appleBtn, !eulaForApi && styles.btnDisabled, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('auth.social.apple')}
          >
            {appleMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.appleText}>{t('auth.social.apple')}</Text>
            )}
          </Pressable>
        ) : null}

        <GoogleSignInButtonIfConfigured
          eulaAccepted={eulaForApi}
          onBusyChange={setOuterBusy}
          onError={setErrorLine}
        />
      </View>

      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>{t('auth.social.or')}</Text>
        <View style={styles.orLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  eulaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  eulaText: { color: '#ccc', flex: 1, fontSize: 12 },
  error: { color: '#ff6a6a', marginBottom: 8, fontSize: 13 },
  rowGap: { gap: 10 },
  appleBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  btnDisabled: { opacity: 0.45 },
  appleText: { color: '#fff', fontWeight: '700' },
  pressed: { transform: [{ scale: 0.99 }] },
  orRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8, gap: 8 },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  orText: { color: '#666', fontSize: 12, fontWeight: '600' },
});
