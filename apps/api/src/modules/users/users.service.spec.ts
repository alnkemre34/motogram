import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '@motogram/shared';

import { UsersService } from './users.service';

function createPrismaMock() {
  return {
    user: {
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      update: jest.fn(),
    },
  } as const;
}

describe('UsersService (B-06 changeUsername)', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UsersService(prisma as never);
  });

  it('throws NotFound when user missing', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.changeUsername('u1', { username: 'newname_1' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns profile without update when normalized username unchanged', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 'u1',
      username: 'SameUser',
      usernameChangedAt: null,
    } as never);
    prisma.user.findFirstOrThrow.mockResolvedValue({
      id: 'u1',
      username: 'sameuser',
    } as never);

    const out = await service.changeUsername('u1', { username: 'sameuser' });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(out).toEqual({ id: 'u1', username: 'sameuser' });
  });

  it('rejects reserved username', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 'u1',
      username: 'bob',
      usernameChangedAt: null,
    } as never);
    await expect(service.changeUsername('u1', { username: 'admin' })).rejects.toMatchObject({
      response: { error: 'username_reserved', code: ErrorCodes.VALIDATION_FAILED },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects motogram-prefixed username', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 'u1',
      username: 'bob',
      usernameChangedAt: null,
    } as never);
    await expect(service.changeUsername('u1', { username: 'motogram_x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects when 30-day cooldown active', async () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 'u1',
      username: 'bob',
      usernameChangedAt: recent,
    } as never);
    await expect(service.changeUsername('u1', { username: 'newname_2' })).rejects.toMatchObject({
      response: { error: 'username_change_cooldown', code: ErrorCodes.VALIDATION_FAILED },
    });
  });

  it('allows change when last change was over 30 days ago', async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    prisma.user.findFirst
      .mockResolvedValueOnce({ id: 'u1', username: 'bob', usernameChangedAt: old } as never)
      .mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValue({ id: 'u1', username: 'newname_3' } as never);

    const out = await service.changeUsername('u1', { username: 'newname_3' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { username: 'newname_3', usernameChangedAt: expect.any(Date) },
      select: expect.any(Object),
    });
    expect(out.username).toBe('newname_3');
  });

  it('throws Conflict when username taken by another user', async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce({ id: 'u1', username: 'bob', usernameChangedAt: null } as never)
      .mockResolvedValueOnce({ id: 'u2' } as never);
    await expect(service.changeUsername('u1', { username: 'taken99' })).rejects.toMatchObject({
      response: { error: 'username_taken', code: ErrorCodes.CONFLICT },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('first username change allowed when usernameChangedAt is null', async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce({ id: 'u1', username: 'bob', usernameChangedAt: null } as never)
      .mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValue({ id: 'u1', username: 'carol_01' } as never);

    await service.changeUsername('u1', { username: 'Carol_01' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ username: 'carol_01' }),
      }),
    );
  });
});
