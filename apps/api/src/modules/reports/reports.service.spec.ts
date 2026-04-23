import { ConflictException } from '@nestjs/common';
import { ErrorCodes } from '@motogram/shared';

import { ReportsService } from './reports.service';

function createPrismaMock() {
  return {
    report: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
}

describe('ReportsService (B-11)', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: ReportsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ReportsService(prisma as never);
  });

  const dto = {
    targetType: 'USER' as const,
    targetId: '550e8400-e29b-41d4-a716-446655440000',
    reason: 'spam',
  };

  it('throws 409 when duplicate within 24h', async () => {
    prisma.report.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.create('rep1', dto)).rejects.toMatchObject({
      response: { error: 'report_duplicate', code: ErrorCodes.CONFLICT },
    });
    await expect(service.create('rep1', dto)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it('creates report when no duplicate', async () => {
    prisma.report.findFirst.mockResolvedValue(null);
    const created = {
      id: 'r1',
      reporterId: 'rep1',
      targetType: 'USER',
      targetId: dto.targetId,
      reason: dto.reason,
      description: null,
      status: 'PENDING',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
    };
    prisma.report.create.mockResolvedValue(created);

    const res = await service.create('rep1', dto);

    expect(res).toEqual(created);
    expect(prisma.report.create).toHaveBeenCalled();
  });
});
