import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';

export function SettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const clearSession = useAuthStore((s) => s.clearSession);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
          }}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.backText}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('settings.title')}
        </Text>
        <View style={styles.topRight} />
      </View>

      <View style={styles.list}>
        <Row label={t('settings.rowEditProfile')} onPress={() => navigation.navigate('EditProfile')} />
        <Row
          label={t('settings.rowNotificationPrefs')}
          onPress={() => navigation.navigate('NotificationPreferences')}
        />
        <Row label={t('settings.rowEmergencyContacts')} onPress={() => navigation.navigate('EmergencyContacts')} />
        <Row label={t('settings.rowBlocked')} onPress={() => navigation.navigate('BlockedUsers')} />
        <Row
          label={t('settings.rowChangePassword')}
          sub={t('settings.rowChangePasswordDesc')}
          onPress={() => navigation.navigate('ChangePassword')}
        />
        <Row
          label={t('settings.rowChangeEmail')}
          sub={t('settings.rowChangeEmailDesc')}
          onPress={() => navigation.navigate('ChangeEmail')}
        />
        <Row
          label={t('settings.rowVerifyEmail')}
          sub={t('settings.rowVerifyEmailDesc')}
          onPress={() => navigation.navigate('VerifyEmail')}
        />
        <Row
          label={t('settings.rowDevices')}
          sub={t('settings.rowDevicesDesc')}
          onPress={() => navigation.navigate('Devices')}
        />
        <Row
          label={t('settings.rowChangeUsername')}
          sub={t('settings.rowChangeUsernameDesc')}
          onPress={() => navigation.navigate('ChangeUsername')}
        />
        <Row
          label={t('settings.rowAccountDeletion')}
          sub={t('settings.rowAccountDeletionDesc')}
          onPress={() => navigation.navigate('AccountDeletion')}
        />
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.signOut} onPress={clearSession} accessibilityRole="button">
          <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, sub, onPress }: { label: string; sub?: string; onPress?: () => void }) {
  const content = (
    <>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Text style={styles.chev}>{'›'}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  back: { width: 44, height: 44, justifyContent: 'center' },
  backText: { color: '#ff6a00', fontSize: 32, fontWeight: '300' },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '800' },
  topRight: { width: 44 },
  list: { paddingHorizontal: 12, paddingTop: 6, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowPressed: { opacity: 0.92 },
  rowLeft: { flex: 1, paddingRight: 12 },
  rowLabel: { color: '#fff', fontWeight: '800' },
  rowSub: { color: '#888', marginTop: 4, fontSize: 12 },
  chev: { color: '#ff6a00', fontSize: 22, fontWeight: '600' },
  footer: { marginTop: 'auto', padding: 12, paddingBottom: 18 },
  signOut: {
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutText: { color: '#fff', fontWeight: '700' },
  pressed: { opacity: 0.7 },
});

