import { zodResolver } from '@hookform/resolvers/zod';
import { ChangePasswordSchema, PasswordSchema } from '@motogram/shared';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { changePasswordRequest } from '../../api/auth.api';
import { StackScreenHeader } from '../../components/StackScreenHeader';

const FormSchema = z
  .object({
    currentPassword: PasswordSchema,
    newPassword: PasswordSchema,
    confirmPassword: PasswordSchema,
  })
  .superRefine((val, ctx) => {
    if (val.newPassword !== val.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'] });
    }
    const p = ChangePasswordSchema.safeParse({
      currentPassword: val.currentPassword,
      newPassword: val.newPassword,
    });
    if (!p.success) {
      p.error.issues.forEach((i) => ctx.addIssue(i));
    }
  });
type FormValues = z.infer<typeof FormSchema>;

export function ChangePasswordScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { control, handleSubmit, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const m = useMutation({
    mutationFn: (dto: { currentPassword: string; newPassword: string }) => changePasswordRequest(dto),
    onSuccess: () => {
      if (navigation.canGoBack()) navigation.goBack();
    },
  });

  const onSubmit = (v: FormValues) => {
    m.mutate(
      { currentPassword: v.currentPassword, newPassword: v.newPassword },
      {
        onError: () => {
          setError('currentPassword', { message: t('settings.passwordWrong') });
        },
      },
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StackScreenHeader title={t('settings.changePasswordTitle')} />
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Text style={styles.para}>{t('settings.changePasswordIntro')}</Text>
        {m.isError && !formState.errors.currentPassword ? (
          <Text style={styles.err}>{t('common.error')}</Text>
        ) : null}
        <Controller
          name="currentPassword"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{t('settings.currentPassword')}</Text>
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
        {formState.errors.currentPassword ? (
          <Text style={styles.err}>{formState.errors.currentPassword.message || t('settings.passwordWrong')}</Text>
        ) : null}
        <Controller
          name="newPassword"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{t('settings.newPassword')}</Text>
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
        <Controller
          name="confirmPassword"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{t('settings.confirmPassword')}</Text>
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
        {formState.errors.newPassword || formState.errors.confirmPassword ? (
          <Text style={styles.err}>{t('settings.passwordValidation')}</Text>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.save, m.isPending && styles.disabled, pressed && styles.pressed]}
          onPress={handleSubmit(onSubmit)}
          disabled={m.isPending}
        >
          {m.isPending ? (
            <ActivityIndicator color="#0b0b0d" />
          ) : (
            <Text style={styles.saveText}>{t('common.save')}</Text>
          )}
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
