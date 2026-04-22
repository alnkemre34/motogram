import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { apiRequest } from '../../lib/api-client';

// Spec 2.6 - Profil -> Garaj (motosikletler listesi).

interface MotorcycleDto {
  id: string;
  make: string;
  model: string;
  year: number | null;
  nickname: string | null;
  isPrimary: boolean;
  photoUrl: string | null;
}

export function GarageTab() {
  const { data, isLoading } = useQuery<MotorcycleDto[]>({
    queryKey: ['my-motorcycles'],
    queryFn: () => apiRequest('/motorcycles'),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff6a00" />
      </View>
    );
  }

  const bikes = data ?? [];
  if (bikes.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Garajina motor ekleyerek BIKE_ADDED gorevini tamamla.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={bikes}
      keyExtractor={(b) => b.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.photo} />
          <View style={styles.info}>
            <Text style={styles.title}>
              {item.make} {item.model} {item.year ?? ''}
            </Text>
            {item.nickname ? <Text style={styles.nick}>"{item.nickname}"</Text> : null}
            {item.isPrimary ? <Text style={styles.primary}>BIRINCIL</Text> : null}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', padding: 24 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#888', textAlign: 'center' },
  list: { padding: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1e',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  photo: { width: 96, height: 72, backgroundColor: '#333' },
  info: { flex: 1, padding: 12 },
  title: { color: '#fff', fontWeight: '700' },
  nick: { color: '#aaa', fontSize: 12, marginTop: 2 },
  primary: { color: '#ff6a00', fontSize: 10, marginTop: 4, fontWeight: '800' },
});
