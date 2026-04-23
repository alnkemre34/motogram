import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';

import { env } from '../../config/env';
import { DiscoverModeSheet } from '../../features/map/panel/DiscoverModeSheet';
import { MapFilterBar } from '../../features/map/filters/MapFilterBar';
import { PartySignalFeed } from '../../features/party/PartySignalFeed';
import { RideModeHUD } from '../../features/party/RideModeHUD';
import { useLocationBroadcast } from '../../hooks/useLocationBroadcast';
import { useNearbyRiders } from '../../hooks/useNearbyRiders';
import { useParty } from '../../hooks/useParty';
import { useAuthStore } from '../../store/auth.store';
import { useMapStore } from '../../store/map.store';
import { usePartyStore } from '../../store/party.store';
import { StorageKeys, getString } from '../../lib/storage';
import { captureException } from '../../lib/sentry';
import { leaveParty } from '../../api/party.api';
import { PartyCreateModal } from '../party/PartyCreateModal';
import type { LocationSharingMode, ThermalState } from '@motogram/shared';

// Spec 2.3 + 9.1 - Mapbox (Google Maps kesinlikle YASAK). Koyu tema.
// Spec 2.3.1 - Segmented Control (Kesif/Surus).
// Spec 2.3.2 - Surus Modu: aktif parti varsa HUD (3 buyuk buton + lider rozet + live uye pinleri).

if (env.mapboxAccessToken) {
  Mapbox.setAccessToken(env.mapboxAccessToken);
}

type Mode = 'DISCOVER' | 'RIDE';

