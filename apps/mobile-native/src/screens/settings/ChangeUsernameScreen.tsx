import { zodResolver } from '@hookform/resolvers/zod';
import { ChangeUsernameSchema } from '@motogram/shared';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { changeUsername } from '../../api/users.api';
import type { AppStackParamList } from '../../navigation/types';

type FormValues = z.infer<typeof ChangeUsernameSchema>;

export function ChangeUsernameScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const queryClient = useQueryClient();

  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(ChangeUsernameSchema),
    defaultValues: { username: '' },
  });

  const m = useMutation({
    mutationFn: (dto: FormValues) => changeUsername(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      if (navigation.canGoBack()) navigation.goBack();
    },
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
          }}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.backText}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('settings.changeUsernameTitle')}
        </Text>
        <View style={styles.topRight} />
      </View>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Text style={styles.para}>{t('settings.changeUsernameIntro')}</Text>
        {m.isError ? <Text style={styles.err}>{t('common.error')}</Text> : null}

        <Controller
          name="username"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.register.username')}</Text>
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
        {formState.errors.username ? <Text style={styles.err}>{formState.errors.username.message}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.save, m.isPending && styles.disabled, pressed && styles.pressed]}
          onPress={handleSubmit((v) => m.mutate(v))}
          disabled={m.isPending}
          accessibilityRole="button"
        >
          {m.isPending ? <ActivityIndicator color="#0b0b0d" /> : <Text style={styles.saveText}>{t('common.save')}</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: '#fff', fontSize: 26, marginTop: -2 },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '800' },
  topRight: { width: 44 },
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

