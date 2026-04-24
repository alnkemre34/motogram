import { Camera, MapView, PointAnnotation, UserLocation } from '@maplibre/maplibre-react-native';
import type { LocationSharingMode, ThermalState } from '@motogram/shared';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { leaveParty } from '../../api/party.api';
import { env } from '../../config/env';
import { SosButton } from '../../features/emergency/SosButton';
import { MapFilterBar } from '../../features/map/filters/MapFilterBar';
import { DiscoverModeSheet } from '../../features/map/panel/DiscoverModeSheet';
import { PartySignalFeed } from '../../features/party/PartySignalFeed';
import { RideModeHUD } from '../../features/party/RideModeHUD';
import { useLocationBroadcast } from '../../hooks/useLocationBroadcast';
import { useNearbyRiders } from '../../hooks/useNearbyRiders';
import { useParty } from '../../hooks/useParty';
import { captureException } from '../../lib/sentry';
import { StorageKeys, getString } from '../../lib/storage';
import { PartyCreateModal } from '../party/PartyCreateModal';
import { useAuthStore } from '../../store/auth.store';
import { useMapStore } from '../../store/map.store';
import { usePartyStore } from '../../store/party.store';
import { useForegroundLocation } from '../../hooks/useForegroundLocation';
import { startRideLocationService, stopRideLocationService } from '../../lib/ride-location-service';
import { useBackgroundLocationPermission } from '../../hooks/useBackgroundLocationPermission';
import { useIosBackgroundLocationPermission } from '../../hooks/useIosBackgroundLocationPermission';
import type { AppStackParamList } from '../../navigation/types';

/** Default map center (Istanbul) until GPS fix. [lng, lat] */
const DEFAULT_CENTER: [number, number] = [28.9784, 41.0082];

type Mode = 'DISCOVER' | 'RIDE';

