import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchStoryFeed } from '../../api/stories.api';
import type { AppStackParamList } from '../../navigation/types';
import { groupStoryFeedByUser } from './group-story-feed';

type RootNav = NativeStackNavigationProp<AppStackParamList>;

export function StoryRail() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const rootNav = navigation.getParent<RootNav>();

  const q = useQuery({
    queryKey: ['stories', 'feed'],
    queryFn: fetchStoryFeed,
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return (
      <View style={styles.loadingRow} accessibilityLabel={t('home.storiesLoadingA11y')}>
        <ActivityIndicator color="#ff6a00" />
      </View>
    );
  }

  if (q.isError) {
    return (
      <View style={styles.loadingRow}>
        <Text style={styles.muted}>{t('common.error')}</Text>
      </View>
    );
  }

  const groups = groupStoryFeedByUser(q.data ?? []);

  if (groups.length === 0) {
    return (
      <View style={styles.emptyRow}>
        <Text style={styles.muted}>{t('home.storiesEmpty')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {t('home.storiesTitle')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {groups.map((g) => {
          const latest = g.stories[0]!;
          const label = latest.user.username;
          const avatar = latest.user.avatarUrl;
          return (
            <Pressable
              key={g.userId}
              style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
              onPress={() => {
                rootNav?.navigate('StoryViewer', { initialStoryId: latest.id });
              }}
              onLongPress={() => {
                if (latest.user.username) {
                  rootNav?.navigate('UserProfile', { username: latest.user.username });
                }
              }}
              accessibilityLabel={t('home.storyOpenUser', { user: label })}
              accessibilityRole="button"
            >
              <View style={styles.ring}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPh]}>
                    <Text style={styles.mono}>{label.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  sectionLabel: {
    color: 'rgba(0, 229, 255, 0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  rail: { paddingHorizontal: 10, paddingBottom: 12, gap: 4 },
  cell: { width: 72, alignItems: 'center', marginHorizontal: 4 },
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    borderWidth: 2,
    borderColor: '#ff6a00',
  },
  avatar: { width: '100%', height: '100%', borderRadius: 30 },
  avatarPh: { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  mono: { color: '#fff', fontSize: 22, fontWeight: '800' },
  name: { color: '#ccc', fontSize: 11, marginTop: 4, maxWidth: 68, textAlign: 'center' },
  muted: { color: '#666', fontSize: 13, paddingLeft: 16 },
  loadingRow: { paddingVertical: 12, paddingLeft: 16, minHeight: 40, justifyContent: 'center' },
  emptyRow: { paddingVertical: 8, paddingLeft: 16 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});

