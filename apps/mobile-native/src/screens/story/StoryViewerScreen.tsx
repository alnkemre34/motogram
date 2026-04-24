import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Video from 'react-native-video';
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
import type { StoryFeedItem } from '../../features/story/group-story-feed';

const { width: W, height: H } = Dimensions.get('window');

type RouteParams = { initialStoryId: string };

export function StoryViewerScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const { initialStoryId } = useRoute().params as RouteParams;
  const listRef = useRef<FlatList<StoryFeedItem>>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

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

  useEffect(() => {
    if (userStories.length === 0) return;
    if (activeId !== null) return;
    const id = userStories[startIndex]?.id ?? userStories[0]?.id;
    if (id) setActiveId(id);
  }, [userStories, startIndex, activeId]);

  const viewedRef = useRef<Set<string>>(new Set());
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const id = (viewableItems[0]?.item as StoryFeedItem | undefined)?.id;
    if (id && activeId !== id) setActiveId(id);
    if (id && !viewedRef.current.has(id)) {
      viewedRef.current.add(id);
      void recordStoryView(id).catch(() => {
        viewedRef.current.delete(id);
      });
    }
  }, [activeId]);

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
        <StorySlideMedia item={item} width={W} height={H} isActive={activeId === item.id} />
        {item.caption ? (
          <View style={styles.captionBox}>
            <Text style={styles.captionText}>{item.caption}</Text>
          </View>
        ) : null}
      </View>
    ),
    [activeId],
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            void qc.invalidateQueries({ queryKey: ['stories', 'feed'] });
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

function StorySlideMedia({
  item,
  width,
  height,
  isActive,
}: {
  item: StoryFeedItem;
  width: number;
  height: number;
  isActive: boolean;
}) {
  const { t } = useTranslation();
  if (item.mediaType === 'VIDEO') {
    return <StoryVideo uri={item.mediaUrl} width={width} height={height} isActive={isActive} fallbackText={t('story.videoError')} />;
  }
  return <Image source={{ uri: item.mediaUrl }} style={{ height, width }} resizeMode="cover" />;
}

function StoryVideo({
  uri,
  width,
  height,
  isActive,
  fallbackText,
}: {
  uri: string;
  width: number;
  height: number;
  isActive: boolean;
  fallbackText: string;
}) {
  const [err, setErr] = useState(false);

  if (err) {
    return (
      <View style={[styles.videoFallback, { width, height }]}>
        <Text style={styles.videoHint}>{fallbackText}</Text>
      </View>
    );
  }

  return (
    <Video
      source={{ uri }}
      style={{ width, height }}
      resizeMode="cover"
      paused={!isActive}
      repeat
      playInBackground={false}
      playWhenInactive={false}
      ignoreSilentSwitch="ignore"
      onError={() => setErr(true)}
    />
  );
}