interface UserGeo {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export function MapScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const rootNav = navigation.getParent<NativeStackNavigationProp<AppStackParamList>>();
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
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userGeo, setUserGeo] = useState<UserGeo | null>(null);
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

  const fgLocation = useForegroundLocation({ enabled: true });
  useEffect(() => {
    if (!fgLocation.fix) return;
    setCenter([fgLocation.fix.lng, fgLocation.fix.lat]);
    setUserGeo({
      lat: fgLocation.fix.lat,
      lng: fgLocation.fix.lng,
      accuracy: fgLocation.fix.accuracy,
      heading: fgLocation.fix.heading,
      speed: fgLocation.fix.speed,
    });
  }, [fgLocation.fix]);

  const broadcastEnabled =
    userGeo !== null &&
    (mode === 'RIDE' ? Boolean(party) : sharingMode !== 'OFF');

  const partyWs = useParty(mode === 'RIDE' ? party?.id ?? null : null);

  const bgPerm = useBackgroundLocationPermission({ enabled: mode === 'RIDE' && Boolean(party) });
  const iosBgPerm = useIosBackgroundLocationPermission({ enabled: mode === 'RIDE' && Boolean(party) });

  useEffect(() => {
    if (mode === 'RIDE' && party) {
      startRideLocationService();
    } else {
      stopRideLocationService();
    }
    return () => stopRideLocationService();
  }, [mode, party]);

  useLocationBroadcast({
    enabled: broadcastEnabled,
    lat: userGeo?.lat ?? center[1],
    lng: userGeo?.lng ?? center[0],
    accuracyMeters: userGeo?.accuracy,
    heading: userGeo?.heading,
    speed: userGeo?.speed,
    thermalState,
    partyId: party?.id,
    wsPartySendLocation: mode === 'RIDE' && party ? partyWs.sendLocation : undefined,
  });

  const nearbyQuery = useNearbyRiders({
    lat: center[1],
    lng: center[0],
    filter: filters.filter,
    radiusMeters: filters.radiusMeters,
    enabled: mode === 'DISCOVER',
  });

  const mapPadding = useMemo(
    () => ({ paddingLeft: 0, paddingRight: panelOpen ? width / 3 : 0, paddingTop: 0, paddingBottom: 0 }),
    [panelOpen, width],
  );

  const leader = party?.members.find((m) => m.role === 'LEADER');
  const isLeader = Boolean(leader && userId && leader.userId === userId);

  async function handleLeaveParty() {
    if (!party) return;
    Alert.alert(t('map.partyLeaveTitle'), t('map.partyLeaveBody'), [
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
    ]);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.segmentWrap}>
        <Pressable onPress={() => setMode('DISCOVER')} style={[styles.segment, mode === 'DISCOVER' && styles.segmentActive]}>
          <Text style={[styles.segmentText, mode === 'DISCOVER' && styles.segmentTextActive]}>
            {t('map.segments.discover')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('RIDE')}
          disabled={!party}
          style={[styles.segment, mode === 'RIDE' && styles.segmentActive, !party && styles.segmentDisabled]}
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

      {mode === 'DISCOVER' ? <MapFilterBar /> : null}

      <View style={styles.mapWrap}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          mapStyle={env.mapStyleUrl}
          logoEnabled={false}
          attributionEnabled
          compassEnabled
        >
          <Camera
            zoomLevel={13}
            centerCoordinate={center}
            padding={mapPadding}
            animationMode="flyTo"
            animationDuration={600}
          />
          <UserLocation
            visible
            showsUserHeadingIndicator
          />
          {mode === 'DISCOVER'
            ? riders.map((r) => (
                <PointAnnotation key={r.userId} id={r.userId} coordinate={[r.lng, r.lat]}>
                  <View style={styles.pin}>
                    <View style={[styles.pinInner, r.inParty && styles.pinParty]} />
                  </View>
                </PointAnnotation>
              ))
            : null}
          {mode === 'RIDE'
            ? Object.values(liveMembers).map((m) => (
                <PointAnnotation key={`live-${m.userId}`} id={`live-${m.userId}`} coordinate={[m.lng, m.lat]}>
                  <View style={styles.partyPin}>
                    <View style={styles.partyPinInner} />
                  </View>
                </PointAnnotation>
              ))
            : null}
        </MapView>

        {fgLocation.status === 'denied' ? (
          <View style={styles.locationBlock}>
            <Text style={styles.locationTitle}>{t('map.location.deniedTitle')}</Text>
            <Text style={styles.locationBody}>{t('map.location.deniedBody')}</Text>
          </View>
        ) : fgLocation.status === 'error' ? (
          <View style={styles.locationBlock}>
            <Text style={styles.locationTitle}>{t('map.location.errorTitle')}</Text>
            <Text style={styles.locationBody}>{t('map.location.errorBody')}</Text>
          </View>
        ) : mode === 'RIDE' && party && Platform.OS === 'ios' && iosBgPerm.canAsk && iosBgPerm.status !== 'granted' ? (
          <View style={styles.locationBlock}>
            <Text style={styles.locationTitle}>{t('map.location.bgTitle')}</Text>
            <Text style={styles.locationBody}>{t('map.location.bgBody')}</Text>
            <Pressable
              style={({ pressed }) => [styles.locationCta, pressed && { opacity: 0.85 }]}
              onPress={async () => {
                const ok = await iosBgPerm.request();
                if (!ok) {
                  Linking.openSettings().catch(() => {});
                }
              }}
            >
              <Text style={styles.locationCtaText}>{t('map.location.bgCta')}</Text>
            </Pressable>
          </View>
        ) : mode === 'RIDE' && party && bgPerm.canAsk && bgPerm.status === 'denied' ? (
          <View style={styles.locationBlock}>
            <Text style={styles.locationTitle}>{t('map.location.bgTitle')}</Text>
            <Text style={styles.locationBody}>{t('map.location.bgBody')}</Text>
            <Pressable
              style={({ pressed }) => [styles.locationCta, pressed && { opacity: 0.85 }]}
              onPress={async () => {
                const ok = await bgPerm.request();
                if (!ok) {
                  Linking.openSettings().catch(() => {});
                }
              }}
            >
              <Text style={styles.locationCtaText}>{t('map.location.bgCta')}</Text>
            </Pressable>
          </View>
        ) : null}

        {mode === 'DISCOVER' ? (
          <DiscoverModeSheet
            riders={riders}
            isLoading={nearbyQuery.isFetching}
            center={{ lat: center[1], lng: center[0] }}
            radiusMeters={filters.radiusMeters}
            onPressCreateParty={() => setPartyCreateOpen(true)}
            onPressCreateEvent={() => rootNav?.navigate('EventCreate')}
            onJoinedParty={() => setMode('RIDE')}
          />
        ) : null}

        {userGeo ? (
          <View
            style={[styles.sosOverlay, mode === 'RIDE' && party ? styles.sosOverlayAboveHud : null]}
            pointerEvents="box-none"
          >
            <SosButton latitude={userGeo.lat} longitude={userGeo.lng} accuracyMeters={userGeo.accuracy} />
          </View>
        ) : null}

        <PartyCreateModal
          visible={partyCreateOpen}
          onClose={() => setPartyCreateOpen(false)}
          onCreated={() => setMode('RIDE')}
        />

        {mode === 'RIDE' && party ? (
          <>
            <RideModeHUD
              connected={partyWs.connected}
              leaderName={leader?.username}
              isLeader={isLeader}
              memberCount={party.memberCount}
              onSignal={(type) => partyWs.sendSignal(type)}
              onLeave={handleLeaveParty}
              disabled={!partyWs.connected}
            />
            <PartySignalFeed />
          </>
        ) : null}

        {mode === 'RIDE' && !party ? (
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
        ) : null}
      </View>

      {__DEV__ && lastDuration !== null && mode === 'DISCOVER' ? (
        <View style={styles.devBadge}>
          <Text style={styles.devBadgeText}>{t('map.devNearbyMs', { ms: lastDuration })}</Text>
          {nearbyQuery.isFetching ? <Text style={styles.devBadgeSub}>{t('common.loading')}</Text> : null}
        </View>
      ) : null}
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
  sosOverlay: { position: 'absolute', left: 12, bottom: 20, zIndex: 2 },
  sosOverlayAboveHud: { bottom: 130 },
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
  noParty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(11,11,13,0.88)',
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
  locationBlock: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(11,11,13,0.88)',
  },
  locationTitle: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  locationBody: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  locationCta: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F5A623',
  },
  locationCtaText: { color: '#0b0b10', fontWeight: '900' },
  devBadge: {
    position: 'absolute',
    right: 10,
    bottom: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  devBadgeText: { color: '#ccc', fontSize: 11 },
  devBadgeSub: { color: '#888', fontSize: 10, marginTop: 2 },
});
