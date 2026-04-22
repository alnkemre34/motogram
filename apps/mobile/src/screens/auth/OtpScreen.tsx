import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OtpVerifySchema, type OtpVerifyDto } from '@motogram/shared';
import { useTranslation } from 'react-i18next';
import { Controller } from 'react-hook-form';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useZodForm } from '../../hooks/useZodForm';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

// Spec 9.2 - OTP (Firebase Auth / Twilio) Faz 1'de UI iskeleti olarak
// hazirlandi; gercek dogrulama Faz 4'te backend /auth/otp akisiyla baglanacak.

export function OtpScreen({ route }: Props) {
  const { t } = useTranslation();
  const { phoneNumber } = route.params;

  const { control, handleSubmit, watch, formState } = useZodForm(OtpVerifySchema, {
    defaultValues: { phoneNumber, code: '' },
  });
  const { errors } = formState;
  const code = watch('code');

  const onSubmit = (data: OtpVerifyDto) => {
    void data;
    // Faz 4: verifyOtpRequest(data)
  };

  const fieldMsg = (key: 'phoneNumber' | 'code') => {
    const msg = errors[key]?.message;
    return typeof msg === 'string' ? t(`auth.errors.${msg}`, msg) : null;
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('auth.otp.title')}</Text>
      <Text style={styles.subtitle}>
        {t('auth.otp.subtitle', { phone: phoneNumber })}
      </Text>

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
          />
        )}
      />
      {fieldMsg('code') ? <Text style={styles.error}>{fieldMsg('code')}</Text> : null}
      {fieldMsg('phoneNumber') ? (
        <Text style={styles.error}>{fieldMsg('phoneNumber')}</Text>
      ) : null}

      <Pressable
        style={[styles.primary, code.length !== 6 ? styles.primaryDisabled : null]}
        disabled={code.length !== 6}
        onPress={handleSubmit(onSubmit)}
      >
        <Text style={styles.primaryText}>{t('auth.otp.verify')}</Text>
      </Pressable>

      <Pressable style={styles.resend}>
        <Text style={styles.link}>{t('auth.otp.resend')}</Text>
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
  primary: {
    backgroundColor: '#ff6a00',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: '#fff', fontWeight: '700' },
  resend: { alignItems: 'center', marginTop: 16 },
  link: { color: '#ff6a00', fontWeight: '600' },
});
