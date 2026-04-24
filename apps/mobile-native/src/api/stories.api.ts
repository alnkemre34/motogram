import { StoryFeedResponseSchema, SuccessTrueSchema } from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

// Spec 2.2 — hikayeler: feed + görüntülenme

export async function fetchStoryFeed() {
  return apiRequest('/stories/feed', StoryFeedResponseSchema, { method: 'GET' });
}

export async function recordStoryView(storyId: string) {
  return apiRequest(`/stories/${storyId}/views`, SuccessTrueSchema, {
    method: 'POST',
    skipAuth: false,
  });
}

