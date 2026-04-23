import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '@motogram/shared';

import { BlocksService } from './blocks.service';

function createPrismaMock() {
  return {
    user: { findFirst: jest.fn() },
    block: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
}

describe('BlocksService (B-10, Spec 7.2.2)', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let follows: { unfollow: jest.Mock };
  let service: BlocksService;

  beforeEach(() => {
    prisma = createPrismaMock();
    follows = { unfollow: jest.fn().mockResolvedValue(undefined) };
    service = new BlocksService(prisma as never, follows as never);
  });

  it('rejects self-block', async () => {
    await expect(service.blockUser('u1', 'u1')).rejects.toMatchObject({
      response: { error: 'cannot_block_self', code: ErrorCodes.VALIDATION_FAILED },
    });
    await expect(service.blockUser('u1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 when target missing', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.blockUser('u1', 'u2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unfollows both ways then upserts block', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u2' });
    prisma.block.upsert.mockResolvedValue({
      targetId: 'u2',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    const res = await service.blockUser('u1', 'u2');

    expect(follows.unfollow).toHaveBeenCalledWith('u1', 'u2');
    expect(follows.unfollow).toHaveBeenCalledWith('u2', 'u1');
    expect(prisma.block.upsert).toHaveBeenCalled();
    expect(res.targetId).toBe('u2');
  });

  it('peersBlockedEitherWay collects both directions', async () => {
    prisma.block.findMany.mockResolvedValue([
      { initiatorId: 'me', targetId: 'a' },
      { initiatorId: 'b', targetId: 'me' },
    ]);
    const ids = await service.peersBlockedEitherWay('me');
    expect(ids.sort()).toEqual(['a', 'b'].sort());
  });
});
