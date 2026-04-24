import type { ConversationType } from '@motogram/shared';

/** GET /v1/conversations?type= — yol inşası (B-02). */
export function getConversationsListPath(q?: { type?: ConversationType }): string {
  const sp = new URLSearchParams();
  if (q?.type) sp.set('type', q.type);
  const qs = sp.toString();
  return `/conversations${qs ? `?${qs}` : ''}`;
}

