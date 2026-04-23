import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import type { CommunitySummary } from '@motogram/shared';

import { listMyCommunities, listNearbyCommunities, searchCommunities } from '../../api/community.api';
import { canQueryCommunitySearch } from '../../lib/discover-search';
import type { AppStackParamList } from '../../navigation/types';

type RootNav = NativeStackNavigationProp<AppStackParamList>;
type Tab = 'nearby' | 'mine';

// P6 / FRONTEND_UI_UX_BLUEPRINT — Topluluk: yakın, benim, metin araması (B-12)

export function DiscoverScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const rootNav = navigation.getParent<RootNav>();
  const [tab, setTab] = useState<Tab>('nearby');
  const [search, setSearch] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locDenied, setLocDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await Location.requestForegroundPermissionsAsync();
      if (!p.granted) {
        setLocDenied(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    })();
  }, []);

  const searchEnabled = canQueryCommunitySearch(search);
  const qTrim = search.trim();

  const searchQ = useQuery({
    queryKey: ['communities', 'search', qTrim],
    queryFn: () => searchCommunities({ q: qTrim, limit: 20 }),
    enabled: searchEnabled,
    staleTime: 15_000,
  });

  const nearbyQ = useQuery({
    queryKey: ['communities', 'nearby', coords?.lat, coords?.lng],
    queryFn: () =>
      listNearbyCommunities({
        lat: coords!.lat,
        lng: coords!.lng,
        radius: 50_000,
        limit: 30,
      }),
    enabled: Boolean(coords) && !searchEnabled && tab === 'nearby',
    staleTime: 30_000,
  });

  const mineQ = useQuery({
    queryKey: ['communities', 'me'],
    queryFn: listMyCommunities,
    enabled: !searchEnabled && tab === 'mine',
    staleTime: 20_000,
  });

  const listData: CommunitySummary[] = useMemo(() => {
    if (searchEnabled) {
      return searchQ.data?.items ?? [];
    }
    if (tab === 'nearby') {
      return (nearbyQ.data?.communities ?? []).map(({ distance: _d, ...rest }) => rest as CommunitySummary);
    }
    return mineQ.data?.communities ?? [];
  }, [searchEnabled, searchQ.data, tab, nearbyQ.data, mineQ.data]);

  const loading = searchEnabled
    ? searchQ.isPending
    : tab === 'nearby'
      ? Boolean(coords) && nearbyQ.isPending
      : mineQ.isPending;

  const refreshing = searchEnabled
    ? searchQ.isFetching
    : tab === 'nearby'
      ? nearbyQ.isFetching
      : mineQ.isFetching;

  const isError = searchEnabled ? searchQ.isError : tab === 'nearby' ? nearbyQ.isError : mineQ.isError;

  const onRefresh = () => {
    if (searchEnabled) void searchQ.refetch();
    else if (tab === 'nearby') void nearbyQ.refetch();
    else void mineQ.refetch();
  };

  const showNearbyHint = !searchEnabled && tab === 'nearby' && (locDenied || !coords);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <Text style={styles.title} accessibilityRole="header">
          {t('tabs.community')}
        </Text>
        <Pressable
          onPress={() => rootNav?.navigate('CreateCommunity')}
          style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('discover.createCommunityA11y')}
        >
          <Text style={styles.createBtnText}>+ {t('discover.createCommunity')}</Text>
        </Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        style={styles.search}
        placeholder={t('discover.searchPlaceholder')}
        placeholderTextColor="#666"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={t('discover.searchA11y')}
      />
      {searchEnabled ? (
        <Text style={styles.hint}>{t('discover.searching')}</Text>
      ) : (
        <View style={styles.tabs}>
          <TabBtn label={t('discover.tabNearby')} active={tab === 'nearby'} onPress={() => setTab('nearby')} />
          <TabBtn label={t('discover.tabMine')} active={tab === 'mine'} onPress={() => setTab('mine')} />
        </View>
      )}

      {isError ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.error')}</Text>
          <Pressable style={styles.retry} onPress={() => onRefresh()}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#ff6a00" />
        </View>
      ) : showNearbyHint ? (
        <View style={styles.center}>
          <Text style={styles.muted}>
            {locDenied ? t('discover.locationDenied') : t('discover.locationPending')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6a00" />
          }
          ListEmptyComponent={
            <Text style={styles.muted}>
              {searchEnabled ? t('discover.emptySearch') : t('discover.empty')}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => rootNav?.navigate('CommunityDetail', { id: item.id })}
              accessibilityRole="button"
            >
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.region ? <Text style={styles.cardSub}>{item.region}</Text> : null}
              <Text style={styles.cardMeta}>
                {t('discover.memberCount', { n: item.membersCount })} · {item.visibility}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', flex: 1 },
  createBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#1a1a1e' },
  createBtnText: { color: '#ff6a00', fontWeight: '800', fontSize: 14 },
  search: {
    marginHorizontal: 16,
    backgroundColor: '#1a1a1e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
  },
  hint: { color: '#666', fontSize: 12, marginHorizontal: 16, marginTop: 4 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 4, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1a1a1e', alignItems: 'center' },
  tabActive: { backgroundColor: '#ff6a00' },
  tabLabel: { color: '#888', fontWeight: '700' },
  tabLabelActive: { color: '#0b0b0d' },
  list: { padding: 16, paddingTop: 8, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#888', textAlign: 'center' },
  retry: { marginTop: 12, borderWidth: 1, borderColor: '#444', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { color: '#fff' },
  card: { backgroundColor: '#1a1a1e', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cardSub: { color: '#999', fontSize: 12, marginTop: 2 },
  cardMeta: { color: '#666', fontSize: 11, marginTop: 6 },
  pressed: { opacity: 0.9 },
});
