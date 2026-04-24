import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentUser, type MeResponse } from '../../api/users.api';
import type { AppStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const rootNav = navigation.getParent<NativeStackNavigationProp<AppStackParamList>>();
  const clearSession = useAuthStore((s) => s.clearSession);

  const { data, isPending, isError, refetch } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: getCurrentUser,
  });

  if (isError) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{t('profile.errorLoad')}</Text>
        <Pressable style={styles.signOut} onPress={() => void refetch()}>
          <Text style={styles.signOutText}>{t('common.retry')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (isPending || !data) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#ff6a00" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <Pressable
          onPress={() => rootNav?.navigate('Settings')}
          style={({ pressed }) => [styles.settingsBtn, pressed && styles.pressedTop]}
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
        >
          <Text style={styles.settingsCog}>⚙</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar} />
          <Text style={styles.username}>@{data.username}</Text>
          {data.name ? <Text style={styles.name}>{data.name}</Text> : null}
          {data.bio ? <Text style={styles.bio}>{data.bio}</Text> : null}
        </View>

        <View style={styles.stats}>
          <Stat label={t('profile.posts')} value={data.postsCount} />
          <Stat label={t('profile.followers')} value={data.followersCount} />
          <Stat label={t('profile.following')} value={data.followingCount} />
        </View>

        <View style={styles.gamRow}>
          <Text style={styles.gamText}>
            {t('profile.level')} {data.level}
          </Text>
          <Text style={styles.gamText}>
            {data.xp} {t('profile.xp')}
          </Text>
        </View>

        <Pressable style={styles.signOut} onPress={clearSession}>
          <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
        </Pressable>
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
  center: { flex: 1, backgroundColor: '#0b0b0d', alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  topBarSpacer: { flex: 1 },
  settingsBtn: { padding: 8, borderRadius: 8 },
  settingsCog: { color: '#ff6a00', fontSize: 22, fontWeight: '600' },
  pressedTop: { opacity: 0.7 },
  content: { padding: 16 },
  header: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#333', marginBottom: 12 },
  username: { color: '#fff', fontSize: 22, fontWeight: '800' },
  name: { color: '#ddd', marginTop: 4 },
  bio: { color: '#aaa', marginTop: 8, textAlign: 'center' },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  stat: { alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#888', fontSize: 12, marginTop: 2 },
  gamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  gamText: { color: '#ff6a00', fontWeight: '700' },
  signOut: {
    marginTop: 24,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutText: { color: '#fff', fontWeight: '600' },
  errorText: { color: '#e66', textAlign: 'center', marginBottom: 16, paddingHorizontal: 24 },
});

