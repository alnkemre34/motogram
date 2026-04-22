import { NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '@motogram/shared';

import { LikesService } from './likes.service';

// Spec 7.1.1 - Optimistik UI icin backend idempotent olmali
// Spec 3.2 - Like model @@unique([postId, userId]) duplicate like'i engeller
// Spec 9.4 - 404 + NOT_FOUND for missing post

function createPrismaMock() {
  const txApi = {
    like: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    post: { update: jest.fn(), findUnique: jest.fn() },
  };
  return {
    post: { findFirst: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: typeof txApi) => unknown) => cb(txApi)),
    __tx: txApi,
  };
}

describe('LikesService (Spec 7.1.1, 3.2, 9.4)', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: LikesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new LikesService(prisma as never);
  });

  it('returns 404 + NOT_FOUND when liking a missing post (Spec 9.4)', async () => {
    prisma.post.findFirst.mockResolvedValue(null);
    await expect(service.like('u1', 'p404')).rejects.toMatchObject({
      response: { error: 'post_not_found', code: ErrorCodes.NOT_FOUND },
    });
    await expect(service.like('u1', 'p404')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('is idempotent on duplicate like (Spec 7.1.1 - same like -> no count change)', async () => {
    prisma.post.findFirst.mockResolvedValue({ id: 'p1' });
    prisma.__tx.like.findUnique.mockResolvedValue({ id: 'lk1' });
    prisma.__tx.post.findUnique.mockResolvedValue({ likesCount: 7 });

    const res = await service.like('u1', 'p1');

    expect(prisma.__tx.like.create).not.toHaveBeenCalled();
    expect(prisma.__tx.post.update).not.toHaveBeenCalled();
    expect(res).toEqual({ liked: true, likesCount: 7 });
  });

  it('creates like and increments count when not already liked', async () => {
    prisma.post.findFirst.mockResolvedValue({ id: 'p1' });
    prisma.__tx.like.findUnique.mockResolvedValue(null);
    prisma.__tx.post.update.mockResolvedValue({ likesCount: 8 });

    const res = await service.like('u1', 'p1');

    expect(prisma.__tx.like.create).toHaveBeenCalledWith({
      data: { postId: 'p1', userId: 'u1' },
    });
    expect(prisma.__tx.post.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    });
    expect(res).toEqual({ liked: true, likesCount: 8 });
  });

  it('unlike is idempotent when like does not exist', async () => {
    prisma.__tx.like.findUnique.mockResolvedValue(null);
    prisma.__tx.post.findUnique.mockResolvedValue({ likesCount: 3 });

    const res = await service.unlike('u1', 'p1');

    expect(prisma.__tx.like.delete).not.toHaveBeenCalled();
    expect(res).toEqual({ liked: false, likesCount: 3 });
  });

  it('unlike deletes like and decrements count when exists', async () => {
    prisma.__tx.like.findUnique.mockResolvedValue({ id: 'lk1' });
    prisma.__tx.post.update.mockResolvedValue({ likesCount: 2 });

    const res = await service.unlike('u1', 'p1');

    expect(prisma.__tx.like.delete).toHaveBeenCalled();
    expect(prisma.__tx.post.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { likesCount: { decrement: 1 } },
      select: { likesCount: true },
    });
    expect(res).toEqual({ liked: false, likesCount: 2 });
  });
});
