import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkIsFollowingUser, followUser, unfollowUser } from '../../api/follows.api';
import { getCurrentUser, getUserByUsername } from '../../api/users.api';
import { blockUser } from '../../api/blocks.api';
import { StackScreenHeader } from '../../components/StackScreenHeader';
import type { AppStackParamList } from '../../navigation/types';
import { queryClient } from '../../lib/query-client';

type Props = NativeStackScreenProps<AppStackParamList, 'UserProfile'>;

// FRONTEND_UI_UX_BLUEPRINT §11.2 — GET /users/:username

export function UserProfileScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { username: rawU } = route.params;
  const username = rawU.trim();

  const meQ = useQuery({ queryKey: ['me'], queryFn: getCurrentUser });
  const userQ = useQuery({
    queryKey: ['user', 'public', username],
    queryFn: () => getUserByUsername(username),
    enabled: username.length > 0,
  });

  const followStatusQ = useQuery({
    queryKey: ['follow-status', userQ.data?.id],
    queryFn: () => checkIsFollowingUser(userQ.data!.id),
    enabled: Boolean(userQ.data && meQ.data && userQ.data.id !== meQ.data.id),
  });

  const followM = useMutation({
    mutationFn: async (next: 'follow' | 'unfollow') => {
      const id = userQ.data?.id;
      if (!id) return;
      if (next === 'follow') await followUser(id);
      else await unfollowUser(id);
    },
    onSuccess: () => {
      const id = userQ.data?.id;
      if (id) {
        void queryClient.invalidateQueries({ queryKey: ['follow-status', id] });
        void queryClient.invalidateQueries({ queryKey: ['user', 'public', username] });
        void queryClient.invalidateQueries({ queryKey: ['me'] });
      }
    },
  });

  const blockM = useMutation({
    mutationFn: async () => {
      const id = userQ.data?.id;
      if (!id) return;
      await blockUser(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['blocks'] });
      navigation.goBack();
    },
  });

  const onBlock = useCallback(() => {
    Alert.alert(t('userProfile.blockTitle'), t('userProfile.blockBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('userProfile.blockCta'), style: 'destructive', onPress: () => void blockM.mutateAsync() },
    ]);
  }, [blockM, t, navigation]);

  if (userQ.isError) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <StackScreenHeader title={`@${username}`} />
        <View style={styles.center}>
          <Text style={styles.muted}>{t('userProfile.notFound')}</Text>
          <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
            <Text style={styles.btnText}>{t('common.back')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (userQ.isPending || !userQ.data) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <StackScreenHeader title={`@${username}`} />
        <View style={styles.center}>
          <ActivityIndicator color="#ff6a00" />
        </View>
      </SafeAreaView>
    );
  }

  const p = userQ.data;
  const isMe = meQ.data?.id === p.id;
  const isFollowing = followStatusQ.data === true;
  const showActions = !isMe && meQ.data;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StackScreenHeader title={`@${p.username}`} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {p.avatarUrl ? (
            <Image source={{ uri: p.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPh]}>
              <Text style={styles.mono}>{p.username.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.displayName}>{p.name ?? p.username}</Text>
          {p.bio ? <Text style={styles.bio}>{p.bio}</Text> : null}
          {p.isPrivate ? (
            <Text style={styles.lock}>{t('userProfile.private')}</Text>
          ) : null}
        </View>

        <View style={styles.stats}>
          <Stat label={t('profile.posts')} value={p.postsCount} />
          <Stat label={t('profile.followers')} value={p.followersCount} />
          <Stat label={t('profile.following')} value={p.followingCount} />
        </View>

        {p.ridingStyle.length > 0 ? (
          <View style={styles.chips}>
            {p.ridingStyle.map((s) => (
              <View key={s} style={styles.chip}>
                <Text style={styles.chipText}>{s}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {isMe ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>{t('userProfile.itsMeCta')}</Text>
          </Pressable>
        ) : null}

        {showActions ? (
          <View style={styles.actions}>
            {followStatusQ.isLoading ? (
              <ActivityIndicator color="#ff6a00" />
            ) : (
              <Pressable
                style={[styles.primaryBtn, isFollowing && styles.secondaryBtn, followM.isPending && styles.disabled]}
                onPress={() => {
                  if (followM.isPending) return;
                  void followM.mutateAsync(isFollowing ? 'unfollow' : 'follow');
                }}
                disabled={followM.isPending}
              >
                <Text style={isFollowing ? styles.secondaryBtnText : styles.primaryBtnText}>
                  {isFollowing ? t('userProfile.unfollow') : t('userProfile.follow')}
                </Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.dangerBtn, (blockM.isPending || followM.isPending) && styles.disabled]}
              onPress={onBlock}
              disabled={blockM.isPending}
            >
              <Text style={styles.dangerText}>{t('userProfile.block')}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#888', textAlign: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 12, backgroundColor: '#333' },
  avatarPh: { alignItems: 'center', justifyContent: 'center' },
  mono: { color: '#fff', fontSize: 36, fontWeight: '800' },
  displayName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  bio: { color: '#aaa', marginTop: 8, textAlign: 'center' },
  lock: { color: '#ff6a00', marginTop: 8, fontSize: 12, fontWeight: '600' },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  stat: { alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#888', fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24, justifyContent: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#222', borderRadius: 16 },
  chipText: { color: '#fff', fontSize: 12 },
  actions: { gap: 12 },
  primaryBtn: {
    backgroundColor: '#ff6a00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0b0b0d', fontWeight: '800' },
  secondaryBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ff6a00' },
  secondaryBtnText: { color: '#ff6a00', fontWeight: '800' },
  dangerBtn: { paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#8b2020', alignItems: 'center' },
  dangerText: { color: '#e66', fontWeight: '600' },
  disabled: { opacity: 0.5 },
  btn: { marginTop: 16, borderWidth: 1, borderColor: '#444', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  btnText: { color: '#fff' },
});
