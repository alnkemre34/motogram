import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePartyStore } from '../../store/party.store';

// Spec 2.3.2 - Sinyal geldiginde ekrana kisa bir uyari dus (DB'de log YOK, sadece live)

const COLORS: Record<string, string> = {
  REGROUP: '#2ecc71',
  STOP: '#e74c3c',
  FUEL: '#f39c12',
};

export function PartySignalFeed() {
  const { t } = useTranslation();
  const signals = usePartyStore((s) => s.recentSignals);
  const dismiss = usePartyStore((s) => s.dismissSignal);

  const labelFor = useCallback(
    (type: string) => {
      if (type === 'REGROUP') return t('map.rideHud.signalRegroup');
      if (type === 'STOP') return t('map.rideHud.signalStop');
      if (type === 'FUEL') return t('map.rideHud.signalFuel');
      return type.toLowerCase();
    },
    [t],
  );

  // 5 saniye sonra auto-dismiss
  useEffect(() => {
    if (signals.length === 0) return;
    const timers = signals.map((s) =>
      setTimeout(() => dismiss(s.id), Math.max(0, 5000 - (Date.now() - s.timestamp))),
    );
    return () => timers.forEach(clearTimeout);
  }, [signals, dismiss]);

  if (signals.length === 0) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      {signals.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => dismiss(s.id)}
          style={[styles.toast, { borderColor: COLORS[s.type] ?? '#F5A623' }]}
        >
          <Text style={[styles.who, { color: COLORS[s.type] ?? '#F5A623' }]}>
            {s.senderName.toUpperCase()}
          </Text>
          <Text style={styles.msg}>{labelFor(s.type)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 80,
    left: 12,
    right: 12,
    gap: 6,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    borderWidth: 1,
  },
  who: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  msg: { color: '#fff', fontSize: 16, fontWeight: '700', textTransform: 'uppercase' },
});
