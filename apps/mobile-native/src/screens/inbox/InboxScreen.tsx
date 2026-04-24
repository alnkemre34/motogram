import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ConversationsListScreen } from './ConversationsListScreen';
import { PartyInboxScreen } from '../party/PartyInboxScreen';
import type { AppStackParamList } from '../../navigation/types';

export function InboxScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const rootNav = navigation.getParent<NativeStackNavigationProp<AppStackParamList>>();
  const [tab, setTab] = useState<'dm' | 'community' | 'parties'>('dm');

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.tabRow}>
        <TabButton active={tab === 'dm'} label={t('inbox.tabDm')} onPress={() => setTab('dm')} />
        <TabButton active={tab === 'community'} label={t('inbox.tabCommunity')} onPress={() => setTab('community')} />
        <TabButton active={tab === 'parties'} label={t('inbox.tabParties')} onPress={() => setTab('parties')} />
      </View>

      {tab === 'dm' ? (
        <ConversationsListScreen scope="dm" />
      ) : tab === 'community' ? (
        <ConversationsListScreen scope="community" />
      ) : (
        <PartyInboxScreen
          onJumpToMap={() => {
            rootNav?.navigate('MainTabs', { screen: 'Map' });
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tabBtnActive: { backgroundColor: 'rgba(255, 106, 0, 0.18)', borderColor: 'rgba(255, 106, 0, 0.45)' },
  tabText: { color: '#888', fontWeight: '600', fontSize: 12 },
  tabTextActive: { color: '#ff6a00' },
});

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.tabBtn, active ? styles.tabBtnActive : null]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

