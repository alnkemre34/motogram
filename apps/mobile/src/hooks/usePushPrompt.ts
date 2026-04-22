import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { registerDeviceToken } from '../api/push.api';
import { StorageKeys, getString, setString } from '../lib/storage';

// Spec 9.3 + Faz 1 Adim 24 - Soft Prompt.
// "Motogram, sizi bilgilendirmek icin bildirim izni istemek uzere..."
// Kullanici ekranda "Izin ver"e basmadan OS'a gitmiyoruz (Apple'in HIG'ine uygun).
//
// Akis:
//   1) Uygulama acilisinda shouldAskForPush() -> daha once sorulmadiysa true.
//   2) Uygun aninda (login sonrasi, inbox ilk acilisinda, vs.) showSoftPrompt() cagirilir.
//   3) Kullanici "Evet" derse iznimizi sistem prompt'u ile istenir ve token kaydedilir.
//   4) "Hayir" derse 14 gun boyunca tekrar sormayiz.

const REMIND_AFTER_DAYS = 14;

interface SoftPromptState {
  lastAskedAtIso?: string;
  userDeniedSoft?: boolean;
  tokenRegistered?: boolean;
}

function readState(): SoftPromptState {
  try {
    const raw = getString(StorageKeys.PushSoftPromptState);
    return raw ? (JSON.parse(raw) as SoftPromptState) : {};
  } catch {
    return {};
  }
}

function writeState(next: SoftPromptState): void {
  setString(StorageKeys.PushSoftPromptState, JSON.stringify(next));
}

export function shouldAskForPush(): boolean {
  const s = readState();
  if (s.tokenRegistered) return false;
  if (!s.userDeniedSoft) return true;
  if (!s.lastAskedAtIso) return true;
  const lastAt = new Date(s.lastAskedAtIso).getTime();
  const days = (Date.now() - lastAt) / (1000 * 60 * 60 * 24);
  return days > REMIND_AFTER_DAYS;
}

async function requestOsPermissionAndRegister(): Promise<boolean> {
  if (!Device.isDevice) {
    // Spec 9.3 - simulatorde push token alinmaz.
    return false;
  }
  const perms = await Notifications.getPermissionsAsync();
  let status = perms.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    status = req.status;
  }
  if (status !== 'granted') return false;

  // Expo push token (Faz 4 iskelet); FCM/APNs ileri fazda.
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    await registerDeviceToken({
      token: token.data,
      platform: 'EXPO',
      appVersion: undefined,
    });
    const s = readState();
    writeState({ ...s, tokenRegistered: true, lastAskedAtIso: new Date().toISOString() });
    return true;
  } catch (err) {
    console.warn('[push] register_failed', err);
    return false;
  }
}

export interface UsePushPromptResult {
  visible: boolean;
  confirm: () => Promise<void>;
  dismiss: () => void;
  ensure: () => Promise<void>;
}

export function usePushPrompt(autoShow = false): UsePushPromptResult {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!autoShow || !shouldAskForPush()) return;
    // Kucuk gecikme: UI yerlesmeden dialog acma.
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, [autoShow]);

  const confirm = useCallback(async () => {
    setVisible(false);
    const ok = await requestOsPermissionAndRegister();
    if (!ok) {
      Alert.alert(
        'Bildirimler kapali',
        Platform.OS === 'ios'
          ? 'Bildirim iznini daha sonra Ayarlar > Motogram > Bildirimler menusunden acabilirsiniz.'
          : 'Bildirim iznini cihaz ayarlarinizdan acabilirsiniz.',
      );
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    const s = readState();
    writeState({ ...s, userDeniedSoft: true, lastAskedAtIso: new Date().toISOString() });
  }, []);

  const ensure = useCallback(async () => {
    if (shouldAskForPush()) setVisible(true);
  }, []);

  return { visible, confirm, dismiss, ensure };
}
