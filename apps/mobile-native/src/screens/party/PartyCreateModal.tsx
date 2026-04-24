import { CreatePartySchema, type CreatePartyDto } from '@motogram/shared';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Controller } from 'react-hook-form';

import { createParty, getParty } from '../../api/party.api';
import { useZodForm } from '../../hooks/useZodForm';
import { captureException } from '../../lib/sentry';
import { usePartyStore } from '../../store/party.store';

export interface PartyCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function PartyCreateModal({ visible, onClose, onCreated }: PartyCreateModalProps) {
  const { t } = useTranslation();
  const setParty = usePartyStore((s) => s.setParty);

  const { control, handleSubmit, reset, formState, watch, setValue } = useZodForm(CreatePartySchema, {
    defaultValues: {
      name: '',
      routeId: undefined,
      eventId: undefined,
      isPrivate: false,
      maxMembers: 20,
      coLeaderIds: [],
    },
  });
  const { errors } = formState;
  const maxMembers = watch('maxMembers');

  const mut = useMutation({
    mutationFn: (dto: CreatePartyDto) => createParty(dto),
    onSuccess: async (summary) => {
      try {
        const detail = await getParty(summary.id);
        setParty(detail);
        reset();
        onClose();
        onCreated?.();
      } catch (e) {
        captureException(e);
        Alert.alert(t('common.error'), t('map.partyCreate.loadError'));
      }
    },
    onError: (e: Error) => Alert.alert(t('common.error'), e.message),
  });

  const bumpMax = (delta: number) => {
    const next = Math.min(50, Math.max(2, maxMembers + delta));
    setValue('maxMembers', next, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('map.partyCreate.title')}</Text>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
            <Text style={styles.label}>{t('map.partyCreate.name')}</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder={t('map.partyCreate.namePlaceholder')}
                  placeholderTextColor="#555"
                  autoCapitalize="sentences"
                />
              )}
            />
            {errors.name?.message ? (
              <Text style={styles.fieldError}>{String(errors.name.message)}</Text>
            ) : null}

            <Text style={styles.label}>{t('map.partyCreate.maxMembers')}</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => bumpMax(-1)} accessibilityRole="button">
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepValue}>{maxMembers}</Text>
              <Pressable style={styles.stepBtn} onPress={() => bumpMax(1)} accessibilityRole="button">
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
            {errors.maxMembers?.message ? (
              <Text style={styles.fieldError}>{String(errors.maxMembers.message)}</Text>
            ) : null}

            <View style={styles.row}>
              <Text style={styles.label}>{t('map.partyCreate.private')}</Text>
              <Controller
                control={control}
                name="isPrivate"
                render={({ field: { onChange, value } }) => (
                  <Switch value={value} onValueChange={onChange} trackColor={{ true: '#F5A623' }} />
                )}
              />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.secondary} onPress={onClose} disabled={mut.isPending}>
              <Text style={styles.secondaryText}>{t('map.partyCreate.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.primary, mut.isPending && styles.primaryDisabled]}
              onPress={handleSubmit((dto) => mut.mutate(dto))}
              disabled={mut.isPending}
            >
              <Text style={styles.primaryText}>
                {mut.isPending ? t('common.loading') : t('map.partyCreate.submit')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#121218',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '88%',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 12 },
  scroll: { paddingBottom: 8, gap: 4 },
  label: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700', marginTop: 10 },
  input: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  fieldError: { color: '#ff6b6b', fontSize: 12, marginTop: 4 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(245,166,35,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: '#F5A623', fontSize: 22, fontWeight: '800' },
  stepValue: { color: '#fff', fontSize: 18, fontWeight: '800', minWidth: 36, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingVertical: 4,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  secondaryText: { color: '#fff', fontWeight: '800' },
  primary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F5A623',
  },
  primaryDisabled: { opacity: 0.55 },
  primaryText: { color: '#0b0b10', fontWeight: '900' },
});
