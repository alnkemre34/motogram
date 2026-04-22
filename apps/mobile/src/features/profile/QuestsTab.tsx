import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { listMyQuests } from '../../api/gamification.api';

// Spec 3.6 - Profil -> Gorevler (istatistik sekmesi).

export function QuestsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-quests'],
    queryFn: listMyQuests,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff6a00" />
      </View>
    );
  }
  const quests = data?.quests ?? [];
  if (quests.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aktif gorev yok.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={quests}
      keyExtractor={(q) => q.questId}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const pct = Math.min(100, Math.round((item.progress / item.targetValue) * 100));
        return (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>{item.quest.name}</Text>
              <Text style={styles.xp}>+{item.quest.xpReward} XP</Text>
            </View>
            <Text style={styles.desc}>{item.quest.description}</Text>
            <View style={styles.barBg}>
              <View style={[styles.barFg, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progress}>
              {item.progress}/{item.targetValue}
              {item.completed ? ' TAMAMLANDI' : ''}
            </Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { padding: 24, alignItems: 'center' },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#888' },
  list: { padding: 12 },
  card: { backgroundColor: '#1a1a1e', borderRadius: 12, padding: 12, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: '#fff', fontWeight: '700' },
  xp: { color: '#ff6a00', fontWeight: '800' },
  desc: { color: '#aaa', fontSize: 12, marginTop: 4 },
  barBg: { height: 6, backgroundColor: '#333', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  barFg: { height: 6, backgroundColor: '#ff6a00' },
  progress: { color: '#888', fontSize: 10, marginTop: 6 },
});
