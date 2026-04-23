import { zodResolver } from '@hookform/resolvers/zod';
import { ChangeEmailRequestSchema, PasswordSchema } from '@motogram/shared';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { requestEmailChange } from '../../api/auth.api';
import { StackScreenHeader } from '../../components/StackScreenHeader';

const FormSchema = z.object({
  newEmail: ChangeEmailRequestSchema.shape.newEmail,
  password: PasswordSchema,
});
type FormValues = z.infer<typeof FormSchema>;

export function ChangeEmailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { newEmail: '', password: '' },
  });

  const m = useMutation({
    mutationFn: (dto: { newEmail: string; password: string }) => requestEmailChange(dto),
    onSuccess: (res) => {
      Alert.alert(t('settings.changeEmailSuccessTitle'), t('settings.changeEmailSuccessBody', { email: res.pendingEmail }));
      if (navigation.canGoBack()) navigation.goBack();
    },
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StackScreenHeader title={t('settings.changeEmailTitle')} />
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Text style={styles.para}>{t('settings.changeEmailIntro')}</Text>
        {m.isError ? <Text style={styles.err}>{t('common.error')}</Text> : null}
        <Controller
          name="newEmail"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.register.email')}</Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#666"
              />
            </View>
          )}
        />
        {formState.errors.newEmail ? (
          <Text style={styles.err}>{formState.errors.newEmail.message}</Text>
        ) : null}
        <Controller
          name="password"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.login.password')}</Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                placeholderTextColor="#666"
              />
            </View>
          )}
        />
        {formState.errors.password ? <Text style={styles.err}>{formState.errors.password.message}</Text> : null}
        <Pressable
          style={({ pressed }) => [styles.save, m.isPending && styles.disabled, pressed && styles.pressed]}
          onPress={handleSubmit((v) => m.mutate(v))}
          disabled={m.isPending}
        >
          {m.isPending ? <ActivityIndicator color="#0b0b0d" /> : <Text style={styles.saveText}>{t('common.continue')}</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  list: { padding: 16, paddingBottom: 32 },
  para: { color: '#aaa', marginBottom: 20, lineHeight: 20 },
  field: { marginBottom: 12 },
  label: { color: '#888', fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: '#1a1a1e', borderRadius: 10, padding: 12, color: '#fff' },
  err: { color: '#e66', marginBottom: 8, fontSize: 13 },
  save: {
    marginTop: 8,
    backgroundColor: '#ff6a00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: { color: '#0b0b0d', fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
});
