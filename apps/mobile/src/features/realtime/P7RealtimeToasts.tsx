import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDistanceMeters } from '../../lib/p7-geo';
import { useP7RealtimeStore, type P7OverlayItem } from '../../store/p7-realtime.store';

// Blueprint §14.2 — gamification + emergency server→client geri bildirim

const DISMISS_MS = 6500;

const borderFor = (it: P7OverlayItem): string => {
  if (it.kind === 'quest') return '#2ecc71';
  if (it.kind === 'badge') return '#f1c40f';
  if (it.kind === 'emergencyNearby') return '#e74c3c';
  if (it.kind === 'emergencyResponder') return '#3498db';
  return '#95a5a6';
};

export function P7RealtimeToasts() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const items = useP7RealtimeStore((s) => s.items);
  const dismiss = useP7RealtimeStore((s) => s.dismiss);

  const label = useCallback(
    (it: P7OverlayItem) => {
      if (it.kind === 'quest') {
        return {
          title: t('realtime.questTitle'),
          body: t('realtime.questBody', {
            name: it.payload.questName,
            xp: it.payload.xpAwarded,
            level: it.payload.newUserLevel,
          }),
        };
      }
      if (it.kind === 'badge') {
        return {
          title: t('realtime.badgeTitle'),
          body: t('realtime.badgeBody', { name: it.payload.badgeName, rarity: it.payload.rarity }),
        };
      }
      if (it.kind === 'emergencyNearby') {
        return {
          title: t('realtime.emergencyNearbyTitle'),
          body: t('realtime.emergencyNearbyBody', {
            user: it.payload.requesterUsername,
            type: it.payload.type,
            distance: formatDistanceMeters(it.payload.distanceMeters),
          }),
        };
      }
      if (it.kind === 'emergencyResponder') {
        return {
          title: t('realtime.emergencyResponderTitle'),
          body: t('realtime.emergencyResponderBody', { status: it.payload.status }),
        };
      }
      return {
        title: t('realtime.emergencyResolvedTitle'),
        body: t('realtime.emergencyResolvedBody', { resolution: it.payload.resolution }),
      };
    },
    [t],
  );

  useEffect(() => {
    if (items.length === 0) return;
    const timers = items.map((it) =>
      setTimeout(() => dismiss(it.id), Math.max(0, DISMISS_MS - (Date.now() - it.at))),
    );
    return () => timers.forEach(clearTimeout);
  }, [items, dismiss]);

  if (items.length === 0) return null;

  return (
    <View
      style={[styles.root, { top: insets.top + 6 }]}
      pointerEvents="box-none"
    >
      {items.map((it) => {
        const { title, body } = label(it);
        return (
          <Pressable
            key={it.id}
            onPress={() => dismiss(it.id)}
            style={[styles.toast, { borderColor: borderFor(it) }]}
          >
            <Text style={[styles.tTitle, { color: borderFor(it) }]}>{title}</Text>
            <Text style={styles.tBody} numberOfLines={4}>
              {body}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 10,
    right: 10,
    gap: 6,
    zIndex: 50,
    elevation: 50,
  },
  toast: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 12,
    borderWidth: 1,
  },
  tTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginBottom: 4 },
  tBody: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
