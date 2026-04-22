import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ConversationPreview } from '@motogram/shared';

import { listConversations } from '../../api/messaging.api';
import { usePushPrompt } from '../../hooks/usePushPrompt';
import { SoftPushPromptModal } from '../../features/push/SoftPushPromptModal';

// Spec 2.5 - Mesajlar ekrani (Kisiler sekmesi).
// Faz 1 Adim 24 (ertelenmis) - push soft prompt ilk acilista gosterilir.

export function ConversationsListScreen() {
  const navigation = useNavigation<{ navigate: (route: string, params?: unknown) => void }>();
  const prompt = usePushPrompt(true);

  const q = useQuery({
    queryKey: ['conversations'],
    queryFn: listConversations,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Mesajlar</Text>
      <FlatList
        data={q.data?.conversations ?? []}
        keyExtractor={(c) => c.id}
        refreshing={q.isFetching}
        onRefresh={() => q.refetch()}
        renderItem={({ item }) => (
          <ConversationRow
            item={item}
            onPress={() => navigation.navigate('Conversation', { id: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {q.isLoading ? 'Yukleniyor...' : 'Henuz mesajin yok. Bir topluluktan baslayabilirsin.'}
          </Text>
        }
      />
      <SoftPushPromptModal
        visible={prompt.visible}
        onConfirm={prompt.confirm}
        onDismiss={prompt.dismiss}
      />
    </View>
  );
}

function ConversationRow({
  item,
  onPress,
}: {
  item: ConversationPreview;
  onPress: () => void;
}) {
  const title =
    item.type === 'DIRECT'
      ? item.otherUsername ?? 'Bilinmeyen'
      : item.name ?? (item.type === 'COMMUNITY_CHAT' ? 'Topluluk Sohbeti' : 'Grup');
  const preview = item.lastMessage?.content
    ? item.lastMessage.content
    : item.lastMessage
      ? '[medya]'
      : 'Yeni konusma';
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{title.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowPreview} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      {item.unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  header: { fontSize: 22, fontWeight: '700', color: '#fff', padding: 16 },
  listContent: { paddingHorizontal: 12, paddingBottom: 120 },
  empty: { color: '#888', textAlign: 'center', marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    marginVertical: 4,
    borderRadius: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ff6a00',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#000', fontWeight: '700', fontSize: 16 },
  rowTitle: { color: '#fff', fontWeight: '600', fontSize: 15 },
  rowPreview: { color: '#aaa', marginTop: 2, fontSize: 13 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ff6a00',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#000', fontWeight: '700', fontSize: 12 },
});
