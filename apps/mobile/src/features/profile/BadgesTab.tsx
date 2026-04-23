import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { listMyBadges } from '../../api/gamification.api';

// Spec 2.6 + 3.2 - Profil -> Rozetler.

export function BadgesTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['my-badges'],
    queryFn: listMyBadges,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff6a00" />
      </View>
    );
  }
  const badges = data?.badges ?? [];
  if (badges.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t('profile.badgesEmpty')}</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={badges}
      keyExtractor={(b) => b.badge.id}
      numColumns={3}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => (
        <View style={[styles.cell, rarityStyle(item.badge.rarity)]}>
          <Text style={styles.name}>{item.badge.name}</Text>
          <Text style={styles.rarity}>{item.badge.rarity}</Text>
          {item.showcased ? <Text style={styles.showcase}>{t('profile.badgeShowcase')}</Text> : null}
        </View>
      )}
    />
  );
}

function rarityStyle(rarity: string) {
  switch (rarity) {
    case 'LEGENDARY':
      return { borderColor: '#ff6a00' };
    case 'EPIC':
      return { borderColor: '#9b59b6' };
    case 'RARE':
      return { borderColor: '#3498db' };
    case 'UNCOMMON':
      return { borderColor: '#2ecc71' };
    default:
      return { borderColor: '#444' };
  }
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#888', textAlign: 'center' },
  grid: { padding: 8 },
  cell: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 6,
    borderRadius: 12,
    backgroundColor: '#1a1a1e',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  name: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  rarity: { color: '#aaa', fontSize: 10, marginTop: 4 },
  showcase: { color: '#ff6a00', fontSize: 9, marginTop: 4, fontWeight: '800' },
});
