import type { NotificationPreferencesDto, UpdateNotificationPreferencesDto } from '@motogram/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchNotificationPreferences, updateNotificationPreferences } from '../../api/notifications.api';

const KEYS: (keyof NotificationPreferencesDto)[] = [
  'pushFollow',
  'pushLike',
  'pushComment',
  'pushMention',
  'pushParty',
  'pushEmergency',
  'pushCommunity',
  'pushEvent',
  'emailDigest',
];

export function NotificationPreferencesScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pendingKey, setPendingKey] = useState<keyof NotificationPreferencesDto | null>(null);
  const q = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPreferences,
  });
  const m = useMutation({
    mutationFn: (dto: UpdateNotificationPreferencesDto) => updateNotificationPreferences(dto),
    onSuccess: (updated) => {
      queryClient.setQueryData(['notification-preferences'], updated);
    },
    onSettled: () => {
      setPendingKey(null);
    },
  });

  if (q.isError) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {t('settings.notificationPrefsTitle')}
          </Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.error')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (q.isPending || !q.data) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {t('settings.notificationPrefsTitle')}
          </Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color="#ff6a00" />
        </View>
      </SafeAreaView>
    );
  }

  const data = q.data;
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('settings.notificationPrefsTitle')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {m.isError ? <Text style={styles.err}>{t('settings.preferencesSaveError')}</Text> : null}
        {KEYS.map((k) => (
          <View key={k} style={styles.row}>
            <View style={styles.textWrap}>
              <Text style={styles.label}>{t(`settings.notif.${k}`)}</Text>
            </View>
            <Switch
              value={data[k]}
              onValueChange={(v) => {
                setPendingKey(k);
                const next: UpdateNotificationPreferencesDto = { [k]: v };
                m.mutate(next);
              }}
              disabled={pendingKey === k && m.isPending}
              trackColor={{ true: '#ff6a00' }}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1e',
    borderRadius: 12,
    padding: 16,
  },
  textWrap: { flex: 1, paddingRight: 12 },
  label: { color: '#fff', fontSize: 15, fontWeight: '600' },
  muted: { color: '#888' },
  err: { color: '#e66', marginBottom: 8 },
});

