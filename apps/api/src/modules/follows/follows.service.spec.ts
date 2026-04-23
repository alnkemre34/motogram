import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '@motogram/shared';

import { FollowsService } from './follows.service';

// Spec 7.2.2 - Engelleme iki taraf da goremez, takip kurulamaz
// Spec 2.6 / 3.2 - Private hesaplarda takip PENDING, public hesaplarda ACCEPTED
// Spec 9.4 - Standart hata formati

function createPrismaMock() {
  const txApi = {
    follow: { upsert: jest.fn(), delete: jest.fn() },
    user: { update: jest.fn() },
  };
  return {
    user: { findFirst: jest.fn() },
    block: { findFirst: jest.fn(), findMany: jest.fn() },
    follow: { findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: typeof txApi) => unknown) => cb(txApi)),
    __tx: txApi,
  };
}

describe('FollowsService (Spec 2.6, 7.2.2, 9.4)', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: FollowsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    const events = { emit: jest.fn(() => true) } as unknown as import('../../common/events/zod-event-bus.service').ZodEventBus;
    service = new FollowsService(prisma as never, events);
  });

  it('prevents self-follow with VALIDATION_FAILED', async () => {
    await expect(service.follow('u1', 'u1')).rejects.toMatchObject({
      response: { error: 'cannot_follow_self', code: ErrorCodes.VALIDATION_FAILED },
    });
    await expect(service.follow('u1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 when target user missing', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.follow('u1', 'u2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks follow when a block record exists (Spec 7.2.2)', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2', isPrivate: false });
    prisma.block.findFirst.mockResolvedValue({ id: 'bl1' });
    await expect(service.follow('u1', 'u2')).rejects.toMatchObject({
      response: { error: 'blocked', code: ErrorCodes.BLOCKED },
    });
  });

  it('status is PENDING when target is private (Spec 2.6)', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2', isPrivate: true });
    prisma.block.findFirst.mockResolvedValue(null);

    const res = await service.follow('u1', 'u2');

    expect(res.status).toBe('PENDING');
    expect(prisma.__tx.follow.upsert).toHaveBeenCalled();
    expect(prisma.__tx.user.update).not.toHaveBeenCalled();
  });

  it('status is ACCEPTED and counts incremented when target is public', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2', isPrivate: false });
    prisma.block.findFirst.mockResolvedValue(null);

    const res = await service.follow('u1', 'u2');

    expect(res.status).toBe('ACCEPTED');
    expect(prisma.__tx.user.update).toHaveBeenCalledTimes(2);
  });

  it('unfollow decrements only if status was ACCEPTED', async () => {
    prisma.follow.findUnique.mockResolvedValue({ status: 'ACCEPTED' });
    await service.unfollow('u1', 'u2');
    expect(prisma.__tx.user.update).toHaveBeenCalledTimes(2);
  });

  it('unfollow is noop when no record exists', async () => {
    prisma.follow.findUnique.mockResolvedValue(null);
    await service.unfollow('u1', 'u2');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  describe('B-09 list followers/following', () => {
    const followerRow = {
      id: 'f1',
      username: 'fan',
      name: 'Fan',
      bio: null,
      avatarUrl: null,
      coverImageUrl: null,
      city: null,
      country: null,
      ridingStyle: [] as string[],
      isPrivate: false,
      isVerified: false,
      followersCount: 0,
      followingCount: 1,
      postsCount: 0,
      xp: 0,
      level: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    it('listFollowersForProfile throws when profile missing', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.listFollowersForProfile('viewer', 'missing', { limit: 20 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('listFollowersForProfile maps isFollowedByMe', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'profile' });
      prisma.block.findMany.mockResolvedValue([]);
      prisma.follow.findMany
        .mockResolvedValueOnce([
          { id: 'follow-row-1', follower: followerRow },
        ])
        .mockResolvedValueOnce([{ followingId: followerRow.id }]);
      const res = await service.listFollowersForProfile('viewer', 'profile', { limit: 20 });
      expect(res.items).toHaveLength(1);
      expect(res.items[0]!.id).toBe(followerRow.id);
      expect(res.items[0]!.isFollowedByMe).toBe(true);
      expect(res.nextCursor).toBeNull();
    });

    it('listFollowingForProfile maps isFollowedByMe false when not following', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'profile' });
      prisma.block.findMany.mockResolvedValue([]);
      prisma.follow.findMany
        .mockResolvedValueOnce([
          { id: 'follow-row-2', following: followerRow },
        ])
        .mockResolvedValueOnce([]);
      const res = await service.listFollowingForProfile('viewer', 'profile', { limit: 20 });
      expect(res.items[0]!.isFollowedByMe).toBe(false);
    });
  });
});
