import type { PostFeedQueryDto } from '@motogram/shared';
import { PostFeedPageSchema } from '@motogram/shared';
import type { z } from 'zod';

import { apiRequest } from '../lib/api-client';

export type FeedPage = z.infer<typeof PostFeedPageSchema>;

export function fetchFeed(query: PostFeedQueryDto): Promise<FeedPage> {
  const params = new URLSearchParams();
  params.set('limit', String(query.limit));
  if (query.cursor) params.set('cursor', query.cursor);
  return apiRequest(`/posts/feed?${params.toString()}`, PostFeedPageSchema);
}

