import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, Text, Vibration, View, type GestureResponderEvent } from 'react-native';

import { createEmergencyAlert } from '../../api/emergency.api';
import { ApiClientError } from '../../lib/api-client';

const HOLD_MS = 3000;
const COOLDOWN_MS = 30_000;

function buzzShort() {
  Vibration.vibrate(40);
}

function buzzPatternSuccess() {
  Vibration.vibrate([0, 80, 60, 80]);
}

function buzzPatternError() {
  Vibration.vibrate([0, 120, 80, 120]);
}

export interface SosButtonProps {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  type?: 'GENERAL' | 'ACCIDENT' | 'MECHANICAL' | 'MEDICAL' | 'FUEL' | 'OTHER';
  onSuccess?: (alertId: string) => void;
  onError?: (err: unknown) => void;
}

export function SosButton({
  latitude,
  longitude,
  accuracyMeters,
  type = 'GENERAL',
  onSuccess,
  onError,
}: SosButtonProps) {
  const { t } = useTranslation();
  const [holding, setHolding] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const holdStartRef = useRef<number>(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    tickRef.current = null;
    timerRef.current = null;
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const fireAlert = useCallback(async () => {
    setSending(true);
    const holdDurationMs = Date.now() - holdStartRef.current;
    try {
      const alert = await createEmergencyAlert({
        type,
        latitude,
        longitude,
        accuracyMeters,
        holdDurationMs,
        radiusMeters: 5000,
      });
      buzzPatternSuccess();
      setCooldownUntil(Date.now() + COOLDOWN_MS);
      onSuccess?.(alert.id);
    } catch (err) {
      buzzPatternError();
      if (err instanceof ApiClientError && err.body?.error === 'sos_rate_limit') {
        setCooldownUntil(Date.now() + COOLDOWN_MS);
      }
      onError?.(err);
    } finally {
      setSending(false);
    }
  }, [accuracyMeters, latitude, longitude, onError, onSuccess, type]);

  const onPressIn = useCallback(
    (_e: GestureResponderEvent) => {
      if (sending) return;
      if (Date.now() < cooldownUntil) {
        buzzShort();
        return;
      }
      holdStartRef.current = Date.now();
      setHolding(true);
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: HOLD_MS,
        useNativeDriver: false,
      }).start();

      buzzShort();
      tickRef.current = setInterval(() => {
        buzzShort();
      }, 1000);
      timerRef.current = setTimeout(() => {
        clearTimers();
        setHolding(false);
        void fireAlert();
      }, HOLD_MS);
    },
    [clearTimers, cooldownUntil, fireAlert, progressAnim, sending],
  );

  const onPressOut = useCallback(() => {
    if (!holding) return;
    clearTimers();
    setHolding(false);
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    const heldMs = Date.now() - holdStartRef.current;
    if (heldMs < HOLD_MS) {
      buzzShort();
    }
  }, [clearTimers, holding, progressAnim]);

  const inCooldown = Date.now() < cooldownUntil;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityLabel={t('map.sos.a11yLabel')}
        accessibilityHint={t('map.sos.a11yHint')}
        disabled={sending}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.button, (holding || sending) && styles.buttonActive]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              opacity: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              }),
              transform: [
                {
                  scale: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.35],
                  }),
                },
              ],
            },
          ]}
        />
        <Text style={styles.label}>
          {sending ? t('map.sos.sending') : inCooldown ? t('map.sos.cooldownWait') : t('map.sos.label')}
        </Text>
        <Text style={styles.sub}>
          {holding
            ? t('map.sos.hintHold')
            : inCooldown
              ? t('map.sos.hintCooldown')
              : t('map.sos.hintShort')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#d72638',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d72638',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  buttonActive: {
    backgroundColor: '#7a0615',
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#ffce00',
  },
  label: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 2,
  },
  sub: {
    color: '#ffe4b3',
    fontSize: 11,
    marginTop: 4,
  },
});
