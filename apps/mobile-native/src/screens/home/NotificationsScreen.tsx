import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchNotificationsList, markNotificationsRead } from '../../api/notifications.api';

export function NotificationsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotificationsList({ limit: 40 }),
    staleTime: 15_000,
  });

  const dataRef = useRef<typeof q.data | undefined>(undefined);
  useEffect(() => {
    dataRef.current = q.data;
  }, [q.data]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        const items = dataRef.current?.items ?? [];
        const ids = items.filter((n) => !n.isRead).map((n) => n.id);
        if (ids.length === 0) return;
        void (async () => {
          try {
            await markNotificationsRead(ids);
            void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
          } catch {
            // ignore
          }
        })();
      };
    }, [queryClient]),
  );

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
          {t('home.notificationsTitle')}
        </Text>
        <View style={styles.topRight} />
      </View>

      {q.isError ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>{t('common.error')}</Text>
          <Pressable style={styles.retry} onPress={() => void q.refetch()}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : null}

      {q.isLoading && !q.isError ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#ff6a00" />
        </View>
      ) : null}

      {!q.isLoading && !q.isError ? (
        <FlatList
          data={q.data?.items ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => {
                void q.refetch();
                void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
              }}
              tintColor="#ff6a00"
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.mutedCenter}>{t('home.notificationsEmpty')}</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.isRead && styles.unreadCard]}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.body} numberOfLines={4}>
                {item.body}
              </Text>
            </View>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  back: { width: 44, height: 44, justifyContent: 'center' },
  backText: { color: '#ff6a00', fontSize: 32, fontWeight: '300' },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '800' },
  topRight: { width: 44 },
  listContent: { paddingHorizontal: 12, paddingBottom: 32 },
  card: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  unreadCard: { borderColor: 'rgba(255, 106, 0, 0.45)' },
  itemTitle: { color: '#fff', fontWeight: '700', marginBottom: 4 },
  body: { color: '#aaa', fontSize: 14, lineHeight: 20 },
  muted: { color: '#888' },
  mutedCenter: { color: '#888', textAlign: 'center', marginTop: 48, paddingHorizontal: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retry: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  retryText: { color: '#ff6a00', fontWeight: '600' },
  pressed: { opacity: 0.7 },
});

