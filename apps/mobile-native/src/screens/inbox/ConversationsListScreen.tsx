import type { ConversationPreview } from '@motogram/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { listConversations } from '../../api/messaging.api';
import type { AppStackParamList } from '../../navigation/types';

type InboxScope = 'dm' | 'community';

type Section = {
  key: 'direct' | 'groups' | 'community';
  title: string;
  data: ConversationPreview[];
};

export function ConversationsListScreen({ scope }: { scope: InboxScope }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const queryClient = useQueryClient();

  const isDm = scope === 'dm';

  const directQ = useQuery({
    queryKey: ['conversations', 'DIRECT'] as const,
    queryFn: () => listConversations({ type: 'DIRECT' }),
    enabled: isDm,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
  const groupQ = useQuery({
    queryKey: ['conversations', 'GROUP_CHAT'] as const,
    queryFn: () => listConversations({ type: 'GROUP_CHAT' }),
    enabled: isDm,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const communityQ = useQuery({
    queryKey: ['conversations', 'COMMUNITY_CHAT'],
    queryFn: () => listConversations({ type: 'COMMUNITY_CHAT' }),
    enabled: !isDm,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const isLoading = isDm ? directQ.isLoading || groupQ.isLoading : communityQ.isLoading;
  const isError = isDm ? directQ.isError || groupQ.isError : communityQ.isError;
  const isFetching = isDm ? directQ.isFetching || groupQ.isFetching : communityQ.isFetching;

  const onRefresh = () =>
    isDm
      ? Promise.all(
          [
            ['conversations', 'DIRECT'] as const,
            ['conversations', 'GROUP_CHAT'] as const,
          ].map((k) => queryClient.refetchQueries({ queryKey: k })),
        )
      : queryClient.refetchQueries({ queryKey: ['conversations', 'COMMUNITY_CHAT'] });

  const directItems = isDm ? (directQ.data?.conversations ?? []) : [];
  const groupItems = isDm ? (groupQ.data?.conversations ?? []) : [];
  const communityItems = !isDm ? (communityQ.data?.conversations ?? []) : [];

  const sections: Section[] = isDm
    ? [
        { key: 'direct', title: t('inbox.sectionDirect'), data: directItems },
        { key: 'groups', title: t('inbox.sectionGroups'), data: groupItems },
      ]
    : [{ key: 'community', title: t('inbox.sectionCommunityInbox'), data: communityItems }];

  const allEmpty = isDm ? directItems.length === 0 && groupItems.length === 0 : communityItems.length === 0;
  const showFullEmpty = !isError && allEmpty && !isLoading;
  const showInitialLoading = !isError && isLoading;

  if (isError) {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle} accessibilityRole="header">
          {isDm ? t('inbox.titleDm') : t('inbox.titleCommunity')}
        </Text>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{t('common.error')}</Text>
          <Pressable onPress={() => onRefresh()} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (showInitialLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle} accessibilityRole="header">
          {isDm ? t('inbox.titleDm') : t('inbox.titleCommunity')}
        </Text>
        <Text style={styles.hintCenter}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (showFullEmpty) {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle} accessibilityRole="header">
          {isDm ? t('inbox.titleDm') : t('inbox.titleCommunity')}
        </Text>
        <Text style={styles.hintCenter}>{isDm ? t('inbox.emptyAllDm') : t('inbox.emptyCommunityList')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle} accessibilityRole="header">
        {isDm ? t('inbox.titleDm') : t('inbox.titleCommunity')}
      </Text>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => onRefresh()} />}
        renderSectionHeader={({ section }) => <Text style={styles.sectionLabel}>{section.title}</Text>}
        renderSectionFooter={({ section }) => {
          if (section.data.length > 0) return null;
          return (
            <Text style={styles.emptySectionNote}>
              {section.key === 'direct'
                ? t('inbox.emptyDirect')
                : section.key === 'groups'
                  ? t('inbox.emptyGroups')
                  : t('inbox.emptyCommunity')}
            </Text>
          );
        }}
        renderItem={({ item }) => (
          <ConversationRow
            item={item}
            onPress={() => navigation.navigate('Conversation', { id: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        SectionSeparatorComponent={() => <View style={styles.sectionSpacer} />}
      />
    </View>
  );
}

function ConversationRow({ item, onPress }: { item: ConversationPreview; onPress: () => void }) {
  const { t } = useTranslation();
  const title =
    item.type === 'DIRECT'
      ? (item.otherUsername ?? t('inbox.unknownUser'))
      : (item.name ?? (item.type === 'COMMUNITY_CHAT' ? t('inbox.fallbackCommunityChat') : t('inbox.fallbackGroup')));
  const preview = item.lastMessage?.content
    ? item.lastMessage.content
    : item.lastMessage
      ? t('inbox.mediaPreview')
      : t('inbox.newConversation');

  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
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
        <View style={styles.badge} accessibilityLabel={String(item.unreadCount)}>
          <Text style={styles.badgeText}>{item.unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#fff', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  sectionLabel: {
    color: 'rgba(0, 229, 255, 0.85)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 6,
  },
  sectionSpacer: { height: 4 },
  listContent: { paddingHorizontal: 12, paddingBottom: 120 },
  emptySectionNote: { color: '#666', fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  hintCenter: { color: '#888', textAlign: 'center', marginTop: 32, paddingHorizontal: 24 },
  errorBox: { padding: 16, alignItems: 'center' },
  errorText: { color: '#ff6a6a', marginBottom: 8 },
  retry: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#1f1f1f' },
  retryText: { color: '#ff6a00', fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 106, 0, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ff6a00', fontWeight: '800' },
  rowTitle: { color: '#fff', fontWeight: '700' },
  rowPreview: { color: '#888', marginTop: 2 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ff6a00',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#000', fontWeight: '800', fontSize: 12 },
});

