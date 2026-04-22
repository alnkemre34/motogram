import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { CommunityService } from './community.service';

// Spec 2.4.2 - Topluluk join onay akisi (Public/Private/Hidden) + rol kontrolu.

interface PrismaMock {
  community: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  communityMember: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
}

function makePrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    community: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    communityMember: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mock)),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return mock;
}

function buildCommunity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    name: 'Istanbul Riders',
    description: 'desc',
    avatarUrl: null,
    coverImageUrl: null,
    visibility: 'PUBLIC',
    region: 'TR',
    tags: [],
    ownerId: 'owner',
    membersCount: 1,
    latitude: 41,
    longitude: 29,
    rules: null,
    createdAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  };
}

describe('CommunityService - join approval flow (Spec 2.4.2)', () => {
  test('PUBLIC community -> status=ACTIVE instant', async () => {
    const prisma = makePrismaMock();
    prisma.community.findFirst.mockResolvedValue(buildCommunity({ visibility: 'PUBLIC' }));
    prisma.communityMember.findUnique.mockResolvedValue(null);
    const service = new CommunityService(prisma as unknown as never);
    const result = await service.joinCommunity('u1', { communityId: 'c1' });
    expect(result.status).toBe('ACTIVE');
    expect(prisma.communityMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE', role: 'MEMBER' }),
      }),
    );
  });

  test('PRIVATE community -> status=PENDING (onay bekliyor)', async () => {
    const prisma = makePrismaMock();
    prisma.community.findFirst.mockResolvedValue(buildCommunity({ visibility: 'PRIVATE' }));
    prisma.communityMember.findUnique.mockResolvedValue(null);
    const service = new CommunityService(prisma as unknown as never);
    const result = await service.joinCommunity('u1', { communityId: 'c1' });
    expect(result.status).toBe('PENDING');
  });

  test('BANNED member -> ForbiddenException', async () => {
    const prisma = makePrismaMock();
    prisma.community.findFirst.mockResolvedValue(buildCommunity({ visibility: 'PUBLIC' }));
    prisma.communityMember.findUnique.mockResolvedValue({ status: 'BANNED', role: 'MEMBER' });
    const service = new CommunityService(prisma as unknown as never);
    await expect(service.joinCommunity('u1', { communityId: 'c1' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  test('HIDDEN community detay -> non-member NotFoundException (invisible)', async () => {
    const prisma = makePrismaMock();
    prisma.community.findFirst.mockResolvedValue(buildCommunity({ visibility: 'HIDDEN' }));
    prisma.communityMember.findUnique.mockResolvedValue(null);
    const service = new CommunityService(prisma as unknown as never);
    await expect(service.getCommunityDetail('c1', 'stranger')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test('respondJoinRequest - OWNER accept -> ACTIVE, membersCount++', async () => {
    const prisma = makePrismaMock();
    prisma.communityMember.findUnique
      .mockResolvedValueOnce({ role: 'OWNER', status: 'ACTIVE' }) // requireRole
      .mockResolvedValueOnce({ role: 'MEMBER', status: 'PENDING' }); // getMembership(pending)
    const service = new CommunityService(prisma as unknown as never);
    const r = await service.respondJoinRequest('owner', {
      communityId: 'c1',
      userId: 'u1',
      accept: true,
    });
    expect(r.status).toBe('ACTIVE');
    expect(prisma.communityMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  test('respondJoinRequest - non-admin -> ForbiddenException', async () => {
    const prisma = makePrismaMock();
    prisma.communityMember.findUnique.mockResolvedValue({ role: 'MEMBER', status: 'ACTIVE' });
    const service = new CommunityService(prisma as unknown as never);
    await expect(
      service.respondJoinRequest('u2', { communityId: 'c1', userId: 'u1', accept: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('respondJoinRequest - no pending -> BadRequestException', async () => {
    const prisma = makePrismaMock();
    prisma.communityMember.findUnique
      .mockResolvedValueOnce({ role: 'OWNER', status: 'ACTIVE' })
      .mockResolvedValueOnce(null);
    const service = new CommunityService(prisma as unknown as never);
    await expect(
      service.respondJoinRequest('owner', { communityId: 'c1', userId: 'u1', accept: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CommunityService - PostGIS radius (Spec 8.1)', () => {
  test('PostGIS mevcut -> find_communities_within sonucu dondurur, mesafeye gore siralar', async () => {
    const prisma = makePrismaMock();
    prisma.$queryRaw.mockResolvedValueOnce([
      { community_id: 'c1', distance_m: 500 },
      { community_id: 'c2', distance_m: 1500 },
    ]);
    prisma.community.findMany.mockResolvedValueOnce([
      buildCommunity({ id: 'c2' }),
      buildCommunity({ id: 'c1' }),
    ]);
    const service = new CommunityService(prisma as unknown as never);
    const result = await service.listNearby({
      lat: 41,
      lng: 29,
      radius: 5000,
      limit: 20,
    });
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('c1');
    expect(result[0]!.distance).toBe(500);
    expect(result[1]!.id).toBe('c2');
  });

  test('PostGIS yok (exception) -> fallback: en kalabalik public topluluklar', async () => {
    const prisma = makePrismaMock();
    prisma.$queryRaw.mockRejectedValueOnce(new Error('function find_communities_within does not exist'));
    prisma.community.findMany.mockResolvedValueOnce([buildCommunity({ id: 'c9' })]);
    const service = new CommunityService(prisma as unknown as never);
    const result = await service.listNearby({
      lat: 41,
      lng: 29,
      radius: 5000,
      limit: 20,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('c9');
    expect(result[0]!.distance).toBeNull();
  });
});
