import { ConfigService } from '@nestjs/config';

import { PushService, type PushDispatcher } from './push.service';

// Spec 9.3 - Push dispatcher + invalid token cleanup.

interface PrismaMock {
  deviceToken: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    upsert: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
}

function makePrisma(): PrismaMock {
  return {
    deviceToken: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    get: jest.fn((key: string, def?: string) => overrides[key] ?? def),
  } as unknown as ConfigService;
}

describe('PushService (Spec 9.3)', () => {
  test('registerToken - upsert yeni kullanici icin', async () => {
    const prisma = makePrisma();
    prisma.deviceToken.findUnique.mockResolvedValue(null);
    prisma.deviceToken.upsert.mockResolvedValueOnce({
      id: 'd1',
      token: 'ExponentPushToken[abcdef]',
      platform: 'EXPO',
      appVersion: '1.0.0',
      createdAt: new Date('2026-01-01'),
      lastSeenAt: new Date('2026-04-20'),
    });
    const svc = new PushService(prisma as unknown as never, makeConfig({ PUSH_DRY_RUN: 'true' }));
    const r = await svc.registerToken('u1', {
      token: 'ExponentPushToken[abcdef]',
      platform: 'EXPO',
      appVersion: '1.0.0',
    });
    expect(r.platform).toBe('EXPO');
    expect(prisma.deviceToken.upsert).toHaveBeenCalled();
  });

  test('registerToken - token baska kullaniciya aitti -> devret', async () => {
    const prisma = makePrisma();
    prisma.deviceToken.findUnique.mockResolvedValue({
      id: 'd1',
      token: 'tok',
      userId: 'old-user',
      platform: 'EXPO',
      appVersion: '1.0.0',
      createdAt: new Date(),
      lastSeenAt: new Date(),
    });
    prisma.deviceToken.update.mockResolvedValueOnce({
      id: 'd1',
      platform: 'EXPO',
      appVersion: null,
      createdAt: new Date('2026-01-01'),
      lastSeenAt: new Date('2026-04-20'),
    });
    const svc = new PushService(prisma as unknown as never, makeConfig());
    await svc.registerToken('new-user', {
      token: 'tok',
      platform: 'EXPO',
    });
    expect(prisma.deviceToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'new-user' }) }),
    );
  });

  test('sendToUser - dry run modunda basarili sayilir', async () => {
    const prisma = makePrisma();
    prisma.deviceToken.findMany.mockResolvedValue([
      { id: 'd1', token: 'tok-1', userId: 'u1', platform: 'EXPO' },
      { id: 'd2', token: 'tok-2', userId: 'u1', platform: 'IOS' },
    ]);
    const svc = new PushService(prisma as unknown as never, makeConfig({ PUSH_DRY_RUN: 'true' }));
    const result = await svc.sendToUser('u1', { title: 'Selam', body: 'Yeni mesaj' });
    expect(result.success).toBe(2);
    expect(result.failure).toBe(0);
  });

  test('sendToUser - invalid token dispatcher -> revoke otomatik', async () => {
    const prisma = makePrisma();
    prisma.deviceToken.findMany.mockResolvedValue([
      { id: 'd1', token: 'bad-token', userId: 'u1', platform: 'EXPO' },
    ]);
    const svc = new PushService(prisma as unknown as never, makeConfig({ PUSH_DRY_RUN: 'false' }));
    const dispatcher: PushDispatcher = {
      name: 'expo',
      send: jest.fn().mockResolvedValue('invalid'),
    };
    svc.registerDispatcher('EXPO', dispatcher);
    const result = await svc.sendToUser('u1', { title: 't', body: 'b' });
    expect(result.invalidTokens).toEqual(['bad-token']);
    expect(prisma.deviceToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });

  test('sendToUsers - bos userId listesi -> instant return', async () => {
    const prisma = makePrisma();
    const svc = new PushService(prisma as unknown as never, makeConfig());
    const r = await svc.sendToUsers([], { title: 't', body: 'b' });
    expect(r).toEqual({ success: 0, failure: 0, invalidTokens: [] });
    expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
  });
});
