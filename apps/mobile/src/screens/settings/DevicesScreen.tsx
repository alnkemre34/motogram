import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listMyDevices, revokeDeviceToken } from '../../api/push.api';
import { StackScreenHeader } from '../../components/StackScreenHeader';
import type { DeviceTokenDto } from '@motogram/shared';

export function DevicesScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const listQ = useQuery({ queryKey: ['devices', 'me'], queryFn: listMyDevices, staleTime: 15_000 });
  const tokenQ = useQuery({
    queryKey: ['devices', 'expoToken'],
    queryFn: async () => {
      if (!Device.isDevice) return null;
      try {
        const { data } = await Notifications.getExpoPushTokenAsync();
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  const revokeM = useMutation({
    mutationFn: (token: string) => revokeDeviceToken(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['devices', 'me'] });
    },
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StackScreenHeader title={t('settings.devicesTitle')} />
      {listQ.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ff6a00" />
        </View>
      ) : (
        <FlatList
          data={listQ.data?.devices ?? []}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              <Text style={styles.para}>{t('settings.devicesIntro')}</Text>
              {listQ.isError ? <Text style={styles.err}>{t('common.error')}</Text> : null}
            </>
          }
          ListEmptyComponent={<Text style={styles.muted}>{t('settings.devicesEmpty')}</Text>}
          renderItem={({ item }) => <DeviceRow d={item} />}
          ListFooterComponent={
            <>
              <Text style={styles.subTitle}>{t('settings.devicesThisDevice')}</Text>
              <Text style={styles.hintSmall}>{t('settings.devicesRevokeNote')}</Text>
              {tokenQ.data ? (
                <Pressable
                  style={({ pressed }) => [styles.danger, revokeM.isPending && styles.disabled, pressed && styles.pressed]}
                  onPress={() => revokeM.mutate(tokenQ.data!)}
                  disabled={revokeM.isPending}
                >
                  {revokeM.isPending ? (
                    <ActivityIndicator color="#e74c3c" />
                  ) : (
                    <Text style={styles.dangerText}>{t('settings.devicesRevokeThis')}</Text>
                  )}
                </Pressable>
              ) : (
                <Text style={styles.muted}>{t('settings.devicesNoLocalToken')}</Text>
              )}
              {revokeM.isError ? <Text style={styles.err}>{t('common.error')}</Text> : null}
            </>
          }
        />
      )}
    </SafeAreaView>
  );
}

function DeviceRow({ d }: { d: DeviceTokenDto }) {
  const { t } = useTranslation();
  const last = typeof d.lastSeenAt === 'string' ? d.lastSeenAt : String(d.lastSeenAt);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {t('settings.devicesPlatform', { platform: d.platform })}
      </Text>
      <Text style={styles.cardMeta} numberOfLines={1}>
        {t('settings.devicesIdShort', { id: d.id.slice(0, 8) })} · {t('settings.devicesLastSeen', { at: last })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  para: { color: '#aaa', marginBottom: 16, lineHeight: 20 },
  err: { color: '#e66', marginBottom: 8, fontSize: 13 },
  muted: { color: '#666', fontSize: 13, marginBottom: 8, paddingVertical: 8 },
  subTitle: { color: '#fff', fontWeight: '700', marginTop: 20, marginBottom: 6 },
  hintSmall: { color: '#666', fontSize: 12, marginBottom: 10, lineHeight: 18 },
  card: {
    backgroundColor: '#1a1a1e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  cardTitle: { color: '#fff', fontWeight: '700' },
  cardMeta: { color: '#888', fontSize: 12, marginTop: 4 },
  danger: {
    borderWidth: 1,
    borderColor: '#e74c3c',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerText: { color: '#e74c3c', fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
});
