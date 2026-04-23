import { useCallback, useMemo, useRef } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  type ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchStoryFeed, recordStoryView } from '../../api/stories.api';
import { queryClient } from '../../lib/query-client';
import type { StoryFeedItem } from '../../features/story/group-story-feed';

// GET /v1/stories/feed (cache) + POST /v1/stories/:id/views

const { width: W, height: H } = Dimensions.get('window');

type RouteParams = { initialStoryId: string };

export function StoryViewerScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { initialStoryId } = useRoute().params as RouteParams;
  const listRef = useRef<FlatList<StoryFeedItem>>(null);

  const q = useQuery({ queryKey: ['stories', 'feed'], queryFn: fetchStoryFeed, staleTime: 15_000 });

  const userStories = useMemo(() => {
    if (!q.data) return [];
    const seed = q.data.find((s) => s.id === initialStoryId);
    if (!seed) return [];
    return q.data
      .filter((s) => s.userId === seed.userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [q.data, initialStoryId]);

  const startIndex = useMemo(
    () => Math.max(0, userStories.findIndex((s) => s.id === initialStoryId)),
    [userStories, initialStoryId],
  );

  const viewedRef = useRef<Set<string>>(new Set());
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      const id = (viewableItems[0]?.item as StoryFeedItem | undefined)?.id;
      if (id && !viewedRef.current.has(id)) {
        viewedRef.current.add(id);
        void recordStoryView(id).catch(() => {
          viewedRef.current.delete(id);
        });
      }
    },
    [],
  );

  if (q.isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color="#ff6a00" />
      </SafeAreaView>
    );
  }

  if (q.isError) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <Text style={styles.muted}>{t('common.error')}</Text>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
          }}
          style={styles.closeBtn}
        >
          <Text style={styles.closeText}>{t('common.back')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (userStories.length === 0) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <Text style={styles.muted}>{t('story.unavailable')}</Text>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
          }}
          style={styles.closeBtn}
        >
          <Text style={styles.closeText}>{t('common.back')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const renderItem: ListRenderItem<StoryFeedItem> = useCallback(
    ({ item }) => (
      <View style={{ width: W, height: H, backgroundColor: '#000' }}>
        {item.mediaType === 'VIDEO' ? (
          <View style={[styles.videoFallback, { width: W, height: H }]}>
            <Text style={styles.videoHint}>{t('story.videoHint')}</Text>
          </View>
        ) : (
          <Image
            source={{ uri: item.mediaUrl }}
            style={{ height: H, width: W }}
            resizeMode="cover"
          />
        )}
        {item.caption ? (
          <View style={styles.captionBox}>
            <Text style={styles.captionText}>{item.caption}</Text>
          </View>
        ) : null}
      </View>
    ),
    [t],
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            void queryClient.invalidateQueries({ queryKey: ['stories', 'feed'] });
          }}
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.closeX}>✕</Text>
        </Pressable>
        <Text style={styles.uname} numberOfLines={1}>
          {userStories[0]!.user.username}
        </Text>
        <View style={{ width: 36 }} />
      </SafeAreaView>
      <FlatList
        ref={listRef}
        data={userStories}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        initialScrollIndex={startIndex < userStories.length ? startIndex : 0}
        getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  closeX: { color: '#fff', fontSize: 22, fontWeight: '300' },
  uname: { color: '#fff', fontWeight: '700', flex: 1, textAlign: 'center' },
  captionBox: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  captionText: { color: '#fff', fontSize: 15 },
  muted: { color: '#888' },
  closeBtn: { marginTop: 20, padding: 12 },
  closeText: { color: '#ff6a00' },
  videoFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  videoHint: { color: '#aaa', textAlign: 'center', padding: 20 },
});
