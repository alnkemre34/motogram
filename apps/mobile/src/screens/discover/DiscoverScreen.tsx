import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Spec 2.3 - Kesfet. Faz 1 iskelet, gercek icerik Faz 2-5'te doldurulacak.

export function DiscoverScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.inner}>
        <Text style={styles.title}>{t('tabs.discover')}</Text>
        <Text style={styles.muted}>Coming soon — Faz 2 / Faz 5</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  muted: { color: '#888' },
});
