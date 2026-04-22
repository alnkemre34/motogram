import { BadRequestException } from '@nestjs/common';

import { AccountService } from './account.service';

// Spec 5.2 + 8.11.4 - 30 gun bekleme + fiziksel silme.

function buildService() {
  const now = new Date('2026-04-20T00:00:00.000Z');
  jest.useFakeTimers().setSystemTime(now);

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', deletedAt: null, accountDeletion: null }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    accountDeletion: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) => ({
        ...create,
        cancelledAt: null,
        executedAt: null,
      })),
      update: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        user: prisma.user,
        accountDeletion: prisma.accountDeletion,
      };
      return cb(tx);
    }),
  };

  // Spec 7.2.1 - DeletionQueue mock (enqueue/cancel no-op; BullMQ test disi).
  const queue = {
    registerProcessor: jest.fn(),
    enqueueDelayed: jest.fn().mockResolvedValue('job-1'),
    cancelByJobId: jest.fn().mockResolvedValue(true),
  };
  const service = new AccountService(prisma as never, queue as never);
  return { service, prisma, now, queue };
}

describe('AccountService (Spec 5.2)', () => {
  afterEach(() => jest.useRealTimers());

  it('schedules deletion 30 days out and soft-deletes the user', async () => {
    const { service, prisma, now } = buildService();
    const status = await service.requestDeletion('u1', {});
    expect(status.pending).toBe(true);
    expect(status.daysRemaining).toBe(30);
    expect(new Date(status.scheduledFor!).getTime() - now.getTime()).toBeCloseTo(
      30 * 24 * 3600 * 1000,
      -3,
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
  });

  it('cancel restores deletedAt=null and marks cancelledAt', async () => {
    const { service, prisma } = buildService();
    prisma.accountDeletion.findUnique.mockResolvedValue({
      userId: 'u1',
      requestedAt: new Date(),
      scheduledFor: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      cancelledAt: null,
      executedAt: null,
    });
    prisma.accountDeletion.update.mockResolvedValue({
      userId: 'u1',
      requestedAt: new Date(),
      scheduledFor: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      cancelledAt: new Date(),
      executedAt: null,
    });
    const status = await service.cancelDeletion('u1');
    expect(status.pending).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: null } }),
    );
  });

  it('refuses cancel when no active deletion', async () => {
    const { service } = buildService();
    await expect(service.cancelDeletion('u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('executeDeletions runs user.delete for scheduled records', async () => {
    const { service, prisma } = buildService();
    prisma.accountDeletion.findMany.mockResolvedValue([
      { userId: 'u1', scheduledFor: new Date(Date.now() - 1000) },
      { userId: 'u2', scheduledFor: new Date(Date.now() - 2000) },
    ]);
    const r = await service.executeDeletions();
    expect(r.processed).toBe(2);
    expect(r.errors).toBe(0);
    expect(prisma.user.delete).toHaveBeenCalledTimes(2);
  });
});
