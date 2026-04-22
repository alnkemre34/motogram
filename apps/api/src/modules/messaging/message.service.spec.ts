import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { MessageService } from './message.service';

// Spec 2.5 / 7.2.2 / 8.7.1 - MessageService davranis kontratlari.
// - Idempotent clientId (duplicate -> ayni mesaj dondurulur, persist edilmez).
// - Engelleme: DM'de blocked -> ForbiddenException.
// - Rate limit: Redis INCR 60/dk.
// - validateContent: text/media/invite yoksa BadRequest.

interface PrismaMock {
  message: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  messageReaction: {
    upsert: jest.Mock;
    delete: jest.Mock;
  };
  conversation: { update: jest.Mock };
  conversationParticipant: { update: jest.Mock };
  block: { findFirst: jest.Mock };
  $transaction: jest.Mock;
}

interface RedisMock {
  incr: jest.Mock;
  expire: jest.Mock;
}

interface ConversationServiceMock {
  assertParticipant: jest.Mock;
  getDirectPartner: jest.Mock;
  listParticipantIds: jest.Mock;
}

function makePrisma(): PrismaMock {
  const mock: PrismaMock = {
    message: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    messageReaction: {
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    conversation: { update: jest.fn() },
    conversationParticipant: { update: jest.fn() },
    block: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mock)),
  };
  return mock;
}

function makeRedis(): RedisMock {
  return {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  };
}

function makeConvoService(): ConversationServiceMock {
  return {
    assertParticipant: jest.fn().mockResolvedValue({ userId: 'me', conversationId: 'c1' }),
    getDirectPartner: jest.fn().mockResolvedValue('peer'),
    listParticipantIds: jest.fn().mockResolvedValue(['me', 'peer']),
  };
}

function buildMsgRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    conversationId: 'c1',
    senderId: 'me',
    clientId: 'client-1',
    content: 'hello',
    mediaUrls: [],
    messageType: 'TEXT',
    inviteData: null,
    isDeleted: false,
    createdAt: new Date('2026-04-20T10:00:00Z'),
    reactions: [],
    ...overrides,
  };
}

describe('MessageService (Spec 2.5)', () => {
  test('idempotent clientId - duplicate mesaj persist etmez, recipientIds doner', async () => {
    const prisma = makePrisma();
    const redis = makeRedis();
    const convos = makeConvoService();

    prisma.message.findUnique.mockResolvedValueOnce(buildMsgRow());
    const svc = new MessageService(
      prisma as unknown as never,
      redis as unknown as never,
      convos as unknown as never,
    );
    const result = await svc.send('me', {
      conversationId: 'c1',
      clientId: 'client-1',
      messageType: 'TEXT',
      content: 'hello',
      mediaUrls: [],
    });
    expect(result.duplicate).toBe(true);
    expect(result.message.id).toBe('msg-1');
    expect(result.recipientIds).toEqual(['peer']);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  test('engelli DM -> ForbiddenException', async () => {
    const prisma = makePrisma();
    prisma.block.findFirst.mockResolvedValueOnce({
      id: 'b1',
      initiatorId: 'peer',
      targetId: 'me',
    });
    const svc = new MessageService(
      prisma as unknown as never,
      makeRedis() as unknown as never,
      makeConvoService() as unknown as never,
    );
    await expect(
      svc.send('me', {
        conversationId: 'c1',
        clientId: 'cid',
        messageType: 'TEXT',
        content: 'hi',
        mediaUrls: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('rate limit asildi -> ForbiddenException (RATE_LIMITED)', async () => {
    const prisma = makePrisma();
    const redis = makeRedis();
    redis.incr.mockResolvedValueOnce(61); // limit 60
    const svc = new MessageService(
      prisma as unknown as never,
      redis as unknown as never,
      makeConvoService() as unknown as never,
    );
    await expect(
      svc.send('me', {
        conversationId: 'c1',
        clientId: 'cid-x',
        messageType: 'TEXT',
        content: 'spam',
        mediaUrls: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('ilk gonderim - mesaj olusturulur, lastMessageAt guncellenir, lastReadAt sender icin set edilir', async () => {
    const prisma = makePrisma();
    const convos = makeConvoService();
    const msg = buildMsgRow({ id: 'msg-new' });
    prisma.message.findUnique.mockResolvedValueOnce(null);
    prisma.message.create.mockResolvedValueOnce(msg);
    const svc = new MessageService(
      prisma as unknown as never,
      makeRedis() as unknown as never,
      convos as unknown as never,
    );

    const cbPersist = jest.fn();
    svc.registerCallbacks({ onMessagePersisted: cbPersist });

    const result = await svc.send('me', {
      conversationId: 'c1',
      clientId: 'client-new',
      messageType: 'TEXT',
      content: 'hello',
      mediaUrls: [],
    });
    expect(result.duplicate).toBe(false);
    expect(result.message.id).toBe('msg-new');
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' } }),
    );
    expect(prisma.conversationParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          conversationId_userId: { conversationId: 'c1', userId: 'me' },
        },
      }),
    );
    expect(cbPersist).toHaveBeenCalledWith(
      expect.objectContaining({ recipientIds: ['peer'] }),
    );
  });

  test('validateContent - bos mesaj -> BadRequest', async () => {
    const svc = new MessageService(
      makePrisma() as unknown as never,
      makeRedis() as unknown as never,
      makeConvoService() as unknown as never,
    );
    expect(() =>
      svc.validateContent({
        conversationId: 'c1',
        clientId: 'c',
        messageType: 'TEXT',
        content: '   ',
        mediaUrls: [],
      }),
    ).toThrow(BadRequestException);
  });
});
