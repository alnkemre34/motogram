import { FollowListQuerySchema, FollowListPageResponseSchema } from './follow.schema';

describe('follow.schema (B-09)', () => {
  it('FollowListQuerySchema coerces limit and accepts optional cursor', () => {
    expect(FollowListQuerySchema.parse({ limit: '10' })).toEqual({ limit: 10, cursor: undefined });
    expect(
      FollowListQuerySchema.parse({
        cursor: '550e8400-e29b-41d4-a716-446655440000',
        limit: 5,
      }),
    ).toEqual({
      cursor: '550e8400-e29b-41d4-a716-446655440000',
      limit: 5,
    });
  });

  it('FollowListPageResponseSchema accepts items + nextCursor', () => {
    const row = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      username: 'u1',
      name: null,
      bio: null,
      avatarUrl: 'https://example.com/a.png',
      coverImageUrl: null,
      city: null,
      country: null,
      ridingStyle: [] as string[],
      isPrivate: false,
      isVerified: false,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      xp: 0,
      level: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      isFollowedByMe: false,
    };
    const parsed = FollowListPageResponseSchema.parse({
      items: [row],
      nextCursor: null,
    });
    expect(parsed.items).toHaveLength(1);
  });
});
