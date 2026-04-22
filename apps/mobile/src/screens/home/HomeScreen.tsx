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

import { fetchFeed, type FeedPage } from '../../api/posts.api';
import { useLikePost } from '../../hooks/useLikePost';

// Spec 2.2 - Ana Sayfa = Instagram klonu (Hikayeler + Dikey feed + Like/Comment)

export function HomeScreen() {
  const { t } = useTranslation();
  const { data, isLoading, refetch, isRefetching } = useQuery<FeedPage>({
    queryKey: ['feed'],
    queryFn: () => fetchFeed({ limit: 20 }),
  });

  const like = useLikePost();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#ff6a00" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.brand}>{t('app.name')}</Text>
      </View>

      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
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
                  like.mutate({ postId: item.id, currentlyLiked: false })
                }
              >
                <Text style={styles.actionText}>♡ {item.likesCount}</Text>
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
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  brand: { color: '#fff', fontSize: 22, fontWeight: '800' },
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
