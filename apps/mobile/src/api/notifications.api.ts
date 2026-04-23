import { NotificationListPageResponseSchema, NotificationUnreadCountResponseSchema } from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

// Spec 3.2 — `GET /v1/notifications`, `.../unread-count`

export async function fetchNotificationsList(opts: { cursor?: string; limit?: number } = {}) {
  const sp = new URLSearchParams();
  if (opts.cursor) sp.set('cursor', opts.cursor);
  if (opts.limit) sp.set('limit', String(opts.limit));
  const qs = sp.toString();
  return apiRequest(`/notifications${qs ? `?${qs}` : ''}`, NotificationListPageResponseSchema);
}

export async function fetchUnreadCount() {
  return apiRequest('/notifications/unread-count', NotificationUnreadCountResponseSchema);
}
