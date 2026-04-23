import type { MessageWithPending } from './messaging-merge';

/**
 * Görünen listede, pending/failed hariç en son giden (benim) mesajın id’si.
 */
export function getLastOwnMessageId(
  messages: MessageWithPending[],
  selfUserId: string | null | undefined,
): string | null {
  if (!selfUserId) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.senderId === selfUserId && !m._pending && !m._failed && !m.isDeleted) {
      return m.id;
    }
  }
  return null;
}

/**
 * Tüm diğer katılımcılar bu mesajın `createdAt` anına kadar okumuş mu (read watermark, epoch ms).
 */
export function isReadByAllPeers(
  message: MessageWithPending,
  selfUserId: string | null | undefined,
  otherUserIds: string[],
  readByAtByUser: Record<string, number>,
): boolean {
  if (!selfUserId || message.senderId !== selfUserId) return false;
  if (otherUserIds.length === 0) return false;
  const t = new Date(message.createdAt).getTime();
  for (const uid of otherUserIds) {
    const at = readByAtByUser[uid];
    if (at == null || at < t) return false;
  }
  return true;
}
