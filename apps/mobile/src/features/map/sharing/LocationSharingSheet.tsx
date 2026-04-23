import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { LocationSharingMode } from '@motogram/shared';

import { updateLocationSharing } from '../../../api/map.api';
import { StorageKeys, setString } from '../../../lib/storage';
import { captureException } from '../../../lib/sentry';

// Spec 5.1 - Konum gizliligi modu secimi
// 7.3.2 prensibine uygun olarak ilk giriste varsayilan OFF degil FOLLOWERS_ONLY;
// kullanici aktif secimle degistirebilir.

const MODES: LocationSharingMode[] = [
  'OFF',
  'FOLLOWERS_ONLY',
  'MUTUAL_FOLLOWERS',
  'GROUP_MEMBERS',
  'PARTY_ONLY',
  'PUBLIC',
];

interface Props {
  mode: LocationSharingMode;
  onChange: (mode: LocationSharingMode) => void;
}

export function LocationSharingSheet({ mode, onChange }: Props) {
  const { t } = useTranslation();

  const handleSelect = async (next: LocationSharingMode) => {
    onChange(next);
    setString(StorageKeys.LocationSharingMode, next);
    try {
      await updateLocationSharing({ mode: next });
    } catch (err) {
      captureException(err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('map.sharing.title')}</Text>
      <Text style={styles.subtitle}>{t('map.sharing.subtitle')}</Text>
      {MODES.map((m) => (
        <Pressable
          key={m}
          onPress={() => handleSelect(m)}
          style={[styles.row, mode === m && styles.rowActive]}
        >
          <Text style={[styles.rowLabel, mode === m && styles.rowLabelActive]}>
            {t(`map.sharing.modes.${m}`)}
          </Text>
          <Text style={styles.rowDesc}>{t(`map.sharing.descriptions.${m}`)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#0b0b10' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4, marginBottom: 12 },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowActive: {
    borderColor: '#F5A623',
    backgroundColor: 'rgba(245,166,35,0.08)',
  },
  rowLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rowLabelActive: { color: '#F5A623' },
  rowDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 3 },
});
