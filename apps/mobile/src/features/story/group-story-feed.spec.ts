import { groupStoryFeedByUser, type StoryFeedItem } from './group-story-feed';

describe('groupStoryFeedByUser', () => {
  it('groups by userId and sorts newest first', () => {
    const t1 = '2026-04-22T10:00:00.000Z';
    const t2 = '2026-04-22T12:00:00.000Z';
    const e1 = '2026-04-23T10:00:00.000Z';
    const e2 = '2026-04-23T12:00:00.000Z';
    const items: StoryFeedItem[] = [
      {
        id: 'a0000000-0000-4000-8000-000000000001',
        userId: 'a0000000-0000-4000-8000-0000000000u1',
        user: {
          id: 'a0000000-0000-4000-8000-0000000000u1',
          username: 'rider',
          avatarUrl: 'https://example.com/a.png',
        },
        mediaUrl: 'https://example.com/a.jpg',
        mediaType: 'IMAGE',
        caption: null,
        locationSticker: null,
        garageSticker: null,
        viewsCount: 0,
        createdAt: t1,
        expiresAt: e1,
      },
      {
        id: 'a0000000-0000-4000-8000-000000000002',
        userId: 'a0000000-0000-4000-8000-0000000000u1',
        user: {
          id: 'a0000000-0000-4000-8000-0000000000u1',
          username: 'rider',
          avatarUrl: 'https://example.com/a.png',
        },
        mediaUrl: 'https://example.com/b.jpg',
        mediaType: 'IMAGE',
        caption: null,
        locationSticker: null,
        garageSticker: null,
        viewsCount: 0,
        createdAt: t2,
        expiresAt: e2,
      },
    ] as StoryFeedItem[];
    const g = groupStoryFeedByUser(items);
    expect(g).toHaveLength(1);
    expect(g[0]!.stories[0]!.id).toBe('a0000000-0000-4000-8000-000000000002');
    expect(g[0]!.stories[1]!.id).toBe('a0000000-0000-4000-8000-000000000001');
  });
});
