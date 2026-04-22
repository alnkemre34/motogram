import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BadgesTab } from '../../features/profile/BadgesTab';
import { GarageTab } from '../../features/profile/GarageTab';
import { QuestsTab } from '../../features/profile/QuestsTab';
import { getCurrentUser, type MeResponse } from '../../api/users.api';
import { useAuthStore } from '../../store/auth.store';

type ProfileTab = 'badges' | 'garage' | 'quests';

// Spec 2.6 - Profil: sticky garaj banner + sayilar + ridingStyle chipleri; `GET /users/me` = UserMeResponseSchema

export function ProfileScreen() {
  const { t } = useTranslation();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [tab, setTab] = useState<ProfileTab>('badges');

  const { data, isPending, isError, refetch } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: getCurrentUser,
  });

  if (isError) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Profil yuklenemedi. Tekrar dene.</Text>
        <Pressable style={styles.signOut} onPress={() => void refetch()}>
          <Text style={styles.signOutText}>Yenile</Text>
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

        {data.ridingStyle.length > 0 ? (
          <View style={styles.chips}>
            {data.ridingStyle.map((style) => (
              <View key={style} style={styles.chip}>
                <Text style={styles.chipText}>{style}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.tabBar}>
          <TabButton label="Rozetler" active={tab === 'badges'} onPress={() => setTab('badges')} />
          <TabButton label="Garaj" active={tab === 'garage'} onPress={() => setTab('garage')} />
          <TabButton label="Gorevler" active={tab === 'quests'} onPress={() => setTab('quests')} />
        </View>

        <View style={styles.tabContent}>
          {tab === 'badges' ? <BadgesTab /> : null}
          {tab === 'garage' ? <GarageTab /> : null}
          {tab === 'quests' ? <QuestsTab /> : null}
        </View>

        <Pressable style={styles.signOut} onPress={clearSession}>
          <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#222', borderRadius: 16 },
  chipText: { color: '#fff', fontSize: 12 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1e',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#ff6a00' },
  tabLabel: { color: '#888', fontWeight: '600' },
  tabLabelActive: { color: '#fff' },
  tabContent: { minHeight: 260 },
  signOut: { marginTop: 24, paddingVertical: 14, borderWidth: 1, borderColor: '#444', borderRadius: 12, alignItems: 'center' },
  signOutText: { color: '#fff', fontWeight: '600' },
  errorText: { color: '#e66', textAlign: 'center', marginBottom: 16, paddingHorizontal: 24 },
});
