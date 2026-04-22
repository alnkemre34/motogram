import { LikeToggleResponseSchema } from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

export async function likePost(postId: string) {
  return apiRequest(`/likes/${postId}`, LikeToggleResponseSchema, { method: 'POST' });
}

export async function unlikePost(postId: string) {
  return apiRequest(`/likes/${postId}`, LikeToggleResponseSchema, { method: 'DELETE' });
}
