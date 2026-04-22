import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { EmergencyService } from './emergency.service';
import { SOS_MIN_HOLD_MS } from './emergency.constants';

// Spec 4.4 + 8.7.1 - SOS yanlis tiklama korumasi + rate limit.

function buildService(overrides: {
  redisIncr?: jest.Mock;
  redisTtl?: jest.Mock;
  redisExpire?: jest.Mock;
  redisSet?: jest.Mock;
}) {
  const redisIncr = overrides.redisIncr ?? jest.fn().mockResolvedValue(1);
  const redisTtl = overrides.redisTtl ?? jest.fn().mockResolvedValue(600);
  const redisExpire = overrides.redisExpire ?? jest.fn().mockResolvedValue(1);
  const redisSet = overrides.redisSet ?? jest.fn().mockResolvedValue('OK');

  const redis = {
    raw: {
      incr: redisIncr,
      expire: redisExpire,
      ttl: redisTtl,
      set: redisSet,
    },
  };

  const prisma = {
    emergencyAlert: {
      create: jest.fn().mockResolvedValue({
        id: 'alert-1',
        userId: 'u1',
        type: 'GENERAL',
        description: null,
        latitude: 41,
        longitude: 29,
        accuracyMeters: null,
        radiusMeters: 5000,
        city: 'Istanbul',
        status: 'OPEN',
        notifiedCount: 0,
        createdAt: new Date(),
        resolvedAt: null,
        cancelledAt: null,
      }),
      update: jest.fn(),
    },
    emergencyResponder: { createMany: jest.fn() },
    block: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { create: jest.fn() },
  };

  const location = { queryNearbyRaw: jest.fn().mockResolvedValue({ riders: [] }) };
  const push = { sendToUsers: jest.fn().mockResolvedValue({ success: 0, failure: 0, invalidTokens: [] }) };
  const notifications = { create: jest.fn() };
  const events = { emit: jest.fn() };

  const service = new EmergencyService(
    prisma as never,
    redis as never,
    location as never,
    push as never,
    notifications as never,
    events as never,
  );
  return { service, prisma, redis, location, push, notifications, events };
}

describe('EmergencyService (Spec 4.4 + 8.7.1)', () => {
  const baseUser = { username: 'rider', city: 'Istanbul', isBanned: false };

  it('rejects banned users', async () => {
    const { service } = buildService({});
    await expect(
      service.createAlert('u1', { type: 'GENERAL', latitude: 41, longitude: 29, radiusMeters: 5000 } as never, {
        ...baseUser,
        isBanned: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects false-tap holds shorter than 3000ms (Spec 4.4)', async () => {
    const { service } = buildService({});
    await expect(
      service.createAlert(
        'u1',
        {
          type: 'GENERAL',
          latitude: 41,
          longitude: 29,
          radiusMeters: 5000,
          holdDurationMs: SOS_MIN_HOLD_MS - 500,
        } as never,
        baseUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces 10-minute rate limit after 3 alerts (Spec 8.7.1)', async () => {
    const { service, prisma } = buildService({
      redisIncr: jest.fn().mockResolvedValue(4), // asildi
    });
    await expect(
      service.createAlert(
        'u1',
        { type: 'GENERAL', latitude: 41, longitude: 29, radiusMeters: 5000 } as never,
        baseUser,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'sos_rate_limit', accountRestricted: true }),
    });
    // Admin audit log atildigini dogrula
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'SOS_RATE_LIMIT_TRIGGERED' }),
      }),
    );
  });

  it('accepts valid alert and calls location.queryNearbyRaw with radius', async () => {
    const { service, location } = buildService({});
    await service.createAlert(
      'u1',
      {
        type: 'ACCIDENT',
        latitude: 41,
        longitude: 29,
        radiusMeters: 5000,
        holdDurationMs: SOS_MIN_HOLD_MS + 100,
      } as never,
      baseUser,
    );
    expect(location.queryNearbyRaw).toHaveBeenCalledWith(
      41,
      29,
      5000,
      expect.objectContaining({ city: 'Istanbul' }),
    );
  });
});
