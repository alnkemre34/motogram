import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NearbyRider } from '@motogram/shared';

import { useMapStore } from '../../../store/map.store';

// Spec 2.3.1 - Sag Panel Cekmecesi (1/3 ekran) - Yakindakiler/Arkadaslar/Partiler/Etkinlikler
// Handle tutulunca acilir/kapanir; harita padding otomatik olarak ayarlanmali
// (parent MapScreen: setPadding({ right: screenWidth/3 })).

interface Props {
  riders: NearbyRider[];
  isLoading: boolean;
  /** Bos liste CTA — `CreateParty` modalini acar (R6). */
  onPressCreateParty?: () => void;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function DiscoverModeSheet({ riders, isLoading, onPressCreateParty }: Props) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const open = useMapStore((s) => s.panelOpen);
  const togglePanel = useMapStore((s) => s.togglePanel);
  const activeFilter = useMapStore((s) => s.filters.filter);
  const selectRider = useMapStore((s) => s.selectRider);

  const panelWidth = Math.round(width / 3);

  return (
    <>
      {/* Handle - sag kenar dikey tutamak (Spec 2.3.1) */}
      <Pressable
        onPress={togglePanel}
        style={[
          styles.handle,
          { right: open ? panelWidth : 0, top: height / 2 - 30 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('map.panel.handle')}
      >
        <View style={styles.handleBar} />
      </Pressable>

      {open && (
        <View style={[styles.panel, { width: panelWidth }]}>
          <Text style={styles.title}>{t(`map.panel.title.${activeFilter.toLowerCase()}`)}</Text>

          {isLoading ? (
            <View style={styles.skeleton}>
              {/* Spec 2.3.1 - Skeleton loader */}
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <View style={styles.skeletonAvatar} />
                  <View style={styles.skeletonLines}>
                    <View style={styles.skeletonLine} />
                    <View style={[styles.skeletonLine, { width: '60%' }]} />
                  </View>
                </View>
              ))}
              <ActivityIndicator color="#F5A623" style={{ marginTop: 8 }} />
            </View>
          ) : riders.length === 0 ? (
            // Spec 7.3.2 - Proaktif bos durum mesaji
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('map.empty.title')}</Text>
              <Text style={styles.emptyBody}>{t('map.empty.body')}</Text>
              <Pressable
                style={[styles.emptyCta, !onPressCreateParty && styles.emptyCtaDisabled]}
                disabled={!onPressCreateParty}
                onPress={onPressCreateParty}
              >
                <Text style={styles.emptyCtaText}>{t('map.empty.createParty')}</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={riders}
              keyExtractor={(item) => item.userId}
              renderItem={({ item }) => (
                <Pressable onPress={() => selectRider(item.userId)} style={styles.row}>
                  <View style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.username}</Text>
                    <Text style={styles.rowSubtitle}>
                      {formatDistance(item.distance)}
                      {item.inParty ? ` · ${t('map.rider.inParty')}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.rowAction}>›</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    width: 24,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,28,0.75)',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  handleBar: { width: 4, height: 36, backgroundColor: '#F5A623', borderRadius: 2 },
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,10,14,0.92)',
    padding: 16,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#222',
    marginRight: 10,
  },
  rowTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rowSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  rowAction: { color: 'rgba(255,255,255,0.45)', fontSize: 18 },
  skeleton: { gap: 10 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  skeletonAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginRight: 10,
  },
  skeletonLines: { flex: 1, gap: 6 },
  skeletonLine: {
    height: 10,
    width: '80%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
  },
  empty: { marginTop: 24, alignItems: 'center', gap: 10 },
  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  emptyBody: { color: 'rgba(255,255,255,0.65)', fontSize: 13, textAlign: 'center' },
  emptyCta: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F5A623',
  },
  emptyCtaDisabled: { opacity: 0.45 },
  emptyCtaText: { color: '#0b0b10', fontWeight: '700' },
});
