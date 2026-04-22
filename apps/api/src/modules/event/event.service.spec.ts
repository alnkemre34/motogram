import { EventService } from './event.service';

// Spec 3.2 / 8.1 - Event RSVP + waitlist + PostGIS.

interface PrismaMock {
  event: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  eventParticipant: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
}

function makePrisma(): PrismaMock {
  const mock: PrismaMock = {
    event: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    eventParticipant: {
      create: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mock)),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return mock;
}

function buildEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    organizerId: 'org',
    title: 'Ride',
    description: null,
    communityId: null,
    coHostIds: [],
    routeId: null,
    meetingPointLat: 41.0,
    meetingPointLng: 29.0,
    meetingPointName: 'Point',
    startTime: new Date('2026-05-01'),
    endTime: null,
    visibility: 'PUBLIC',
    difficulty: null,
    distance: null,
    category: null,
    maxParticipants: 5,
    rules: null,
    participantsCount: 0,
    deletedAt: null,
    createdAt: new Date('2026-04-01'),
    ...overrides,
  };
}

describe('EventService - RSVP & waitlist (Spec 3.2)', () => {
  test('GOING - kapasite dolu degil -> GOING olarak kaydedilir', async () => {
    const prisma = makePrisma();
    prisma.event.findFirst.mockResolvedValue(buildEvent({ maxParticipants: 5 }));
    prisma.eventParticipant.findUnique.mockResolvedValue(null);
    prisma.eventParticipant.count.mockResolvedValue(2);
    const svc = new EventService(prisma as unknown as never);
    const r = await svc.rsvp('u1', { eventId: 'e1', status: 'GOING' });
    expect(r.rsvpStatus).toBe('GOING');
  });

  test('GOING - kapasite doluysa WAITLIST otomatik', async () => {
    const prisma = makePrisma();
    prisma.event.findFirst.mockResolvedValue(buildEvent({ maxParticipants: 5 }));
    prisma.eventParticipant.findUnique.mockResolvedValue(null);
    prisma.eventParticipant.count.mockResolvedValue(5); // dolu
    const svc = new EventService(prisma as unknown as never);
    const r = await svc.rsvp('u1', { eventId: 'e1', status: 'GOING' });
    expect(r.rsvpStatus).toBe('WAITLIST');
  });

  test('NOT_GOING - GOING kisi ayrilirsa WAITLIST ilk kisi GOING\'e promote edilir', async () => {
    const prisma = makePrisma();
    prisma.event.findFirst.mockResolvedValue(buildEvent({ maxParticipants: 5 }));
    prisma.eventParticipant.findUnique.mockResolvedValue({
      userId: 'u1',
      rsvpStatus: 'GOING',
    });
    prisma.eventParticipant.findFirst.mockResolvedValue({
      userId: 'u2',
      rsvpStatus: 'WAITLIST',
    });
    const svc = new EventService(prisma as unknown as never);
    const r = await svc.rsvp('u1', { eventId: 'e1', status: 'NOT_GOING' });
    expect(r.rsvpStatus).toBe('NOT_GOING');
    expect(r.promotedFromWaitlist).toEqual(['u2']);
    expect(prisma.eventParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rsvpStatus: 'GOING' }),
      }),
    );
  });

  test('listNearby - PostGIS sonucu yoksa fallback (tarihe gore siralama)', async () => {
    const prisma = makePrisma();
    prisma.$queryRaw.mockRejectedValueOnce(new Error('function find_events_within does not exist'));
    prisma.event.findMany.mockResolvedValueOnce([buildEvent({ id: 'e-fallback' })]);
    const svc = new EventService(prisma as unknown as never);
    const r = await svc.listNearby({ lat: 41, lng: 29, radius: 25_000, limit: 20 });
    expect(r).toHaveLength(1);
    expect(r[0]!.id).toBe('e-fallback');
    expect(r[0]!.distance).toBeNull();
  });

  test('listNearby - PostGIS sonucu varsa distance eklenir', async () => {
    const prisma = makePrisma();
    prisma.$queryRaw.mockResolvedValueOnce([
      { event_id: 'e1', distance_m: 800 },
      { event_id: 'e2', distance_m: 2500 },
    ]);
    prisma.event.findMany.mockResolvedValueOnce([
      buildEvent({ id: 'e2' }),
      buildEvent({ id: 'e1' }),
    ]);
    const svc = new EventService(prisma as unknown as never);
    const r = await svc.listNearby({ lat: 41, lng: 29, radius: 25_000, limit: 20 });
    expect(r[0]!.id).toBe('e1');
    expect(r[0]!.distance).toBe(800);
    expect(r[1]!.id).toBe('e2');
  });
});
