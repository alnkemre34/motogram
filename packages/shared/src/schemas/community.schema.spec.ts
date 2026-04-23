import {
  CommunitiesSearchResponseSchema,
  CommunitySearchQuerySchema,
} from './community.schema';

describe('community.schema (B-12)', () => {
  it('CommunitySearchQuerySchema coerces limit and trims q usage', () => {
    const parsed = CommunitySearchQuerySchema.parse({
      q: 'ab',
      limit: '5',
    });
    expect(parsed).toEqual({ q: 'ab', limit: 5, cursor: undefined });
  });

  it('CommunitiesSearchResponseSchema parses items + nextCursor', () => {
    const item = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Club',
      description: null,
      avatarUrl: null,
      coverImageUrl: null,
      visibility: 'PUBLIC',
      region: null,
      tags: [] as string[],
      ownerId: '550e8400-e29b-41d4-a716-446655440001',
      membersCount: 1,
      latitude: null,
      longitude: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const page = CommunitiesSearchResponseSchema.parse({
      items: [item],
      nextCursor: null,
    });
    expect(page.items).toHaveLength(1);
  });
});
