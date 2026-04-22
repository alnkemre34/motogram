import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WS_EVENTS,
  WsMessageDeletedSchema,
  WsMessageReactionUpdatedSchema,
  WsMessageReceivedSchema,
  WsMessageTypingUpdatedSchema,
  type MessageDto,
  type WsMessageDeletedPayload,
  type WsMessageReactionUpdatedPayload,
  type WsMessageReceivedPayload,
  type WsMessageTypingUpdatedPayload,
} from '@motogram/shared';

import { listMessages, markConversationRead } from '../api/messaging.api';
import { connectMessagingSocket, getMessagingSocket } from '../lib/messaging-socket';
import { wsEmitClient, wsOnServerParsed } from '../lib/ws-typed';

// Spec 7.1.1 - Optimistic UI: gonderim anlik; server onayi gelince merge.
// Spec 2.5 - Konusma ekrani: newest-bottom, cursor pagination.

export interface OutgoingMessage {
  clientId: string;
  conversationId: string;
  content?: string;
  mediaUrls?: string[];
  messageType: MessageDto['messageType'];
}

type MessageWithPending = MessageDto & { _pending?: boolean; _failed?: boolean };

function uuid(): string {
  // Lightweight UUID v4 (dev only, no deps).
  const rnd = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  const s = `${rnd()}${rnd()}${rnd()}${rnd()}`;
  return [
    s.slice(0, 8),
    s.slice(8, 12),
    `4${s.slice(13, 16)}`,
    ((parseInt(s[16]!, 16) & 0x3) | 0x8).toString(16) + s.slice(17, 20),
    s.slice(20, 32),
  ].join('-');
}

export function useMessaging(conversationId: string, userId: string | null) {
  const [messages, setMessages] = useState<MessageWithPending[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const socketRef = useRef(getMessagingSocket());

  // ---- Initial load + pagination ----
  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const { items, nextCursor: nc } = await listMessages(conversationId, {
        cursor: nextCursor ?? undefined,
        limit: 30,
      });
      setMessages((prev) => {
        const map = new Map<string, MessageWithPending>();
        for (const m of items) map.set(m.id, m);
        for (const m of prev) map.set(m.id, m);
        return Array.from(map.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
      setNextCursor(nc);
    } finally {
      setLoading(false);
    }
  }, [conversationId, nextCursor]);

  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // ---- Socket connection + subscriptions ----
  useEffect(() => {
    if (!userId) return;
    const socket = connectMessagingSocket();
    socketRef.current = socket;

    wsEmitClient(socket, WS_EVENTS.conversationJoin, { conversationId });

    const onReceived = (p: WsMessageReceivedPayload) => {
      if (p.conversationId !== conversationId) return;
      setMessages((prev) => {
        const map = new Map<string, MessageWithPending>();
        for (const m of prev) {
          if (m.clientId && m.clientId === p.message.clientId) continue; // pending -> replace
          map.set(m.id, m);
        }
        map.set(p.message.id, p.message as MessageWithPending);
        return Array.from(map.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
      // Okundu yolla (aktif ekrandaysak)
      void markConversationRead(conversationId);
    };

    const onReaction = (p: WsMessageReactionUpdatedPayload) => {
      if (p.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === p.messageId
            ? {
                ...m,
                reactions: p.removed
                  ? m.reactions.filter(
                      (r) => !(r.userId === p.reaction.userId && r.emoji === p.reaction.emoji),
                    )
                  : [...m.reactions.filter((r) => !(r.userId === p.reaction.userId && r.emoji === p.reaction.emoji)), p.reaction],
              }
            : m,
        ),
      );
    };

    const onDeleted = (p: WsMessageDeletedPayload) => {
      if (p.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === p.messageId ? { ...m, isDeleted: true, content: null, mediaUrls: [] } : m,
        ),
      );
    };

    const onTyping = (p: WsMessageTypingUpdatedPayload) => {
      if (p.conversationId !== conversationId) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (p.isTyping) next.add(p.userId);
        else next.delete(p.userId);
        return next;
      });
    };

    const u1 = wsOnServerParsed(
      socket,
      WS_EVENTS.messageReceived,
      WsMessageReceivedSchema,
      onReceived,
    );
    const u2 = wsOnServerParsed(
      socket,
      WS_EVENTS.messageReactionUpdated,
      WsMessageReactionUpdatedSchema,
      onReaction,
    );
    const u3 = wsOnServerParsed(socket, WS_EVENTS.messageDeleted, WsMessageDeletedSchema, onDeleted);
    const u4 = wsOnServerParsed(
      socket,
      WS_EVENTS.messageTypingUpdated,
      WsMessageTypingUpdatedSchema,
      onTyping,
    );

    return () => {
      wsEmitClient(socket, WS_EVENTS.conversationLeave, { conversationId });
      u1();
      u2();
      u3();
      u4();
    };
  }, [conversationId, userId]);

  // ---- Send message (optimistic) ----
  const send = useCallback(
    (input: { content?: string; mediaUrls?: string[]; messageType?: MessageDto['messageType'] }) => {
      if (!userId) return;
      const clientId = uuid();
      const optimistic: MessageWithPending = {
        id: clientId,
        conversationId,
        senderId: userId,
        clientId,
        content: input.content ?? null,
        mediaUrls: input.mediaUrls ?? [],
        messageType: input.messageType ?? 'TEXT',
        inviteData: null,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        reactions: [],
        _pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      wsEmitClient(
        socketRef.current,
        WS_EVENTS.messageSend,
        {
          conversationId,
          clientId,
          messageType: optimistic.messageType,
          content: input.content,
          mediaUrls: input.mediaUrls ?? [],
          clientTimestamp: Date.now(),
        },
        (ack: unknown) => {
          const body = ack as { ok?: boolean; messageId?: string; duplicate?: boolean } | undefined;
          if (!body?.ok) {
            setMessages((prev) =>
              prev.map((m) =>
                m.clientId === clientId ? { ...m, _failed: true, _pending: false } : m,
              ),
            );
          }
        },
      );
    },
    [conversationId, userId],
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      wsEmitClient(socketRef.current, WS_EVENTS.messageTyping, { conversationId, isTyping });
    },
    [conversationId],
  );

  const react = useCallback(
    (messageId: string, emoji: string, remove = false) => {
      wsEmitClient(socketRef.current, WS_EVENTS.messageReact, { messageId, emoji, remove });
    },
    [],
  );

  const markRead = useCallback(() => {
    wsEmitClient(socketRef.current, WS_EVENTS.messageRead, {
      conversationId,
      readAt: Date.now(),
    });
  }, [conversationId]);

  return useMemo(
    () => ({
      messages,
      loading,
      hasMore: nextCursor !== null,
      typingUsers: Array.from(typingUsers),
      loadMore,
      send,
      sendTyping,
      react,
      markRead,
    }),
    [messages, loading, nextCursor, typingUsers, loadMore, send, sendTyping, react, markRead],
  );
}
