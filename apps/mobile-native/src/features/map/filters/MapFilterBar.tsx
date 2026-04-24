import type { MapFilter } from '@motogram/shared';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useMapStore } from '../../../store/map.store';

const FILTERS: MapFilter[] = ['NEARBY', 'FRIENDS', 'PARTIES', 'EVENTS'];

export function MapFilterBar() {
  const { t } = useTranslation();
  const active = useMapStore((s) => s.filters.filter);
  const setFilter = useMapStore((s) => s.setFilter);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {FILTERS.map((f) => {
        const isActive = active === f;
        return (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, isActive && styles.chipActive]}>
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {t(`map.filters.${f.toLowerCase()}`)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(20,20,28,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#F5A623',
    borderColor: '#F5A623',
  },
  chipText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0b0b10' },
});
