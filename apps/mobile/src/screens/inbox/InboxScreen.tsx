import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PartyInboxScreen } from '../party/PartyInboxScreen';
import { ConversationsListScreen } from './ConversationsListScreen';

// Spec 2.5 - Gelen Kutusu: "Kisiler" (DM) + "Gruplar" / parti davetleri.
// Faz 4 - DM sekmesi eklendi; Faz 3'teki parti davet akisi korunuyor.

type Tab = 'messages' | 'parties';

export function InboxScreen() {
  const navigation = useNavigation<{ navigate: (route: string) => void }>();
  const [tab, setTab] = useState<Tab>('messages');

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TabButton active={tab === 'messages'} label="Mesajlar" onPress={() => setTab('messages')} />
        <TabButton active={tab === 'parties'} label="Parti Davetleri" onPress={() => setTab('parties')} />
      </View>
      {tab === 'messages' ? (
        <ConversationsListScreen />
      ) : (
        <PartyInboxScreen
          onJumpToMap={() => {
            try {
              navigation.navigate('Map' as never);
            } catch {
              // noop
            }
          }}
        />
      )}
    </View>
  );
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tabBtn, active ? styles.tabBtnActive : null]} onPress={onPress}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#111',
    paddingTop: 48,
    paddingHorizontal: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: '#1a1a1a',
  },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginRight: 8 },
  tabBtnActive: { backgroundColor: '#1f1f1f' },
  tabText: { color: '#888', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#ff6a00' },
});
