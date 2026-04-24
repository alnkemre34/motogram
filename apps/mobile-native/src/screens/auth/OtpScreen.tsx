import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OtpVerifySchema, type OtpVerifyDto, type OtpVerifyResponse } from '@motogram/shared';
import { useMutation } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { requestOtp, verifyOtp } from '../../api/auth.api';
import { useAuthCapabilities } from '../../hooks/useAuthCapabilities';
import { useZodForm } from '../../hooks/useZodForm';
import { ApiClientError } from '../../lib/api-client';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

export function OtpScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { phoneNumber } = route.params;
  const caps = useAuthCapabilities();
  const [verifyResult, setVerifyResult] = useState<OtpVerifyResponse | null>(null);

  const { control, handleSubmit, watch, formState } = useZodForm(OtpVerifySchema, {
    defaultValues: { phoneNumber, code: '' },
  });
  const { errors } = formState;
  const code = watch('code');

  const verifyM = useMutation({
    mutationFn: verifyOtp,
  });

  const resendM = useMutation({
    mutationFn: requestOtp,
  });

  const serverError =
    verifyM.error instanceof ApiClientError && verifyM.error.body
      ? t(`auth.errors.${verifyM.error.body.error}`, t('common.error'))
      : null;

  const fieldMsg = (key: 'phoneNumber' | 'code') => {
    const msg = errors[key]?.message;
    return typeof msg === 'string' ? t(`auth.errors.${msg}`, msg) : null;
  };

  if (caps.isPending) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color="#ff6a00" />
      </View>
    );
  }

  if (caps.data?.otpAuthEnabled === false) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{t('auth.otp.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.otpRequest.disabled')}</Text>
        <Pressable style={styles.primary} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.primaryText}>{t('auth.otp.goLogin')}</Text>
        </Pressable>
      </View>
    );
  }

  if (verifyResult) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{t('auth.otp.successTitle')}</Text>
        <Text style={styles.subtitle}>
          {verifyResult.phoneVerified ? t('auth.otp.phoneLinked') : t('auth.otp.phoneNotLinked')}
        </Text>
        <Text style={styles.hint}>{t('auth.otp.nextLoginHint')}</Text>
        <Pressable style={styles.primary} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.primaryText}>{t('auth.otp.goLogin')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('auth.otp.title')}</Text>
      <Text style={styles.subtitle}>{t('auth.otp.subtitle', { phone: phoneNumber })}</Text>

      <Controller
        control={control}
        name="code"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
            onBlur={onBlur}
            keyboardType="number-pad"
            placeholder="------"
            placeholderTextColor="#666"
            style={styles.input}
            maxLength={6}
            editable={!verifyM.isPending}
          />
        )}
      />
      {fieldMsg('code') ? <Text style={styles.error}>{fieldMsg('code')}</Text> : null}
      {fieldMsg('phoneNumber') ? <Text style={styles.error}>{fieldMsg('phoneNumber')}</Text> : null}
      {serverError ? <Text style={styles.error}>{serverError}</Text> : null}

      <Pressable
        style={[styles.primary, code.length !== 6 ? styles.primaryDisabled : null]}
        disabled={code.length !== 6 || verifyM.isPending}
        onPress={handleSubmit((data: OtpVerifyDto) => {
          verifyM.mutate(data, {
            onSuccess: (res) => {
              setVerifyResult(res);
            },
          });
        })}
      >
        {verifyM.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{t('auth.otp.verify')}</Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.resend, resendM.isPending ? { opacity: 0.7 } : null]}
        disabled={resendM.isPending || verifyM.isPending}
        onPress={() => resendM.mutate({ phoneNumber })}
      >
        {resendM.isPending ? <ActivityIndicator color="#ff6a00" /> : <Text style={styles.link}>{t('auth.otp.resend')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d', padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  subtitle: { color: '#aaa', marginTop: 8, marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 16,
  },
  error: { color: '#ff5a5a', marginBottom: 12, fontSize: 12 },
  hint: { color: '#888', marginTop: 10, marginBottom: 22, lineHeight: 18 },
  primary: { backgroundColor: '#ff6a00', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: '#fff', fontWeight: '700' },
  resend: { alignItems: 'center', marginTop: 16 },
  link: { color: '#ff6a00', fontWeight: '600' },
});

