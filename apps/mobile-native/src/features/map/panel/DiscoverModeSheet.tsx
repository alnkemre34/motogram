import type { NearbyRider } from '@motogram/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { getEvent, listNearbyEvents } from '../../../api/event.api';
import { getParty, joinParty, listNearbyParties } from '../../../api/party.api';
import { captureException } from '../../../lib/sentry';
import { useMapStore } from '../../../store/map.store';
import { usePartyStore } from '../../../store/party.store';

interface Props {
  riders: NearbyRider[];
  isLoading: boolean;
  center: { lat: number; lng: number };
  radiusMeters: number;
  onJoinedParty?: () => void;
  /** Empty-state CTA — parent opens party creation (e.g. `PartyCreateModal` on Map). */
  onPressCreateParty?: () => void;
  /** Empty state CTA for Events filter — navigates to stack `EventCreate`. */
  onPressCreateEvent?: () => void;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

export function DiscoverModeSheet({
  riders,
  isLoading,
  center,
  radiusMeters,
  onJoinedParty,
  onPressCreateParty,
  onPressCreateEvent,
}: Props) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const open = useMapStore((s) => s.panelOpen);
  const togglePanel = useMapStore((s) => s.togglePanel);
  const activeFilter = useMapStore((s) => s.filters.filter);
  const selectRider = useMapStore((s) => s.selectRider);
  const setParty = usePartyStore((s) => s.setParty);

  const panelWidth = Math.round(width / 3);

