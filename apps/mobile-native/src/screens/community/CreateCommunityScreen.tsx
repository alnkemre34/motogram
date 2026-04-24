import { zodResolver } from '@hookform/resolvers/zod';
import { CommunityVisibilityEnum, CreateCommunitySchema, type CreateCommunityDto } from '@motogram/shared';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { createCommunity } from '../../api/community.api';
import { StackScreenHeader } from '../../components/StackScreenHeader';
import type { AppStackParamList } from '../../navigation/types';

const FormSchema = z.object({
  name: CreateCommunitySchema.shape.name,
  description: CreateCommunitySchema.shape.description,
  visibility: CommunityVisibilityEnum,
  region: CreateCommunitySchema.shape.region,
});
type FormValues = z.infer<typeof FormSchema>;

const VIS: Array<z.infer<typeof CommunityVisibilityEnum>> = ['PUBLIC', 'PRIVATE', 'HIDDEN'];

export function CreateCommunityScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { control, handleSubmit, watch, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: '', description: '', visibility: 'PUBLIC', region: '' },
  });
  const vis = watch('visibility');

  const m = useMutation({
    mutationFn: (dto: CreateCommunityDto) => createCommunity(dto),
    onSuccess: (c) => {
      navigation.replace('CommunityDetail', { id: c.id });
    },
  });

  const onSubmit = (v: FormValues) => {
    const body: CreateCommunityDto = CreateCommunitySchema.parse({
      name: v.name,
      description: v.description || undefined,
      visibility: v.visibility,
      region: v.region || undefined,
    });
    m.mutate(body);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StackScreenHeader title={t('community.createTitle')} />
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Text style={styles.para}>{t('community.createIntro')}</Text>
        {m.isError ? <Text style={styles.err}>{t('common.error')}</Text> : null}
        <Controller
          name="name"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{t('community.createName')}</Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                style={styles.input}
                maxLength={60}
                placeholderTextColor="#666"
              />
            </View>
          )}
        />
        {formState.errors.name ? <Text style={styles.err}>{formState.errors.name.message}</Text> : null}

        <Controller
          name="description"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{t('community.createDescription')}</Text>
              <TextInput
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                style={[styles.input, styles.multiline]}
                multiline
                maxLength={2000}
                placeholderTextColor="#666"
              />
            </View>
          )}
        />

        <Text style={styles.label}>{t('community.createVisibility')}</Text>
        <View style={styles.chips}>
          {VIS.map((k) => (
            <Pressable
              key={k}
              onPress={() => setValue('visibility', k)}
              style={({ pressed }) => [styles.chip, vis === k && styles.chipOn, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, vis === k && styles.chipTextOn]}>{t(`community.visibility.${k}`)}</Text>
            </Pressable>
          ))}
        </View>

        <Controller
          name="region"
          control={control}
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.field}>
              <Text style={styles.label}>{t('community.createRegion')}</Text>
              <TextInput
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                style={styles.input}
                maxLength={80}
                placeholderTextColor="#666"
              />
            </View>
          )}
        />

        <Pressable
          style={({ pressed }) => [styles.save, m.isPending && styles.disabled, pressed && styles.pressed]}
          onPress={handleSubmit(onSubmit)}
          disabled={m.isPending}
        >
          {m.isPending ? (
            <ActivityIndicator color="#0b0b0d" />
          ) : (
            <Text style={styles.saveText}>{t('community.createSubmit')}</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  list: { padding: 16, paddingBottom: 32 },
  para: { color: '#aaa', marginBottom: 16, lineHeight: 20 },
  field: { marginBottom: 12 },
  label: { color: '#888', fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: '#1a1a1e', borderRadius: 10, padding: 12, color: '#fff' },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  err: { color: '#e66', marginBottom: 8, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#1a1a1e', borderWidth: 1, borderColor: '#333' },
  chipOn: { backgroundColor: 'rgba(255,106,0,0.2)', borderColor: '#ff6a00' },
  chipText: { color: '#888', fontWeight: '700', fontSize: 12 },
  chipTextOn: { color: '#ff6a00' },
  save: { marginTop: 8, backgroundColor: '#ff6a00', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#0b0b0d', fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
});

