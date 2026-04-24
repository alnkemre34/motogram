import { zodResolver } from '@hookform/resolvers/zod';
import { UpdateProfileSchema, type UpdateProfileDto } from '@motogram/shared';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { getCurrentUser, updateCurrentUser } from '../../api/users.api';
import type { AppStackParamList } from '../../navigation/types';
import { parseRidingStyleCommas } from '../../lib/riding-style';

const FormSchema = z.object({
  name: z.string().max(80),
  bio: z.string().max(250),
  city: z.string().max(80),
  country: z.string().max(80),
  ridingStyleText: z.string(),
  isPrivate: z.boolean(),
  avatarUrl: z.string(),
  coverImageUrl: z.string(),
});
type FormValues = z.infer<typeof FormSchema>;

function toUpdateDto(
  v: FormValues,
  urls: { avatarUrl: string | undefined; coverImageUrl: string | undefined },
): UpdateProfileDto {
  const ridingStyle = parseRidingStyleCommas(v.ridingStyleText);
  const out: Record<string, unknown> = { isPrivate: v.isPrivate };
  const name = v.name.trim();
  const bio = v.bio.trim();
  const city = v.city.trim();
  const country = v.country.trim();
  if (name) out.name = name;
  if (bio) out.bio = bio;
  if (city) out.city = city;
  if (country) out.country = country;
  if (ridingStyle.length > 0) out.ridingStyle = ridingStyle;
  if (urls.avatarUrl) out.avatarUrl = urls.avatarUrl;
  if (urls.coverImageUrl) out.coverImageUrl = urls.coverImageUrl;
  return UpdateProfileSchema.parse(out);
}

export function EditProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const queryClient = useQueryClient();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
  });

  const { control, handleSubmit, reset, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      bio: '',
      city: '',
      country: '',
      ridingStyleText: '',
      isPrivate: false,
      avatarUrl: '',
      coverImageUrl: '',
    },
  });

  useEffect(() => {
    if (!data) return;
    reset({
      name: data.name ?? '',
      bio: data.bio ?? '',
      city: data.city ?? '',
      country: data.country ?? '',
      ridingStyleText: data.ridingStyle?.length ? data.ridingStyle.join(', ') : '',
      isPrivate: data.isPrivate,
      avatarUrl: data.avatarUrl ?? '',
      coverImageUrl: data.coverImageUrl ?? '',
    });
  }, [data, reset]);

  const m = useMutation({
    mutationFn: updateCurrentUser,
  });

  const onSubmit = (raw: FormValues) => {
    const av = raw.avatarUrl.trim();
    const cov = raw.coverImageUrl.trim();
    if (av) {
      try {
        // eslint-disable-next-line no-new
        new URL(av);
      } catch {
        setError('avatarUrl', { message: t('settings.editBadUrl') });
        return;
      }
    }
    if (cov) {
      try {
        // eslint-disable-next-line no-new
        new URL(cov);
      } catch {
        setError('coverImageUrl', { message: t('settings.editBadUrl') });
        return;
      }
    }
    const dto = toUpdateDto(raw, { avatarUrl: av || undefined, coverImageUrl: cov || undefined });
    m.mutate(dto, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['me'] });
        if (navigation.canGoBack()) navigation.goBack();
      },
    });
  };

  const header = (
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
        {t('profile.editProfile')}
      </Text>
      <View style={styles.topRight} />
    </View>
  );

  if (isError) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        {header}
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.error')}</Text>
          <Pressable style={styles.btn} onPress={() => void refetch()}>
            <Text style={styles.btnText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isPending || !data) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color="#ff6a00" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {(['name', 'city', 'country'] as const).map((k) => (
          <Controller
            key={k}
            name={k}
            control={control}
            render={({ field: { value, onChange, onBlur } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>{t(`settings.field.${k}`)}</Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  style={styles.input}
                  placeholderTextColor="#666"
                />
              </View>
            )}
          />
        ))}
        <Controller
          name="bio"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{t('settings.field.bio')}</Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                style={[styles.input, styles.multiline]}
                multiline
                textAlignVertical="top"
                placeholderTextColor="#666"
              />
            </View>
          )}
        />
        <Controller
          name="ridingStyleText"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{t('settings.field.ridingStyleText')}</Text>
              <Text style={styles.hint}>{t('settings.field.ridingStyleHint')}</Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                style={[styles.input, styles.multiline]}
                multiline
                textAlignVertical="top"
                placeholderTextColor="#666"
              />
            </View>
          )}
        />
        {(['avatarUrl', 'coverImageUrl'] as const).map((k) => (
          <Controller
            key={k}
            name={k}
            control={control}
            render={({ field: { value, onChange, onBlur } }) => (
              <View style={styles.field}>
                <Text style={styles.label}>{t(`settings.field.${k}`)}</Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholderTextColor="#666"
                />
              </View>
            )}
          />
        ))}
        {formState.errors.avatarUrl || formState.errors.coverImageUrl ? (
          <Text style={styles.err}>
            {formState.errors.avatarUrl?.message || formState.errors.coverImageUrl?.message || t('settings.editBadUrl')}
          </Text>
        ) : null}
        {m.isError ? <Text style={styles.err}>{t('common.error')}</Text> : null}
        <Controller
          name="isPrivate"
          control={control}
          render={({ field: { value, onChange } }) => (
            <View style={styles.row}>
              <Text style={styles.label}>{t('settings.field.isPrivate')}</Text>
              <Switch value={value} onValueChange={onChange} trackColor={{ true: '#ff6a00' }} />
            </View>
          )}
        />
        <Pressable
          style={({ pressed }) => [styles.save, m.isPending && styles.saveDisabled, pressed && styles.pressed]}
          onPress={handleSubmit(onSubmit)}
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
  pressed: { opacity: 0.9 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#888' },
  scroll: { padding: 16, paddingBottom: 40, gap: 4 },
  field: { marginBottom: 12 },
  label: { color: '#ccc', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  hint: { color: '#666', fontSize: 11, marginBottom: 4 },
  input: {
    backgroundColor: '#1a1a1e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
  },
  multiline: { minHeight: 80 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  err: { color: '#e66', marginBottom: 8, fontSize: 13 },
  save: {
    marginTop: 8,
    backgroundColor: '#ff6a00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: '#0b0b0d', fontWeight: '800' },
  btn: { marginTop: 16, borderWidth: 1, borderColor: '#444', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  btnText: { color: '#fff' },
});