  const [eventOpen, setEventOpen] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  const partiesQuery = useQuery({
    queryKey: ['map', 'nearby-parties', center.lat, center.lng, radiusMeters] as const,
    enabled: open && activeFilter === 'PARTIES',
    queryFn: () => listNearbyParties({ lat: center.lat, lng: center.lng, radiusMeters }),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const eventsQuery = useQuery({
    queryKey: ['map', 'nearby-events', center.lat, center.lng, radiusMeters] as const,
    enabled: open && activeFilter === 'EVENTS',
    queryFn: () => listNearbyEvents({ lat: center.lat, lng: center.lng, radiusMeters }),
    staleTime: 10_000,
    refetchInterval: 60_000,
  });

  const eventDetailQuery = useQuery({
    queryKey: ['events', 'detail', activeEventId] as const,
    enabled: eventOpen && activeEventId !== null,
    queryFn: () => getEvent(activeEventId as string),
    staleTime: 30_000,
  });

  const joinMut = useMutation({
    mutationFn: async (partyId: string) => {
      const detail = await joinParty(partyId);
      // defensive: ensure fresh detail payload shape
      return getParty(detail.id);
    },
    onSuccess: (detail) => {
      setParty(detail);
      onJoinedParty?.();
    },
    onError: (err) => captureException(err),
  });

  return (
    <>
      <Pressable
        onPress={togglePanel}
        style={[styles.handle, { right: open ? panelWidth : 0, top: height / 2 - 30 }]}
        accessibilityRole="button"
        accessibilityLabel={t('map.panel.handle')}
      >
        <View style={styles.handleBar} />
      </Pressable>

      {open ? (
        <View style={[styles.panel, { width: panelWidth }]}>
          <Text style={styles.title}>{t(`map.panel.title.${activeFilter.toLowerCase()}`)}</Text>

          {activeFilter === 'PARTIES' ? (
            partiesQuery.isFetching ? (
              <View style={styles.skeleton}>
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
            ) : (partiesQuery.data?.parties?.length ?? 0) === 0 ? (
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
                data={partiesQuery.data?.parties ?? []}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.row}>
                    <View style={styles.avatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{item.name}</Text>
                      <Text style={styles.rowSubtitle}>
                        {item.memberCount}/{item.maxMembers}
                        {typeof item.distance === 'number' ? ` · ${formatDistance(item.distance)}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => joinMut.mutate(item.id)}
                      disabled={joinMut.isPending}
                      style={[styles.joinBtn, joinMut.isPending && styles.joinBtnDisabled]}
                    >
                      <Text style={styles.joinBtnText}>{t('map.parties.join')}</Text>
                    </Pressable>
                  </View>
                )}
              />
            )
          ) : activeFilter === 'EVENTS' ? (
            eventsQuery.isFetching ? (
              <View style={styles.skeleton}>
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
            ) : (eventsQuery.data?.events?.length ?? 0) === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>{t('map.empty.title')}</Text>
                <Text style={styles.emptyBody}>{t('map.empty.body')}</Text>
                <Pressable
                  style={[styles.emptyCta, !onPressCreateEvent && styles.emptyCtaDisabled]}
                  disabled={!onPressCreateEvent}
                  onPress={onPressCreateEvent}
                >
                  <Text style={styles.emptyCtaText}>{t('map.empty.createEvent')}</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={eventsQuery.data?.events ?? []}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.row}
                    onPress={() => {
                      setActiveEventId(item.id);
                      setEventOpen(true);
                    }}
                  >
                    <View style={styles.avatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.rowSubtitle}>
                        {item.participantsCount}
                        {typeof item.distance === 'number' ? ` · ${formatDistance(item.distance)}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.rowAction}>{t('map.events.view')}</Text>
                  </Pressable>
                )}
              />
            )
          ) : isLoading ? (
            <View style={styles.skeleton}>
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
      ) : null}

      <Modal visible={eventOpen} animationType="slide" transparent onRequestClose={() => setEventOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setEventOpen(false)} />
          <View style={styles.modalCard}>
            {eventDetailQuery.isFetching ? (
              <View style={{ paddingVertical: 24 }}>
                <ActivityIndicator color="#F5A623" />
              </View>
            ) : eventDetailQuery.data ? (
              <>
                <Text style={styles.eventTitle}>{eventDetailQuery.data.title}</Text>
                <Text style={styles.eventMeta}>
                  {eventDetailQuery.data.meetingPointName} · {formatWhen(eventDetailQuery.data.startTime)}
                </Text>
                <Text style={styles.eventMeta2}>
                  {eventDetailQuery.data.participantsCount}
                  {typeof eventDetailQuery.data.maxParticipants === 'number'
                    ? `/${eventDetailQuery.data.maxParticipants}`
                    : ''}
                  {eventDetailQuery.data.category ? ` · ${eventDetailQuery.data.category}` : ''}
                  {eventDetailQuery.data.difficulty ? ` · ${eventDetailQuery.data.difficulty}` : ''}
                  {eventDetailQuery.data.viewerRsvp ? ` · ${eventDetailQuery.data.viewerRsvp}` : ''}
                </Text>
                {eventDetailQuery.data.description ? (
                  <Text style={styles.eventBody}>{eventDetailQuery.data.description}</Text>
                ) : null}
                {eventDetailQuery.data.rules ? (
                  <Text style={styles.eventBody}>{eventDetailQuery.data.rules}</Text>
                ) : null}
                <View style={styles.eventActions}>
                  <Pressable style={styles.eventCloseBtn} onPress={() => setEventOpen(false)}>
                    <Text style={styles.eventCloseText}>{t('common.done')}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.eventBody}>{t('common.error')}</Text>
            )}
          </View>
        </View>
      </Modal>
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
  joinBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F5A623',
  },
  joinBtnDisabled: { opacity: 0.6 },
  joinBtnText: { color: '#0b0b10', fontWeight: '900', fontSize: 12 },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#121218',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  eventTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  eventMeta: { color: 'rgba(255,255,255,0.65)', marginTop: 6, fontSize: 12, fontWeight: '600' },
  eventMeta2: { color: 'rgba(255,255,255,0.55)', marginTop: 4, fontSize: 12, fontWeight: '600' },
  eventBody: { color: 'rgba(255,255,255,0.85)', marginTop: 12, fontSize: 13, lineHeight: 18 },
  eventActions: { marginTop: 16, flexDirection: 'row', justifyContent: 'flex-end' },
  eventCloseBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F5A623' },
  eventCloseText: { color: '#0b0b10', fontWeight: '900' },
});

