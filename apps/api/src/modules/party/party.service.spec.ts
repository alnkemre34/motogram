import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { PartySignalType } from '@motogram/shared';

import { PartyService, type PartyEmitter } from './party.service';

// Spec 3.2 + 4.1 + 7.3.1 + 8.7.1 - PartyService kontratlari

interface PipelineMock {
  sadd: jest.Mock;
  srem: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  zadd: jest.Mock;
  zrem: jest.Mock;
  exec: jest.Mock;
}

function createPipelineMock(): PipelineMock {
  return {
    sadd: jest.fn().mockReturnThis(),
    srem: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    zadd: jest.fn().mockReturnThis(),
    zrem: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
}

interface RedisRawMock {
  set: jest.Mock;
  eval: jest.Mock;
  multi: jest.Mock;
  sismember: jest.Mock;
  smembers: jest.Mock;
  zadd: jest.Mock;
  zrem: jest.Mock;
  zrangebyscore: jest.Mock;
}

interface RedisMock {
  raw: RedisRawMock;
  incrementActionCount: jest.Mock;
}

function createRedisMock(): RedisMock {
  return {
    raw: {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
      multi: jest.fn().mockImplementation(() => createPipelineMock()),
      sismember: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      zadd: jest.fn().mockResolvedValue(1),
      zrem: jest.fn().mockResolvedValue(1),
      zrangebyscore: jest.fn().mockResolvedValue([]),
    },
    incrementActionCount: jest.fn().mockResolvedValue(1),
  };
}

interface PrismaMock {
  party: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };
  partyMember: {
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    findFirst: jest.Mock;
  };
  partyInvite: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    findMany: jest.Mock;
  };
  route: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  $transaction: jest.Mock;
}

function createPrismaMock(): PrismaMock {
  const prisma: PrismaMock = {
    party: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    partyMember: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    partyInvite: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    route: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: PrismaMock) => unknown)(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };
  return prisma;
}

function createLeaderElectionMock() {
  return {
    elect: jest.fn().mockResolvedValue({
      newLeaderId: null,
      locked: false,
      reason: 'no_candidates',
    }),
    pickNextLeader: jest.fn(),
    release: jest.fn().mockResolvedValue(true),
  };
}

function createNotificationsMock() {
  return { create: jest.fn().mockResolvedValue(undefined) };
}

function createEmitterMock(): jest.Mocked<PartyEmitter> {
  return {
    emitMemberJoined: jest.fn(),
    emitMemberLeft: jest.fn(),
    emitStatusChanged: jest.fn(),
    emitLeaderChanged: jest.fn(),
    emitSignal: jest.fn(),
    emitEnded: jest.fn(),
  };
}

