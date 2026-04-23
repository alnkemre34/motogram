import { zodResolver } from '@hookform/resolvers/zod';
import { ChangeEmailVerifySchema } from '@motogram/shared';
import { useMutation } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { verifyEmailChange } from '../../api/auth.api';
import { StackScreenHeader } from '../../components/StackScreenHeader';
import type { AppStackParamList } from '../../navigation/types';

type FormValues = z.infer<typeof ChangeEmailVerifySchema>;

export function VerifyEmailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AppStackParamList, 'VerifyEmail'>>();
  const fromLink = route.params?.token;
  const { control, handleSubmit, formState, setValue } = useForm<FormValues>({
    resolver: zodResolver(ChangeEmailVerifySchema),
    defaultValues: { token: fromLink ?? '' },
  });

  useEffect(() => {
    if (fromLink) setValue('token', fromLink);
  }, [fromLink, setValue]);

  const m = useMutation({
    mutationFn: (dto: FormValues) => verifyEmailChange(dto),
    onSuccess: () => {
      Alert.alert(t('common.done'), t('settings.verifyEmailSuccessBody'));
      if (navigation.canGoBack()) navigation.goBack();
    },
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StackScreenHeader title={t('settings.verifyEmailTitle')} />
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Text style={styles.para}>{t('settings.verifyEmailIntro')}</Text>
        {m.isError ? <Text style={styles.err}>{t('common.error')}</Text> : null}
        <Controller
          name="token"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{t('settings.verifyEmailToken')}</Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#666"
              />
            </View>
          )}
        />
        {formState.errors.token ? <Text style={styles.err}>{formState.errors.token.message}</Text> : null}
        <Pressable
          style={({ pressed }) => [styles.save, m.isPending && styles.disabled, pressed && styles.pressed]}
          onPress={handleSubmit((v) => m.mutate(v))}
          disabled={m.isPending}
        >
          {m.isPending ? <ActivityIndicator color="#0b0b0d" /> : <Text style={styles.saveText}>{t('auth.otp.verify')}</Text>}
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