export function MapScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const hydrate = useMapStore((s) => s.hydrate);
  const filters = useMapStore((s) => s.filters);
  const riders = useMapStore((s) => s.riders);
  const panelOpen = useMapStore((s) => s.panelOpen);
  const lastDuration = useMapStore((s) => s.lastQueryDurationMs);

  const userId = useAuthStore((s) => s.userId);
  const party = usePartyStore((s) => s.party);
  const liveMembers = usePartyStore((s) => s.liveMembers);
  const clearParty = usePartyStore((s) => s.clearParty);

  const [mode, setMode] = useState<Mode>('DISCOVER');
  const [partyCreateOpen, setPartyCreateOpen] = useState(false);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [sharingMode] = useState<LocationSharingMode>(() => {
    const stored = getString(StorageKeys.LocationSharingMode) as LocationSharingMode | undefined;
    return stored ?? 'FOLLOWERS_ONLY';
  });
  const [thermalState] = useState<ThermalState>('NORMAL');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (party && mode !== 'RIDE') setMode('RIDE');
  }, [party, mode]);

  useEffect(() => {
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCenter([pos.coords.longitude, pos.coords.latitude]);
    })();
  }, []);

  // Spec 3.3.2 - Konum yayini
  // Kesif: REST /location/update (sharing aciksa)
  // Surus: her zaman acik (Spec 5.1 - parti ici bypass)
  useLocationBroadcast({
    enabled: mode === 'RIDE' ? Boolean(party) : sharingMode !== 'OFF',
    thermalState,
    partyId: party?.id,
  });

  // Spec 3.5 - WebSocket party real-time
  const partyWs = useParty(mode === 'RIDE' ? party?.id ?? null : null);

  // WS uzerinden gelen konumu da gondermek icin useLocationBroadcast'ta REST sender var.
  // Faz 3 iskelet: Real-time emit suresi icin useLocationBroadcast'i WS'a bagliyoruz:
  // ancak Faz 3'te minimum kesisim olsun diye mevcut REST zinciri korunur; WS
  // emit'i Faz 3.1'de tam entegre olacak. Bkz: docs/PROJECT_BOARD.md

  const nearbyQuery = useNearbyRiders({
    lat: center?.[1] ?? null,
    lng: center?.[0] ?? null,
    filter: filters.filter,
    radiusMeters: filters.radiusMeters,
    enabled: Boolean(center) && mode === 'DISCOVER',
  });

  const mapPadding = useMemo(
    () => ({ paddingLeft: 0, paddingRight: panelOpen ? width / 3 : 0, paddingTop: 0, paddingBottom: 0 }),
    [panelOpen, width],
  );

  const leader = party?.members.find((m) => m.role === 'LEADER');
  const isLeader = Boolean(leader && userId && leader.userId === userId);

  async function handleLeaveParty() {
    if (!party) return;
    Alert.alert(
      t('map.partyLeaveTitle'),
      t('map.partyLeaveBody'),
      [
        { text: t('map.partyLeaveCancel'), style: 'cancel' },
        {
          text: t('map.partyLeaveConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              partyWs.leave();
              await leaveParty(party.id);
            } catch (err) {
              captureException(err);
            } finally {
              clearParty();
              setMode('DISCOVER');
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.segmentWrap}>
        <Pressable
          onPress={() => setMode('DISCOVER')}
          style={[styles.segment, mode === 'DISCOVER' && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, mode === 'DISCOVER' && styles.segmentTextActive]}>
            {t('map.segments.discover')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('RIDE')}
          disabled={!party}
          style={[
            styles.segment,
            mode === 'RIDE' && styles.segmentActive,
            !party && styles.segmentDisabled,
          ]}
        >
          <Text
            style={[
              !party ? styles.segmentTextDisabled : styles.segmentText,
              mode === 'RIDE' && styles.segmentTextActive,
            ]}
          >
            {t('map.segments.ride')}
          </Text>
        </Pressable>
      </View>

      {mode === 'DISCOVER' && <MapFilterBar />}

      <View style={styles.mapWrap}>
        {env.mapboxAccessToken ? (
          <Mapbox.MapView
            style={StyleSheet.absoluteFillObject}
            styleURL={env.mapboxStyleUrl}
            logoEnabled={false}
            attributionEnabled
            compassEnabled
          >
            {center && (
              <Mapbox.Camera
                zoomLevel={13}
                centerCoordinate={center}
                padding={mapPadding}
                animationMode="flyTo"
                animationDuration={600}
              />
            )}

            <Mapbox.UserLocation visible showsUserHeadingIndicator />

            {mode === 'DISCOVER' &&
              riders.map((r) => (
                <Mapbox.PointAnnotation
                  key={r.userId}
                  id={r.userId}
                  coordinate={[r.lng, r.lat]}
                >
                  <View style={styles.pin}>
                    <View style={[styles.pinInner, r.inParty && styles.pinParty]} />
                  </View>
                </Mapbox.PointAnnotation>
              ))}

            {/* Spec 2.3.2 - Parti icindeyken uye pinleri (renk: parti turuncu) */}
            {mode === 'RIDE' &&
              Object.values(liveMembers).map((m) => (
                <Mapbox.PointAnnotation
                  key={`live-${m.userId}`}
                  id={`live-${m.userId}`}
                  coordinate={[m.lng, m.lat]}
                >
                  <View style={styles.partyPin}>
                    <View style={styles.partyPinInner} />
                  </View>
                </Mapbox.PointAnnotation>
              ))}
          </Mapbox.MapView>
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.fallbackTitle}>{t('map.fallback.title')}</Text>
            <Text style={styles.fallbackBody}>{t('map.fallback.body')}</Text>
          </View>
        )}

        {mode === 'DISCOVER' && (
          <DiscoverModeSheet
            riders={riders}
            isLoading={nearbyQuery.isFetching}
            onPressCreateParty={() => setPartyCreateOpen(true)}
          />
        )}

        <PartyCreateModal
          visible={partyCreateOpen}
          onClose={() => setPartyCreateOpen(false)}
          onCreated={() => setMode('RIDE')}
        />

        {mode === 'RIDE' && party && (
          <>
            <RideModeHUD
              connected={partyWs.connected}
              leaderName={leader?.username}
              isLeader={isLeader}
              memberCount={party.memberCount}
              onSignal={(type) => partyWs.sendSignal(type)}
              onLeave={handleLeaveParty}
            />
            <PartySignalFeed />
          </>
        )}

        {mode === 'RIDE' && !party && (
          <View style={styles.noParty}>
            <Text style={styles.noPartyTitle}>{t('map.ride.noPartyTitle')}</Text>
            <Text style={styles.noPartyBody}>{t('map.ride.noPartyBody')}</Text>
            <Pressable
              style={({ pressed }) => [styles.noPartyCta, pressed && { opacity: 0.85 }]}
              onPress={() => setPartyCreateOpen(true)}
            >
              <Text style={styles.noPartyCtaText}>{t('map.ride.createPartyCta')}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {__DEV__ && lastDuration !== null && mode === 'DISCOVER' && (
        <View style={styles.devBadge}>
          <Text style={styles.devBadgeText}>nearby {lastDuration} ms</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  segmentWrap: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  segmentActive: { backgroundColor: '#F5A623' },
  segmentDisabled: { opacity: 0.4 },
  segmentText: { color: 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 14 },
  segmentTextActive: { color: '#0b0b10' },
  segmentTextDisabled: { color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: 14 },
  mapWrap: { flex: 1 },
  pin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: 3,
    borderWidth: 1,
    borderColor: '#F5A623',
  },
  pinInner: { flex: 1, backgroundColor: '#F5A623', borderRadius: 6 },
  pinParty: { backgroundColor: '#e94e2b' },
  partyPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 3,
    borderWidth: 2,
    borderColor: '#e94e2b',
  },
  partyPinInner: { flex: 1, backgroundColor: '#e94e2b', borderRadius: 8 },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  fallbackBody: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  noParty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  noPartyTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  noPartyBody: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 16 },
  noPartyCta: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F5A623',
  },
  noPartyCtaText: { color: '#0b0b10', fontWeight: '900' },
  devBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  devBadgeText: { color: '#F5A623', fontSize: 11, fontVariant: ['tabular-nums'] },
});