describe('PartyService (Spec 3.2, 4.1, 7.3.1, 8.2, 8.7.1)', () => {
  let redis: RedisMock;
  let prisma: PrismaMock;
  let leader: ReturnType<typeof createLeaderElectionMock>;
  let notifications: ReturnType<typeof createNotificationsMock>;
  let emitter: jest.Mocked<PartyEmitter>;
  let service: PartyService;

  beforeEach(() => {
    redis = createRedisMock();
    prisma = createPrismaMock();
    leader = createLeaderElectionMock();
    notifications = createNotificationsMock();
    emitter = createEmitterMock();
    service = new PartyService(
      prisma as never,
      redis as never,
      leader as never,
      notifications as never,
    );
    service.registerEmitter(emitter);
  });

  // ==================== CREATE ====================
  describe('createParty (Spec 8.7.1 rate limit + conflict)', () => {
    const dto = {
      name: 'Bogazici Nightride',
      isPrivate: false,
      maxMembers: 20,
      coLeaderIds: [],
    };

    it('blocks when user is already in an active party (Spec 2.4.2)', async () => {
      prisma.partyMember.findFirst.mockResolvedValueOnce({ partyId: 'p-old', role: 'MEMBER' });
      await expect(service.createParty('u1', dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('blocks when create quota exceeded (Spec 8.7.1 - 5/hour)', async () => {
      redis.incrementActionCount.mockResolvedValueOnce(6);
      await expect(service.createParty('u1', dto)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates party, persists member=LEADER and seeds Redis keys', async () => {
      const now = new Date('2026-04-20T12:00:00Z');
      prisma.partyMember.findFirst.mockResolvedValueOnce(null);
      prisma.party.create.mockResolvedValueOnce({
        id: 'p1',
        name: dto.name,
        leaderId: 'u1',
        coLeaderIds: [],
        status: 'WAITING',
        routeId: null,
        isPrivate: false,
        maxMembers: 20,
        startedAt: null,
        endedAt: null,
        createdAt: now,
      });
      prisma.partyMember.create.mockResolvedValueOnce({ userId: 'u1' });

      const capturedPipelines: PipelineMock[] = [];
      redis.raw.multi.mockImplementationOnce(() => {
        const p = createPipelineMock();
        capturedPipelines.push(p);
        return p;
      });

      const summary = await service.createParty('u1', dto);

      expect(summary.id).toBe('p1');
      expect(summary.leaderId).toBe('u1');
      expect(summary.status).toBe('WAITING');
      expect(prisma.partyMember.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ partyId: 'p1', userId: 'u1', role: 'LEADER' }),
      });
      const pl = capturedPipelines[0]!;
      expect(pl.sadd).toHaveBeenCalledWith('party:p1:members', 'u1');
      expect(pl.sadd).toHaveBeenCalledWith('parties:_active', 'p1');
      expect(pl.set).toHaveBeenCalledWith('user:u1:party', 'p1');
    });
  });

  // ==================== SIGNAL ====================
  describe('recordSignal (Spec 7.3.1 — NO DB WRITE)', () => {
    const type: PartySignalType = 'REGROUP';

    it('emits signal to WS and DOES NOT persist to DB', async () => {
      redis.raw.sismember.mockResolvedValueOnce(1);
      const result = await service.recordSignal('p1', 'u1', type, 'Mike');

      expect(result.allowed).toBe(true);
      expect(emitter.emitSignal).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ type, senderId: 'u1', senderName: 'Mike' }),
      );

      // Spec 7.3.1 kritik assertion: Hicbir Prisma yazma cagrisi yapilmamali.
      expect(prisma.party.create).not.toHaveBeenCalled();
      expect(prisma.party.update).not.toHaveBeenCalled();
      expect(prisma.partyMember.create).not.toHaveBeenCalled();
      expect(prisma.partyMember.update).not.toHaveBeenCalled();
      expect(prisma.partyMember.updateMany).not.toHaveBeenCalled();
      expect(prisma.partyInvite.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('enforces rate limit (Spec 8.7.1 — 12/min) without emitting', async () => {
      redis.incrementActionCount.mockResolvedValueOnce(13);
      const result = await service.recordSignal('p1', 'u1', type, 'Mike');
      expect(result.allowed).toBe(false);
      expect(emitter.emitSignal).not.toHaveBeenCalled();
    });

    it('rejects non-members (server-side authorization)', async () => {
      redis.raw.sismember.mockResolvedValueOnce(0);
      await expect(service.recordSignal('p1', 'u-stranger', type, 'X')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(emitter.emitSignal).not.toHaveBeenCalled();
    });
  });

  // ==================== LEAVE + LEADER ELECTION ====================
  describe('leaveParty (Spec 4.1 + 8.2)', () => {
    const basePartyRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'p1',
      leaderId: 'u1',
      coLeaderIds: [],
      status: 'RIDING',
      deletedAt: null,
      members: [
        { userId: 'u1', role: 'LEADER', joinedAt: new Date('2026-04-01T10:00:00Z'), leftAt: null, isOnline: true },
        { userId: 'u2', role: 'MEMBER', joinedAt: new Date('2026-04-01T10:10:00Z'), leftAt: null, isOnline: true },
      ],
      ...overrides,
    });

    it('triggers leader election when the current leader leaves', async () => {
      prisma.party.findUnique.mockResolvedValueOnce(basePartyRow());
      prisma.partyMember.update.mockResolvedValue({ userId: 'u1' });
      leader.elect.mockResolvedValueOnce({
        newLeaderId: 'u2',
        locked: true,
        reason: 'oldest_member',
      });

      const result = await service.leaveParty('u1', 'p1');

      expect(result.newLeaderId).toBe('u2');
      expect(leader.elect).toHaveBeenCalled();
      expect(emitter.emitLeaderChanged).toHaveBeenCalledWith('p1', 'u2', 'LEADER_LEFT');
      expect(emitter.emitMemberLeft).toHaveBeenCalledWith('p1', 'u1', 'LEFT');
      expect(leader.release).toHaveBeenCalledWith('p1', 'u2');
    });

    it('ends party if the sole member (leader) leaves', async () => {
      prisma.party.findUnique.mockResolvedValueOnce(
        basePartyRow({ members: [{ userId: 'u1', role: 'LEADER', joinedAt: new Date(), leftAt: null, isOnline: true }] }),
      );
      // endParty icinde findUnique tekrar cagirir — ikinci cagri icin ENDED simulasyonu
      prisma.party.findUnique.mockResolvedValueOnce({ id: 'p1', status: 'RIDING' });
      prisma.partyMember.update.mockResolvedValue({ userId: 'u1' });

      const result = await service.leaveParty('u1', 'p1');

      expect(result.ended).toBe(true);
      expect(result.newLeaderId).toBeNull();
      expect(emitter.emitEnded).toHaveBeenCalledWith('p1', 'LEADER_LEFT_ALONE');
    });

    it('does NOT trigger election when a non-leader leaves', async () => {
      prisma.party.findUnique.mockResolvedValueOnce(basePartyRow());
      prisma.partyMember.update.mockResolvedValue({ userId: 'u2' });

      const result = await service.leaveParty('u2', 'p1');

      expect(result.newLeaderId).toBeNull();
      expect(leader.elect).not.toHaveBeenCalled();
      expect(emitter.emitLeaderChanged).not.toHaveBeenCalled();
      expect(emitter.emitMemberLeft).toHaveBeenCalledWith('p1', 'u2', 'LEFT');
    });

    it('rejects if user is not a member', async () => {
      prisma.party.findUnique.mockResolvedValueOnce(basePartyRow());
      await expect(service.leaveParty('stranger', 'p1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  // ==================== PRIVACY BYPASS (assert-only, Spec 5.1) ====================
  describe('privacy bypass for party members (Spec 5.1)', () => {
    it('uses Redis set membership (party:{id}:members) as server-side auth source', async () => {
      // Spec 5.1 - Party uyeleri birbirini gorur; yetki kontrolu Redis SISMEMBER.
      redis.raw.sismember.mockResolvedValueOnce(1);
      await service.recordSignal('p1', 'u1', 'STOP', 'Mike');
      expect(redis.raw.sismember).toHaveBeenCalledWith('party:p1:members', 'u1');
    });
  });
});
