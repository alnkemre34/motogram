import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OtpRequestSchema, type OtpRequestDto } from '@motogram/shared';
import { useMutation } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { requestOtp } from '../../api/auth.api';
import { useAuthCapabilities } from '../../hooks/useAuthCapabilities';
import { useZodForm } from '../../hooks/useZodForm';
import { ApiClientError } from '../../lib/api-client';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'OtpRequest'>;

export function OtpRequestScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const caps = useAuthCapabilities();

  const { control, handleSubmit, formState, watch } = useZodForm(OtpRequestSchema, {
    defaultValues: { phoneNumber: '' },
  });
  const { errors } = formState;
  const phoneNumber = watch('phoneNumber');

  const mutation = useMutation({
    mutationFn: requestOtp,
    onSuccess: (_, vars) => navigation.navigate('Otp', { phoneNumber: vars.phoneNumber }),
  });

  const serverError =
    mutation.error instanceof ApiClientError && mutation.error.body
      ? t(`auth.errors.${mutation.error.body.error}`, t('common.error'))
      : null;

  const fieldMsg = (key: keyof OtpRequestDto) => {
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

  if (caps.isError) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{t('auth.otpRequest.title')}</Text>
        <Text style={styles.subtitle}>{t('common.error')}</Text>
        <Pressable style={styles.primary} onPress={() => void caps.refetch()}>
          <Text style={styles.primaryText}>{t('common.retry')}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => navigation.goBack()}>
          <Text style={styles.link}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  if (caps.data && caps.data.otpAuthEnabled === false) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{t('auth.otpRequest.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.otpRequest.disabled')}</Text>
        <Pressable style={styles.secondary} onPress={() => navigation.goBack()}>
          <Text style={styles.link}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('auth.otpRequest.title')}</Text>
      <Text style={styles.subtitle}>{t('auth.otpRequest.subtitle')}</Text>

      <Controller
        control={control}
        name="phoneNumber"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={(v) => onChange(v.trim())}
            onBlur={onBlur}
            placeholder={t('auth.otpRequest.phonePlaceholder')}
            placeholderTextColor="#666"
            autoCapitalize="none"
            keyboardType="phone-pad"
            style={styles.input}
          />
        )}
      />
      {fieldMsg('phoneNumber') ? <Text style={styles.error}>{fieldMsg('phoneNumber')}</Text> : null}
      {serverError ? <Text style={styles.error}>{serverError}</Text> : null}

      <Pressable
        style={[styles.primary, mutation.isPending ? styles.primaryDisabled : null]}
        onPress={handleSubmit((dto) => mutation.mutate(dto))}
        disabled={mutation.isPending || phoneNumber.trim().length === 0}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{t('auth.otpRequest.sendCode')}</Text>
        )}
      </Pressable>

      <Pressable style={styles.secondary} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>{t('common.back')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d', padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  subtitle: { color: '#aaa', marginTop: 8, marginBottom: 24, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: '#fff',
    marginBottom: 10,
  },
  error: { color: '#ff5a5a', marginBottom: 12, fontSize: 12 },
  primary: { backgroundColor: '#ff6a00', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondary: { alignItems: 'center', marginTop: 16 },
  link: { color: '#ff6a00', fontWeight: '600' },
});

