import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchUnreadCount } from '../../api/notifications.api';
import { fetchFeed, type FeedPage } from '../../api/posts.api';
import { useLikePost } from '../../hooks/useLikePost';
import type { AppStackParamList } from '../../navigation/types';

// Spec 2.2 + FRONTEND_UI_UX_BLUEPRINT §5 — üst bar: Gelen Kutusu, Bildirimler

type RootNav = NativeStackNavigationProp<AppStackParamList>;

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const rootNav = navigation.getParent<RootNav>();
  const { data, isLoading, refetch, isRefetching } = useQuery<FeedPage>({
    queryKey: ['feed'],
    queryFn: () => fetchFeed({ limit: 20 }),
  });

  const unreadQ = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => fetchUnreadCount(),
    staleTime: 30_000,
  });

  const like = useLikePost();

  const goInbox = () => {
    rootNav?.navigate('Inbox');
  };
  const goNotifications = () => {
    rootNav?.navigate('Notifications');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#ff6a00" />
      </SafeAreaView>
    );
  }

  const unread = unreadQ.data?.count ?? 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.brand} accessibilityRole="header">
          {t('app.name')}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={goInbox}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityLabel={t('home.a11yOpenInbox')}
            accessibilityRole="button"
          >
            <Text style={styles.iconGlyph}>✉</Text>
          </Pressable>
          <Pressable
            onPress={goNotifications}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityLabel={t('home.a11yOpenNotifications')}
            accessibilityRole="button"
          >
            <View>
              <Text style={styles.iconGlyph}>🔔</Text>
              {unread > 0 ? (
                <View style={styles.badge} accessibilityLabel={String(unread)}>
                  <Text style={styles.badgeText}>{unread > 99 ? '99+' : String(unread)}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
              void unreadQ.refetch();
            }}
            tintColor="#ff6a00"
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>{t('home.emptyFeed')}</Text>
        }
        renderItem={({ item }) => {
          const author = item.user;
          const username = author?.username ?? '—';
          const avatarUrl = author?.avatarUrl ?? null;
          return (
            <View style={styles.postCard}>
              <View style={styles.postHeader}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]} />
                )}
                <Text style={styles.username}>{username}</Text>
              </View>

              {item.mediaUrls[0] ? (
                <Image
                  source={{ uri: item.mediaUrls[0] }}
                  style={styles.media}
                  resizeMode="cover"
                />
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  onPress={() =>
                    like.mutate({ postId: item.id, currentlyLiked: item.likedByMe })
                  }
                >
                  <Text style={styles.actionText}>
                    {item.likedByMe ? '♥' : '♡'} {item.likesCount}
                  </Text>
                </Pressable>
                <Text style={styles.actionText}>💬 {item.commentsCount}</Text>
              </View>

              {item.caption ? (
                <Text style={styles.caption}>
                  <Text style={styles.username}>{username} </Text>
                  {item.caption}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  center: { flex: 1, backgroundColor: '#0b0b0d', alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  brand: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 8, minWidth: 40, alignItems: 'center' },
  iconGlyph: { fontSize: 20 },
  badge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ff6a00',
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#000', fontSize: 9, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  empty: { color: '#888', textAlign: 'center', marginTop: 64, paddingHorizontal: 32 },
  postCard: { marginBottom: 16 },
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  avatarFallback: { backgroundColor: '#333' },
  username: { color: '#fff', fontWeight: '700' },
  media: { width: '100%', aspectRatio: 1, backgroundColor: '#222' },
  actions: { flexDirection: 'row', gap: 16, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { color: '#fff', fontSize: 16 },
  caption: { color: '#ddd', paddingHorizontal: 12, paddingBottom: 12 },
});
