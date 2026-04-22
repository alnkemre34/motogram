import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RegisterSchema } from '@motogram/shared';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Controller } from 'react-hook-form';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { registerRequest } from '../../api/auth.api';
import { useZodForm } from '../../hooks/useZodForm';
import { ApiClientError } from '../../lib/api-client';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuthStore } from '../../store/auth.store';
import { RegisterScreenFormSchema } from './auth-form.schemas';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

// Spec 9.2 - EULA kabulu ZORUNLU (App Store UGC kurali).

export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const setSession = useAuthStore((s) => s.setSession);

  const { control, handleSubmit, formState } = useZodForm(RegisterScreenFormSchema, {
    defaultValues: {
      email: '',
      username: '',
      password: '',
      name: '',
      eulaAccepted: false,
      preferredLanguage: 'tr',
    },
  });
  const { errors } = formState;

  const mutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: (data) => setSession(data.userId, data.tokens),
  });

  const serverError =
    mutation.error instanceof ApiClientError && mutation.error.body
      ? t(`auth.errors.${mutation.error.body.error}`, t('common.error'))
      : null;

  const fieldMsg = (key: 'email' | 'username' | 'password' | 'name' | 'eulaAccepted') => {
    const msg = errors[key]?.message;
    return typeof msg === 'string' ? t(`auth.errors.${msg}`, msg) : null;
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('auth.register.title')}</Text>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={t('auth.register.email')}
            placeholderTextColor="#666"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        )}
      />
      {fieldMsg('email') ? <Text style={styles.fieldError}>{fieldMsg('email')}</Text> : null}

      <Controller
        control={control}
        name="username"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={t('auth.register.username')}
            placeholderTextColor="#666"
            autoCapitalize="none"
            style={styles.input}
          />
        )}
      />
      {fieldMsg('username') ? <Text style={styles.fieldError}>{fieldMsg('username')}</Text> : null}

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={t('auth.register.password')}
            placeholderTextColor="#666"
            secureTextEntry
            style={styles.input}
          />
        )}
      />
      {fieldMsg('password') ? <Text style={styles.fieldError}>{fieldMsg('password')}</Text> : null}

      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={t('auth.register.name')}
            placeholderTextColor="#666"
            style={styles.input}
          />
        )}
      />
      {fieldMsg('name') ? <Text style={styles.fieldError}>{fieldMsg('name')}</Text> : null}

      <Controller
        control={control}
        name="eulaAccepted"
        render={({ field: { value, onChange } }) => (
          <Pressable style={styles.eulaRow} onPress={() => onChange(!value)}>
            <View style={[styles.checkbox, value ? styles.checkboxOn : null]} />
            <Text style={styles.eulaText}>{t('auth.register.eula')}</Text>
          </Pressable>
        )}
      />
      {fieldMsg('eulaAccepted') ? (
        <Text style={styles.fieldError}>{fieldMsg('eulaAccepted')}</Text>
      ) : null}

      {serverError ? <Text style={styles.error}>{serverError}</Text> : null}

      <Pressable
        style={styles.primary}
        onPress={handleSubmit((form) =>
          mutation.mutate(
            RegisterSchema.parse({
              email: form.email,
              username: form.username,
              password: form.password,
              name: form.name ? form.name : undefined,
              eulaAccepted: true,
              preferredLanguage: form.preferredLanguage,
            }),
          ),
        )}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{t('auth.register.submit')}</Text>
        )}
      </Pressable>

      <View style={styles.switchRow}>
        <Text style={styles.muted}>{t('auth.register.hasAccount')} </Text>
        <Pressable onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>{t('auth.register.goLogin')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d', padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 24 },
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
  eulaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 12 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#666',
    marginRight: 10,
  },
  checkboxOn: { backgroundColor: '#ff6a00', borderColor: '#ff6a00' },
  eulaText: { color: '#ddd', flex: 1 },
  error: { color: '#ff5a5a', marginBottom: 12 },
  primary: {
    backgroundColor: '#ff6a00',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  muted: { color: '#888' },
  link: { color: '#ff6a00', fontWeight: '600' },
});
