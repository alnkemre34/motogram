import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Controller } from 'react-hook-form';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { loginRequest } from '../../api/auth.api';
import { useAuthCapabilities } from '../../hooks/useAuthCapabilities';
import { useZodForm } from '../../hooks/useZodForm';
import { ApiClientError } from '../../lib/api-client';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuthStore } from '../../store/auth.store';
import { LoginFormSchema } from './auth-form.schemas';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const caps = useAuthCapabilities();
  const otpEnabled = caps.data?.otpAuthEnabled === true;
  const setSession = useAuthStore((s) => s.setSession);

  const { control, handleSubmit, formState } = useZodForm(LoginFormSchema, {
    defaultValues: { identifier: '', password: '' },
  });
  const { errors } = formState;

  const mutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: (data) => setSession(data.userId, data.tokens),
  });

  const serverError =
    mutation.error instanceof ApiClientError && mutation.error.body
      ? t(`auth.errors.${mutation.error.body.error}`, t('common.error'))
      : null;

  const fieldError = (key: 'identifier' | 'password') => {
    const msg = errors[key]?.message;
    return msg ? t(`auth.errors.${msg}`, msg) : null;
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('auth.login.title')}</Text>
      {route.params?.postRegisterHint ? (
        <Text style={styles.banner}>{t('auth.login.postRegisterHint')}</Text>
      ) : null}

      <Controller
        control={control}
        name="identifier"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={t('auth.login.identifier')}
            placeholderTextColor="#666"
            autoCapitalize="none"
            style={styles.input}
          />
        )}
      />
      {fieldError('identifier') ? <Text style={styles.fieldError}>{fieldError('identifier')}</Text> : null}

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={t('auth.login.password')}
            placeholderTextColor="#666"
            secureTextEntry
            style={styles.input}
          />
        )}
      />
      {fieldError('password') ? <Text style={styles.fieldError}>{fieldError('password')}</Text> : null}

      {serverError ? <Text style={styles.error}>{serverError}</Text> : null}

      <Pressable
        style={styles.primary}
        onPress={handleSubmit((data) => mutation.mutate(data))}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('auth.login.submit')}</Text>}
      </Pressable>

      {otpEnabled ? (
        <Pressable style={styles.otpBtn} onPress={() => navigation.navigate('OtpRequest')} disabled={mutation.isPending}>
          <Text style={styles.otpText}>{t('auth.login.useOtp')}</Text>
        </Pressable>
      ) : null}

      <View style={styles.switchRow}>
        <Text style={styles.muted}>{t('auth.login.noAccount')} </Text>
        <Pressable onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>{t('auth.login.goRegister')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d', padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 24 },
  banner: {
    color: '#b8e986',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: '#fff',
    marginBottom: 12,
  },
  fieldError: { color: '#ff5a5a', marginTop: -8, marginBottom: 8, fontSize: 12 },
  error: { color: '#ff5a5a', marginBottom: 12 },
  primary: {
    backgroundColor: '#ff6a00',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  otpBtn: { alignItems: 'center', marginTop: 14 },
  otpText: { color: '#ff6a00', fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  muted: { color: '#888' },
  link: { color: '#ff6a00', fontWeight: '600' },
});

