import { StoryFeedItemResponseSchema } from '@motogram/shared';
import { type z } from 'zod';

// Saf — test edilebilir: takip feed’i kullanıcıya göre grupla (hikâye treni halkası)

export type StoryFeedItem = z.infer<typeof StoryFeedItemResponseSchema>;

export function groupStoryFeedByUser(
  items: readonly StoryFeedItem[],
): { userId: string; user: StoryFeedItem['user']; stories: StoryFeedItem[] }[] {
  const byUser = new Map<string, StoryFeedItem[]>();
  for (const s of items) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }
  for (const list of byUser.values()) {
    list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
  return Array.from(byUser.entries()).map(([userId, stories]) => ({
    userId,
    user: stories[0]!.user,
    stories,
  }));
}
