import type { MessageDto } from '@motogram/shared';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { listMessages, sendMessageRest } from '../../api/messaging.api';
import { StackScreenHeader } from '../../components/StackScreenHeader';
import { useZodForm } from '../../hooks/useZodForm';
import { uuidv4 } from '../../lib/uuid';
import type { AppStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';

import { ConversationComposeSchema } from './conversation-compose.schema';

type Props = NativeStackScreenProps<AppStackParamList, 'Conversation'>;

type LocalMessage = MessageDto & {
  _pending?: boolean;
  _failed?: boolean;
};

export function ConversationScreen({ route }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  const conversationId = route.params.id;

  const messagesKey = useMemo(() => ['messages', conversationId] as const, [conversationId]);

  const messagesQ = useInfiniteQuery({
    queryKey: messagesKey,
    queryFn: ({ pageParam }) => listMessages(conversationId, { cursor: pageParam as string | undefined, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 5_000,
  });

  const items: LocalMessage[] = useMemo(() => {
    const pages = messagesQ.data?.pages ?? [];
    const all = pages.flatMap((p) => p.items) as LocalMessage[];
    // API returns newest->oldest? We keep as-is and rely on FlatList inverted for chat UX.
    return all;
  }, [messagesQ.data]);

  const { control, handleSubmit, watch, reset, formState } = useZodForm(ConversationComposeSchema, {
    defaultValues: { content: '' },
  });

  const draft = watch('content');
  useEffect(() => {
    // typing indicator via WS will be added later; keep effect placeholder for parity.
    void draft;
  }, [draft]);

  const sendMut = useMutation({
    mutationFn: async (content: string) => {
      const clientId = uuidv4();
      const optimistic: LocalMessage = {
        id: clientId,
        conversationId,
        senderId: userId ?? '00000000-0000-0000-0000-000000000000',
        clientId,
        content,
        mediaUrls: [],
        messageType: 'TEXT',
        inviteData: null,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        reactions: [],
        _pending: true,
      };

      qc.setQueryData(messagesKey, (prev: typeof messagesQ.data) => {
        if (!prev) return prev;
        const pages = [...prev.pages];
        if (pages.length === 0) return prev;
        // Put optimistic message to the first page's front.
        pages[0] = { ...pages[0], items: [optimistic as any, ...pages[0].items] };
        return { ...prev, pages };
      });

      const res = await sendMessageRest(conversationId, {
        clientId,
        messageType: 'TEXT',
        content,
        mediaUrls: [],
      });

      qc.setQueryData(messagesKey, (prev: typeof messagesQ.data) => {
        if (!prev) return prev;
        const pages = prev.pages.map((p) => ({
          ...p,
          items: p.items.map((m) => (m.clientId === clientId || m.id === clientId ? res.message : m)),
        }));
        return { ...prev, pages };
      });

      return res.message;
    },
    onError: (_err, content) => {
      qc.setQueryData(messagesKey, (prev: typeof messagesQ.data) => {
        if (!prev) return prev;
        const pages = prev.pages.map((p) => ({
          ...p,
          items: p.items.map((m: any) =>
            m.messageType === 'TEXT' && m.content === content && m._pending ? { ...m, _pending: false, _failed: true } : m,
          ),
        }));
        return { ...prev, pages };
      });
    },
  });

  const onSend = handleSubmit((data) => {
    sendMut.mutate(data.content);
    reset();
  });

  const hasMore = Boolean(messagesQ.hasNextPage);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StackScreenHeader title={t('inbox.titleDm')} />
      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        onEndReached={hasMore ? () => void messagesQ.fetchNextPage() : undefined}
        onEndReachedThreshold={0.35}
        inverted
        renderItem={({ item }) => {
          const mine = Boolean(userId && item.senderId === userId);
          return (
            <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
              <View style={[styles.bubbleCol, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleOther,
                    item._pending ? { opacity: 0.65 } : null,
                    item._failed ? { borderColor: '#f44', borderWidth: 1 } : null,
                  ]}
                >
                  <Text style={[styles.bubbleText, mine ? { color: '#000' } : null]}>
                    {item.isDeleted ? t('inbox.messageDeleted') : item.content ?? t('inbox.mediaPreview')}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <Controller
          control={control}
          name="content"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              placeholder={t('inbox.conversationPlaceholder')}
              placeholderTextColor="#666"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
            />
          )}
        />
        <Pressable style={styles.sendButton} onPress={() => void onSend()} accessibilityRole="button">
          <Text style={styles.sendText}>{t('inbox.conversationSend')}</Text>
        </Pressable>
      </View>
      {formState.errors.content?.message ? (
        <Text style={styles.composeError}>{t('common.error')}</Text>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  listContent: { padding: 12, gap: 6 },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  bubbleCol: { maxWidth: '78%' },
  bubble: { maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  bubbleMine: { backgroundColor: '#ff6a00', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#1a1a1a', borderBottomLeftRadius: 4 },
  bubbleText: { color: '#fff', fontSize: 15 },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#111',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButton: { paddingHorizontal: 16, justifyContent: 'center', backgroundColor: '#ff6a00', borderRadius: 10 },
  sendText: { color: '#000', fontWeight: '700' },
  composeError: { color: '#f55', fontSize: 12, paddingHorizontal: 16, paddingBottom: 6 },
});

