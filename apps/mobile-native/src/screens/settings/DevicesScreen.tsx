import type { DeviceTokenDto } from '@motogram/shared';
import { RegisterDeviceTokenSchema, type DevicePlatform } from '@motogram/shared';
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listMyDevices, registerDeviceToken, revokeDeviceToken } from '../../api/push.api';
import { StackScreenHeader } from '../../components/StackScreenHeader';
import { StorageKeys, getString, setString } from '../../lib/storage';

export function DevicesScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [localToken, setLocalToken] = useState<string | null>(() => getString(StorageKeys.PushToken) ?? null);

  const listQ = useQuery({ queryKey: ['devices', 'me'], queryFn: listMyDevices, staleTime: 15_000 });

  const refreshLocalToken = useCallback(() => {
    setLocalToken(getString(StorageKeys.PushToken) ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshLocalToken();
    }, [refreshLocalToken]),
  );

  const platform: DevicePlatform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

  const requestNotifPermM = useMutation({
    mutationFn: async () => {
      if (Platform.OS !== 'android') return true;
      if (Platform.Version < 33) return true; // POST_NOTIFICATIONS is Android 13+
      const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      return res === PermissionsAndroid.RESULTS.GRANTED;
    },
  });

  const registerM = useMutation({
    mutationFn: (tok: string) =>
      registerDeviceToken(
        RegisterDeviceTokenSchema.parse({
          token: tok,
          platform,
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['devices', 'me'] }),
  });

  const revokeM = useMutation({
    mutationFn: (tok: string) => revokeDeviceToken(tok),
    onSuccess: () => {
      setToken('');
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

              <Text style={styles.subTitle}>{t('settings.devicesThisDevice')}</Text>
              <Text style={styles.hintSmall}>{t('settings.devicesLocalToken')}</Text>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed, requestNotifPermM.isPending && styles.disabled]}
                onPress={() => requestNotifPermM.mutate()}
                disabled={requestNotifPermM.isPending}
              >
                {requestNotifPermM.isPending ? (
                  <ActivityIndicator color="#bbb" />
                ) : (
                  <Text style={styles.secondaryText}>{t('settings.devicesRequestPermission')}</Text>
                )}
              </Pressable>
              {localToken ? (
                <View style={styles.localRow}>
                  <Text style={styles.localToken} numberOfLines={1}>
                    {localToken}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, registerM.isPending && styles.disabled]}
                    onPress={() => registerM.mutate(localToken)}
                    disabled={registerM.isPending}
                  >
                    {registerM.isPending ? (
                      <ActivityIndicator color="#ff6a00" />
                    ) : (
                      <Text style={styles.primaryText}>{t('settings.devicesRegisterThis')}</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={styles.localRow}>
                  <Text style={styles.mutedInline}>{t('settings.devicesNoLocalToken')}</Text>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                    onPress={() => {
                      // Allow manual bootstrap: user can paste a token obtained from system tooling.
                      if (token.trim()) {
                        setString(StorageKeys.PushToken, token.trim());
                        refreshLocalToken();
                      }
                    }}
                  >
                    <Text style={styles.secondaryText}>{t('settings.devicesSaveLocal')}</Text>
                  </Pressable>
                </View>
              )}
              {registerM.isError ? <Text style={styles.err}>{t('common.error')}</Text> : null}

              <Text style={styles.hintSmall}>{t('settings.devicesRevokeNote')}</Text>
              <View style={styles.revokeRow}>
                <TextInput
                  value={token}
                  onChangeText={setToken}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#666"
                  placeholder={t('settings.devicesRevokeTokenPlaceholder')}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.dangerBtn,
                    (!token.trim() || revokeM.isPending) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => revokeM.mutate(token.trim())}
                  disabled={!token.trim() || revokeM.isPending}
                >
                  {revokeM.isPending ? (
                    <ActivityIndicator color="#e74c3c" />
                  ) : (
                    <Text style={styles.dangerText}>{t('settings.devicesRevokeThis')}</Text>
                  )}
                </Pressable>
              </View>
              {revokeM.isError ? <Text style={styles.err}>{t('common.error')}</Text> : null}
            </>
          }
          ListEmptyComponent={<Text style={styles.muted}>{t('settings.devicesEmpty')}</Text>}
          renderItem={({ item }) => <DeviceRow d={item} />}
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
      <Text style={styles.cardTitle}>{t('settings.devicesPlatform', { platform: d.platform })}</Text>
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
  mutedInline: { color: '#666', fontSize: 12, flex: 1 },
  subTitle: { color: '#fff', fontWeight: '700', marginTop: 4, marginBottom: 6 },
  hintSmall: { color: '#666', fontSize: 12, marginBottom: 10, lineHeight: 18 },
  card: { backgroundColor: '#1a1a1e', borderRadius: 12, padding: 14, marginBottom: 8 },
  cardTitle: { color: '#fff', fontWeight: '700' },
  cardMeta: { color: '#888', fontSize: 12, marginTop: 4 },
  localRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  localToken: { flex: 1, color: '#aaa', fontSize: 12 },
  primaryBtn: { borderWidth: 1, borderColor: '#ff6a00', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  primaryText: { color: '#ff6a00', fontWeight: '900' },
  secondaryBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  secondaryText: { color: '#bbb', fontWeight: '700' },
  revokeRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  input: { flex: 1, backgroundColor: '#1a1a1e', borderRadius: 10, padding: 12, color: '#fff' },
  dangerBtn: { borderWidth: 1, borderColor: '#e74c3c', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12 },
  dangerText: { color: '#e74c3c', fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
});

