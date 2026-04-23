import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StackScreenHeader } from '../../components/StackScreenHeader';
import type { AppStackParamList } from '../../navigation/types';

const SETTINGS_ROWS = [
  'EditProfile',
  'ChangePassword',
  'NotificationPreferences',
  'EmergencyContacts',
  'BlockedUsers',
  'AccountDeletion',
] as const satisfies ReadonlyArray<keyof AppStackParamList>;

const labels: Record<(typeof SETTINGS_ROWS)[number], { titleKey: string; descKey?: string }> = {
  EditProfile: { titleKey: 'settings.rowEditProfile' },
  ChangePassword: { titleKey: 'settings.rowChangePassword', descKey: 'settings.rowChangePasswordDesc' },
  NotificationPreferences: { titleKey: 'settings.rowNotificationPrefs' },
  EmergencyContacts: { titleKey: 'settings.rowEmergencyContacts' },
  BlockedUsers: { titleKey: 'settings.rowBlocked' },
  AccountDeletion: { titleKey: 'settings.rowAccountDeletion', descKey: 'settings.rowAccountDeletionDesc' },
};

export function SettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StackScreenHeader title={t('settings.title')} />
      <ScrollView contentContainerStyle={styles.list}>
        {SETTINGS_ROWS.map((name) => {
          const { titleKey, descKey } = labels[name];
          return (
            <Pressable
              key={name}
              onPress={() => navigation.navigate(name)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View style={styles.rowTextwrap}>
                <Text style={styles.rowTitle}>{t(titleKey)}</Text>
                {descKey ? <Text style={styles.rowDesc}>{t(descKey)}</Text> : null}
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  list: { padding: 16, paddingTop: 0, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1e',
    borderRadius: 12,
    padding: 16,
  },
  pressed: { opacity: 0.85 },
  rowTextwrap: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  rowDesc: { color: '#888', fontSize: 12, marginTop: 4 },
  chev: { color: '#666', fontSize: 22, fontWeight: '200' },
});
