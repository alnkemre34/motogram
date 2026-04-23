import type { MessageDto } from '@motogram/shared';

/** Optimistic (pending) satırları `useMessaging` ile uyumlu. */
export type MessageWithPending = MessageDto & { _pending?: boolean; _failed?: boolean };

/**
 * `message:received` ile sunucu mesajını listeye ekler; aynı `clientId`’li pending satırı kaldırır (Spec 7.1.1).
 */
export function mergeMessageReceived(
  prev: MessageWithPending[],
  incoming: MessageDto,
  serverClientId: string | null | undefined,
): MessageWithPending[] {
  const map = new Map<string, MessageWithPending>();
  for (const m of prev) {
    if (serverClientId && m.clientId && m.clientId === serverClientId) continue;
    map.set(m.id, m);
  }
  const next: MessageWithPending = { ...incoming, _pending: false, _failed: false };
  map.set(incoming.id, next);
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}
