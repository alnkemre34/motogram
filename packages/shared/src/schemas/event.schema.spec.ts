import {
  EventSearchQuerySchema,
  EventsSearchResponseSchema,
} from './event.schema';

describe('event.schema (B-13)', () => {
  it('EventSearchQuerySchema coerces limit and optional cursor', () => {
    const parsed = EventSearchQuerySchema.parse({
      q: 'ab',
      limit: '5',
    });
    expect(parsed).toEqual({ q: 'ab', limit: 5, cursor: undefined });
  });

  it('EventsSearchResponseSchema parses items + nextCursor', () => {
    const item = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Ride',
      description: null,
      organizerId: '550e8400-e29b-41d4-a716-446655440001',
      communityId: null,
      meetingPointLat: 41,
      meetingPointLng: 29,
      meetingPointName: 'P',
      startTime: '2026-05-01T10:00:00.000Z',
      endTime: null,
      visibility: 'PUBLIC',
      difficulty: null,
      category: null,
      maxParticipants: null,
      participantsCount: 1,
      createdAt: '2026-04-01T00:00:00.000Z',
    };
    const page = EventsSearchResponseSchema.parse({
      items: [item],
      nextCursor: null,
    });
    expect(page.items).toHaveLength(1);
  });
});
