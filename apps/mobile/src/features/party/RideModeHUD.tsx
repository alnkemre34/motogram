import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PartySignalType } from '@motogram/shared';

// Spec 2.3.2 - Surus Modu'nda harita ortasinda 3 BUYUK parmaga dost buton.
// Regroup (toplan), Stop (dur), Fuel (yakit). Bu butonlar tek vurusta sinyal yollar,
// DB'ye YAZILMAZ (Spec 7.3.1), sadece parti uyelerine WS broadcast edilir.

export interface RideModeHUDProps {
  onSignal: (type: PartySignalType) => void;
  disabled?: boolean;
  leaderName?: string | null;
  isLeader?: boolean;
  memberCount?: number;
  connected?: boolean;
  onLeave?: () => void;
}

interface Btn {
  type: PartySignalType;
  color: string;
  emojiFallback: string;
}

const BUTTONS: Btn[] = [
  { type: 'REGROUP', color: '#2ecc71', emojiFallback: '⟳' },
  { type: 'STOP', color: '#e74c3c', emojiFallback: '■' },
  { type: 'FUEL', color: '#f39c12', emojiFallback: '⛽' },
];

export function RideModeHUD({
  onSignal,
  disabled = false,
  leaderName,
  isLeader,
  memberCount,
  connected,
  onLeave,
}: RideModeHUDProps) {
  const { t } = useTranslation();
  const labelFor = (type: PartySignalType) => {
    if (type === 'REGROUP') return t('map.rideHud.signalRegroup');
    if (type === 'STOP') return t('map.rideHud.signalStop');
    return t('map.rideHud.signalFuel');
  };
  const leaderLine = useMemo(() => {
    if (isLeader) return t('map.rideHud.leaderYou');
    if (leaderName) return t('map.rideHud.leaderNamed', { name: leaderName });
    return t('map.rideHud.leaderEmpty');
  }, [isLeader, leaderName, t]);

  return (
    <View style={styles.root} pointerEvents="box-none" accessible accessibilityLabel="Ride Mode HUD">
      <View style={styles.topBar} pointerEvents="auto">
        <View style={styles.leaderBadge}>
          <View style={[styles.statusDot, { backgroundColor: connected ? '#2ecc71' : '#e74c3c' }]} />
          <Text style={styles.leaderText}>{leaderLine}</Text>
          {typeof memberCount === 'number' && (
            <Text style={styles.memberCount}>• {memberCount}</Text>
          )}
        </View>
        {onLeave && (
          <Pressable
            onPress={onLeave}
            style={({ pressed }) => [styles.leaveBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('map.rideHud.a11yLeave')}
          >
            <Text style={styles.leaveText}>{t('map.rideHud.leave')}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.bottomBar} pointerEvents="auto">
        {BUTTONS.map((b) => (
          <Pressable
            key={b.type}
            onPress={() => onSignal(b.type)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.signalBtn,
              { backgroundColor: b.color },
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('map.rideHud.a11ySignal', { label: labelFor(b.type) })}
            testID={`ride-hud-${b.type.toLowerCase()}`}
          >
            <Text style={styles.signalGlyph}>{b.emojiFallback}</Text>
            <Text style={styles.signalLabel}>{labelFor(b.type)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  leaderText: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  memberCount: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  leaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(231,76,60,0.2)',
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  leaveText: { color: '#e74c3c', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 8,
  },
  signalBtn: {
    flex: 1,
    // parmaga dost: minimum 96px yukseklik (Spec 2.3.2 - "3 buyuk buton")
    height: 96,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  signalGlyph: { fontSize: 32, color: '#0b0b0d', fontWeight: '900' },
  signalLabel: { color: '#0b0b0d', fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.4 },
});
