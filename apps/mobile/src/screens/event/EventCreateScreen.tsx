import { CreateEventSchema, type CreateEventDto } from '@motogram/shared';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Controller } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { createEvent } from '../../api/event.api';
import { useZodForm } from '../../hooks/useZodForm';

import { EventCreateFormSchema } from './event-create-form.schema';

function defaultStartIso(): string {
  const d = new Date();
  d.setHours(d.getHours() + 24, 0, 0, 0);
  return d.toISOString();
}

// Spec 2.4.3 - Etkinlik olusturma ekrani. Meeting point konumu cihazin
// mevcut lokasyonundan alinir veya manuel girilir.

export function EventCreateScreen() {
  const navigation = useNavigation<{ goBack: () => void }>();

  const { control, handleSubmit, setValue, watch, formState } = useZodForm(EventCreateFormSchema, {
    defaultValues: {
      title: '',
      description: '',
      meetingPointName: '',
      meetingPointLat: null,
      meetingPointLng: null,
      startTimeIso: defaultStartIso(),
      visibility: 'PUBLIC',
      coHostIds: [],
    },
  });
  const { errors } = formState;
  const lat = watch('meetingPointLat');
  const lng = watch('meetingPointLng');

  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Konum', 'Konum izni verilmedi.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setValue('meetingPointLat', loc.coords.latitude, { shouldValidate: true });
    setValue('meetingPointLng', loc.coords.longitude, { shouldValidate: true });
  };

  const mut = useMutation({
    mutationFn: (dto: CreateEventDto) => createEvent(dto),
    onSuccess: () => {
      Alert.alert('Etkinlik', 'Etkinlik olusturuldu!');
      navigation.goBack();
    },
    onError: (e: Error) => Alert.alert('Hata', e.message),
  });

  const onValid = (form: CreateEventDto) => {
    mut.mutate(form);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Yeni Etkinlik</Text>

        <Label>Baslik</Label>
        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Pazar Sabahi Bogaz Turu"
              placeholderTextColor="#555"
            />
          )}
        />
        {errors.title?.message ? (
          <Text style={styles.fieldError}>{errors.title.message}</Text>
        ) : null}

        <Label>Aciklama</Label>
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, styles.multiline]}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Rota, hiz, uyarilar..."
              placeholderTextColor="#555"
              multiline
            />
          )}
        />
        {errors.description?.message ? (
          <Text style={styles.fieldError}>{errors.description.message}</Text>
        ) : null}

        <Label>Bulusma Noktasi</Label>
        <Controller
          control={control}
          name="meetingPointName"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Ornek: Beylerbeyi Camii Onu"
              placeholderTextColor="#555"
            />
          )}
        />

        <Pressable style={styles.secondaryButton} onPress={() => void useMyLocation()}>
          <Text style={styles.secondaryText}>
            {lat !== null && lng !== null
              ? `Konum secildi: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
              : 'Benim konumumu kullan'}
          </Text>
        </Pressable>
        {errors.meetingPointLat?.message ? (
          <Text style={styles.fieldError}>
            {errors.meetingPointLat.message === 'meeting_point_required'
              ? 'Bulusma konumu secin veya konum izni verin.'
              : errors.meetingPointLat.message}
          </Text>
        ) : null}

        <Label>Baslangic (ISO 8601)</Label>
        <Controller
          control={control}
          name="startTimeIso"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="2026-04-25T10:00:00Z"
              placeholderTextColor="#555"
            />
          )}
        />
        {errors.startTimeIso?.message ? (
          <Text style={styles.fieldError}>{errors.startTimeIso.message}</Text>
        ) : null}

        <Pressable
          style={[styles.primaryButton, mut.isPending ? { opacity: 0.6 } : null]}
          onPress={handleSubmit((form) => {
            const parsed = CreateEventSchema.safeParse({
              title: form.title,
              description: form.description.trim() || undefined,
              meetingPointName: form.meetingPointName.trim() || 'Bulusma Noktasi',
              meetingPointLat: form.meetingPointLat!,
              meetingPointLng: form.meetingPointLng!,
              startTime: new Date(form.startTimeIso),
              visibility: form.visibility,
              coHostIds: form.coHostIds,
            });
            if (!parsed.success) {
              Alert.alert(
                'Dogrulama',
                parsed.error.issues[0]?.message ?? 'Gecersiz veri',
              );
              return;
            }
            onValid(parsed.data);
          })}
          disabled={mut.isPending}
        >
          <Text style={styles.primaryText}>
            {mut.isPending ? 'Olusturuluyor...' : 'Etkinligi Olustur'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 16, paddingBottom: 80 },
  header: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  label: { color: '#888', fontSize: 12, marginTop: 14, marginBottom: 6, letterSpacing: 1 },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    fontSize: 15,
  },
  fieldError: { color: '#ff5a5a', fontSize: 12, marginTop: 4 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  secondaryButton: {
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryText: { color: '#ff6a00', fontWeight: '600', fontSize: 13 },
  primaryButton: {
    backgroundColor: '#ff6a00',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
