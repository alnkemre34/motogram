import { useEffect, useMemo } from 'react';
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
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useZodForm } from '../../hooks/useZodForm';
import { useMessaging } from '../../hooks/useMessaging';
import { getLastOwnMessageId, isReadByAllPeers } from '../../lib/messaging-read-receipts';
import { useAuthStore } from '../../store/auth.store';

import { ConversationComposeSchema } from './conversation-compose.schema';

// Spec 2.5 - Konusma ekrani: mesaj listesi + input. Optimistic send (Spec 7.1.1).

type RouteParams = { id: string };

export function ConversationScreen() {
  const { t } = useTranslation();
  const route = useRoute<RouteProp<{ Conversation: RouteParams }, 'Conversation'>>();
  const conversationId = route.params.id;
  const userId = useAuthStore((s) => s.userId);
  const {
    messages,
    send,
    sendTyping,
    hasMore,
    loadMore,
    typingUsers,
    readByAtByUser,
    readReceiptPeerIds,
  } = useMessaging(conversationId, userId ?? null);

  const lastOwnMessageId = useMemo(
    () => getLastOwnMessageId(messages, userId ?? null),
    [messages, userId],
  );

  const { control, handleSubmit, watch, reset, formState } = useZodForm(ConversationComposeSchema, {
    defaultValues: { content: '' },
  });
  const draft = watch('content');

  useEffect(() => {
    if (draft.length > 0) sendTyping(true);
    const timer = setTimeout(() => sendTyping(false), 1500);
    return () => clearTimeout(timer);
  }, [draft, sendTyping]);

  const onSend = handleSubmit((data) => {
    send({ content: data.content, messageType: 'TEXT' });
    reset();
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.4}
        inverted={false}
        renderItem={({ item }) => {
          const mine = item.senderId === userId;
          const showRead =
            mine &&
            lastOwnMessageId === item.id &&
            isReadByAllPeers(item, userId ?? null, readReceiptPeerIds, readByAtByUser);
          return (
            <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
              <View
                style={[
                  styles.bubbleCol,
                  { alignItems: mine ? 'flex-end' : 'flex-start' },
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleOther,
                    item._pending ? { opacity: 0.6 } : null,
                    item._failed ? { borderColor: '#f44', borderWidth: 1 } : null,
                  ]}
                >
                  <Text style={[styles.bubbleText, mine ? { color: '#000' } : null]}>
                    {item.isDeleted ? t('inbox.messageDeleted') : item.content ?? t('inbox.mediaPreview')}
                  </Text>
                </View>
                {showRead ? <Text style={styles.readLabel}>{t('inbox.messageRead')}</Text> : null}
              </View>
            </View>
          );
        }}
      />
      {typingUsers.length > 0 ? (
        <Text style={styles.typing}>
          {t('inbox.conversationTyping', { n: typingUsers.length })}
        </Text>
      ) : null}
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
        <Pressable style={styles.sendButton} onPress={() => void onSend()}>
          <Text style={styles.sendText}>{t('inbox.conversationSend')}</Text>
        </Pressable>
      </View>
      {formState.errors.content?.message ? (
        <Text style={styles.composeError}>{formState.errors.content.message}</Text>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  listContent: { padding: 12, gap: 6 },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  bubbleCol: { maxWidth: '78%' },
  readLabel: { color: '#888', fontSize: 11, marginTop: 2, paddingHorizontal: 2 },
  bubble: {
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  bubbleMine: { backgroundColor: '#ff6a00', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#1a1a1a', borderBottomLeftRadius: 4 },
  bubbleText: { color: '#fff', fontSize: 15 },
  typing: { color: '#888', fontSize: 12, paddingHorizontal: 16, paddingBottom: 4 },
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
  sendButton: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#ff6a00',
    borderRadius: 10,
  },
  sendText: { color: '#000', fontWeight: '700' },
  composeError: { color: '#f55', fontSize: 12, paddingHorizontal: 16, paddingBottom: 6 },
});
