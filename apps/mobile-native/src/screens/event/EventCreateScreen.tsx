import { CreateEventSchema, type CreateEventDto } from '@motogram/shared';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
import { useForegroundLocation } from '../../hooks/useForegroundLocation';
import { useZodForm } from '../../hooks/useZodForm';

import { EventCreateFormSchema } from './event-create-form.schema';

function defaultStartIso(): string {
  const d = new Date();
  d.setHours(d.getHours() + 24, 0, 0, 0);
  return d.toISOString();
}

export function EventCreateScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<{ goBack: () => void }>();
  const fg = useForegroundLocation({ enabled: true });

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
    if (fg.status === 'denied' || !fg.fix) {
      Alert.alert(t('eventCreate.locationDeniedTitle'), t('eventCreate.locationDeniedBody'));
      return;
    }
    setValue('meetingPointLat', fg.fix.lat, { shouldValidate: true });
    setValue('meetingPointLng', fg.fix.lng, { shouldValidate: true });
  };

  const mut = useMutation({
    mutationFn: (dto: CreateEventDto) => createEvent(dto),
    onSuccess: () => {
      Alert.alert(t('eventCreate.successTitle'), t('eventCreate.successBody'));
      navigation.goBack();
    },
    onError: (e: Error) => Alert.alert(t('common.error'), e.message),
  });

  const onValid = (dto: CreateEventDto) => {
    mut.mutate(dto);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>{t('eventCreate.title')}</Text>

        <Label>{t('eventCreate.fieldTitle')}</Label>
        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('eventCreate.phTitle')}
              placeholderTextColor="#555"
            />
          )}
        />
        {errors.title?.message ? <Text style={styles.fieldError}>{errors.title.message}</Text> : null}

        <Label>{t('eventCreate.fieldDescription')}</Label>
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, styles.multiline]}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('eventCreate.phDescription')}
              placeholderTextColor="#555"
              multiline
            />
          )}
        />
        {errors.description?.message ? <Text style={styles.fieldError}>{errors.description.message}</Text> : null}

        <Label>{t('eventCreate.fieldMeeting')}</Label>
        <Controller
          control={control}
          name="meetingPointName"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('eventCreate.phMeeting')}
              placeholderTextColor="#555"
            />
          )}
        />

        <Pressable style={styles.secondaryButton} onPress={() => void useMyLocation()}>
          <Text style={styles.secondaryText}>
            {lat !== null && lng !== null
              ? t('eventCreate.locationSelected', { lat: lat.toFixed(4), lng: lng.toFixed(4) })
              : t('eventCreate.useMyLocation')}
          </Text>
        </Pressable>
        {errors.meetingPointLat?.message ? (
          <Text style={styles.fieldError}>
            {errors.meetingPointLat.message === 'meeting_point_required'
              ? t('eventCreate.meetingRequired')
              : errors.meetingPointLat.message}
          </Text>
        ) : null}

        <Label>{t('eventCreate.fieldStart')}</Label>
        <Controller
          control={control}
          name="startTimeIso"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('eventCreate.phStart')}
              placeholderTextColor="#555"
            />
          )}
        />
        {errors.startTimeIso?.message ? <Text style={styles.fieldError}>{errors.startTimeIso.message}</Text> : null}

        <Pressable
          style={[styles.primaryButton, mut.isPending ? { opacity: 0.6 } : null]}
          onPress={handleSubmit((form) => {
            const parsed = CreateEventSchema.safeParse({
              title: form.title,
              description: form.description.trim() || undefined,
              meetingPointName: form.meetingPointName.trim() || t('eventCreate.defaultMeetingPoint'),
              meetingPointLat: form.meetingPointLat!,
              meetingPointLng: form.meetingPointLng!,
              startTime: new Date(form.startTimeIso),
              visibility: form.visibility,
              coHostIds: form.coHostIds,
            });
            if (!parsed.success) {
              Alert.alert(t('eventCreate.validation'), parsed.error.issues[0]?.message ?? t('eventCreate.invalidData'));
              return;
            }
            onValid(parsed.data);
          })}
          disabled={mut.isPending}
        >
          <Text style={styles.primaryText}>{mut.isPending ? t('eventCreate.submitting') : t('eventCreate.submit')}</Text>
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
  input: { backgroundColor: '#1a1a1a', color: '#fff', padding: 12, borderRadius: 10, fontSize: 15 },
  fieldError: { color: '#ff5a5a', fontSize: 12, marginTop: 4 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  secondaryButton: { backgroundColor: '#222', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  secondaryText: { color: '#ff6a00', fontWeight: '600', fontSize: 13 },
  primaryButton: { backgroundColor: '#ff6a00', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 24 },
  primaryText: { color: '#000', fontWeight: '700', fontSize: 15 },
});

