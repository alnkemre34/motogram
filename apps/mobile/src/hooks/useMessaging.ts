import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  WS_EVENTS,
  WsMessageDeletedSchema,
  WsMessageErrorSchema,
  WsMessageReactionUpdatedSchema,
  WsMessageReadBySchema,
  WsMessageReceivedSchema,
  WsMessageTypingUpdatedSchema,
  type MessageDto,
  type WsMessageDeletedPayload,
  type WsMessageErrorPayload,
  type WsMessageReactionUpdatedPayload,
  type WsMessageReadByPayload,
  type WsMessageReceivedPayload,
  type WsMessageTypingUpdatedPayload,
} from '@motogram/shared';

import { getConversation, listMessages, markConversationRead } from '../api/messaging.api';
import { mergeMessageReceived, type MessageWithPending } from '../lib/messaging-merge';
import { connectMessagingSocket, getMessagingSocket } from '../lib/messaging-socket';
import { captureException } from '../lib/sentry';
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
  /** Sohbet özetinden gelen + WS `message:read_by` (epoch ms, kullanıcı başına maks). */
  const [readByAtByUser, setReadByAtByUser] = useState<Record<string, number>>({});
  const [readReceiptPeerIds, setReadReceiptPeerIds] = useState<string[]>([]);
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

  // Katılımcılar + `lastReadAt` tohumu (read receipt UI, REST SSOT)
  useEffect(() => {
    if (!userId) return;
    setReadReceiptPeerIds([]);
    setReadByAtByUser({});
    let cancelled = false;
    void getConversation(conversationId)
      .then((conv) => {
        if (cancelled) return;
        const others = conv.participants.filter((p) => p.userId !== userId).map((p) => p.userId);
        setReadReceiptPeerIds(others);
        const seed: Record<string, number> = {};
        for (const p of conv.participants) {
          if (p.userId === userId) continue;
          if (p.lastReadAt) seed[p.userId] = new Date(p.lastReadAt).getTime();
        }
        setReadByAtByUser(seed);
      })
      .catch(() => {
        if (!cancelled) {
          setReadReceiptPeerIds([]);
          setReadByAtByUser({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, userId]);

  // ---- Socket: connect + re-join (reconnect) + subscriptions (Spec 3.5 / P7.2) ----
  useEffect(() => {
    if (!userId) return;
    const socket = connectMessagingSocket();
    socketRef.current = socket;

    const joinRoom = () => {
      wsEmitClient(socket, WS_EVENTS.conversationJoin, { conversationId });
    };
    const onConnect = () => {
      joinRoom();
    };
    socket.on('connect', onConnect);
    if (socket.connected) joinRoom();

    const onReceived = (p: WsMessageReceivedPayload) => {
      if (p.conversationId !== conversationId) return;
      setMessages((prev) =>
        mergeMessageReceived(prev, p.message, p.message.clientId ?? undefined),
      );
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

    const onMessageError = (p: WsMessageErrorPayload) => {
      if (p.clientId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientId === p.clientId ? { ...m, _failed: true, _pending: false } : m,
          ),
        );
      } else {
        captureException(new Error(`[WS messaging] ${p.code}: ${p.message}`));
      }
    };

    const onReadBy = (p: WsMessageReadByPayload) => {
      if (p.conversationId !== conversationId) return;
      if (!userId || p.userId === userId) return;
      setReadByAtByUser((prev) => {
        const next = { ...prev };
        const t = p.readAt;
        next[p.userId] = Math.max(next[p.userId] ?? 0, t);
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
    const u5 = wsOnServerParsed(socket, WS_EVENTS.messageError, WsMessageErrorSchema, onMessageError);
    const u6 = wsOnServerParsed(socket, WS_EVENTS.messageReadBy, WsMessageReadBySchema, onReadBy);

    return () => {
      socket.off('connect', onConnect);
      if (socket.connected) {
        wsEmitClient(socket, WS_EVENTS.conversationLeave, { conversationId });
      }
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, [conversationId, userId]);

  // Arka plan / çoklu görev: oda terk + yazıyor temizle; ön planda tekrar join (P7.2)
  useEffect(() => {
    if (!userId) return;
    const socket = getMessagingSocket();
    const onAppState = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        wsEmitClient(socket, WS_EVENTS.messageTyping, { conversationId, isTyping: false });
        if (socket.connected) {
          wsEmitClient(socket, WS_EVENTS.conversationLeave, { conversationId });
        }
      } else if (next === 'active' && socket.connected) {
        wsEmitClient(socket, WS_EVENTS.conversationJoin, { conversationId });
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
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
      readByAtByUser,
      readReceiptPeerIds,
      loadMore,
      send,
      sendTyping,
      react,
      markRead,
    }),
    [
      messages,
      loading,
      nextCursor,
      typingUsers,
      readByAtByUser,
      readReceiptPeerIds,
      loadMore,
      send,
      sendTyping,
      react,
      markRead,
    ],
  );
}
