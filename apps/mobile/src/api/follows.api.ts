import {
  FollowActionResponseSchema,
  FollowListPageResponseSchema,
  FollowUnfollowResponseSchema,
} from '@motogram/shared';
import type { FollowListQueryDto } from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

// Spec / API_Contract — POST/DELETE /follows/:userId, GET /users/me/following

export async function followUser(userId: string) {
  return apiRequest(`/follows/${userId}`, FollowActionResponseSchema, { method: 'POST' });
}

export async function unfollowUser(userId: string) {
  return apiRequest(`/follows/${userId}`, FollowUnfollowResponseSchema, { method: 'DELETE' });
}

export function fetchMyFollowingPage(query: FollowListQueryDto) {
  const sp = new URLSearchParams();
  sp.set('limit', String(query.limit));
  if (query.cursor) sp.set('cursor', query.cursor);
  return apiRequest(`/users/me/following?${sp.toString()}`, FollowListPageResponseSchema);
}

/** İlk 500 kayıta kadar tara: çoğu hesap için tek veya az sayfada biter. */
export async function checkIsFollowingUser(targetUserId: string): Promise<boolean> {
  let cursor: string | undefined;
  for (let i = 0; i < 10; i++) {
    const page = await fetchMyFollowingPage({ limit: 50, cursor });
    if (page.items.some((u) => u.id === targetUserId)) return true;
    if (!page.nextCursor) return false;
    cursor = page.nextCursor;
  }
  return false;
}
