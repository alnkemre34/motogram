import { WS_EVENTS } from '@motogram/shared';

import { LocationGateway } from './location.gateway';

/** WS payload semalari uuid bekledigi icin gercekci bir kullanici id'si */
const TEST_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TEST_PEER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// Spec 3.5 + 5.1 - Socket.IO gateway handler testleri (Socket.IO mock).
// Tam sunucu integration'u degil: handler method'larini izole test et.

interface SocketMock {
  id: string;
  data: { userId?: string; username?: string };
  emit: jest.Mock;
  join: jest.Mock;
  leave: jest.Mock;
  disconnect: jest.Mock;
}

function createSocket(
  userId = TEST_USER_ID,
  username = 'mike',
  id = 'sid-1',
): SocketMock {
  return {
    id,
    data: { userId, username },
    emit: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  };
}

interface ServerMock {
  to: jest.Mock;
  except: jest.Mock;
  emit: jest.Mock;
}

function createServer(): ServerMock {
  const server: ServerMock = {
    to: jest.fn(),
    except: jest.fn(),
    emit: jest.fn(),
  };
  server.to.mockImplementation(() => ({
    except: server.except.mockImplementation(() => ({ emit: server.emit })),
    emit: server.emit,
  }));
  return server;
}

interface Deps {
  tokens: { verifyAccess: jest.Mock };
  prisma: {
    partyMember: { findUnique: jest.Mock; update: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  location: { updateLocation: jest.Mock };
  party: {
    leaveParty: jest.Mock;
    recordSignal: jest.Mock;
    clearOfflineMark: jest.Mock;
    markOffline: jest.Mock;
    registerEmitter: jest.Mock;
  };
  redis: {
    sismember: jest.Mock;
    sadd: jest.Mock;
    hset: jest.Mock;
    get: jest.Mock;
  };
  config: { get: jest.Mock };
  metrics: {
    wsConnectionsActive: { inc: jest.Mock; dec: jest.Mock };
    wsDisconnections: { inc: jest.Mock };
    wsMessageLatency: { observe: jest.Mock };
    zodResponseMismatch: { inc: jest.Mock };
  };
}

function createDeps(): Deps {
  return {
    tokens: { verifyAccess: jest.fn() },
    prisma: {
      partyMember: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ partyId: '', userId: '', serverHostname: 'test' }),
      },
      user: { findUnique: jest.fn() },
    },
    location: { updateLocation: jest.fn() },
    party: {
      leaveParty: jest.fn().mockResolvedValue({ ended: false, newLeaderId: null }),
      recordSignal: jest.fn().mockResolvedValue({ allowed: true, count: 1 }),
      clearOfflineMark: jest.fn().mockResolvedValue(undefined),
      markOffline: jest.fn().mockResolvedValue(undefined),
      registerEmitter: jest.fn(),
    },
    redis: {
      sismember: jest.fn().mockResolvedValue(1),
      sadd: jest.fn().mockResolvedValue(1),
      hset: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
    },
    config: { get: jest.fn().mockReturnValue('1') },
    metrics: {
      wsConnectionsActive: { inc: jest.fn(), dec: jest.fn() },
      wsDisconnections: { inc: jest.fn() },
      wsMessageLatency: { observe: jest.fn() },
      zodResponseMismatch: { inc: jest.fn() },
    },
  };
}

function buildGateway(deps: Deps, server: ServerMock): LocationGateway {
  const gateway = new LocationGateway(
    deps.tokens as never,
    deps.prisma as never,
    deps.location as never,
    deps.party as never,
    deps.redis as never,
    deps.config as never,
    deps.metrics as never,
  );
  gateway.server = server as never;
  return gateway;
}

const VALID_PARTY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PARTY_ID = '22222222-2222-4222-8222-222222222222';

describe('LocationGateway handlers (Spec 3.5 + 5.1)', () => {
  let deps: Deps;
  let server: ServerMock;
  let gw: LocationGateway;

  beforeEach(() => {
    deps = createDeps();
    server = createServer();
    gw = buildGateway(deps, server);
  });

  // ============== party:join ==============
  describe('handlePartyJoin', () => {
    it('rejects invalid payloads (Zod validation)', async () => {
      const socket = createSocket();
      const res = await gw.handlePartyJoin(socket as never, { nope: true });
      expect(res.ok).toBe(false);
      expect(socket.emit).toHaveBeenCalledWith(
        WS_EVENTS.partyError,
        expect.objectContaining({ event: WS_EVENTS.partyJoin, code: 'VALIDATION' }),
      );
    });

    it('rejects non-members', async () => {
      deps.prisma.partyMember.findUnique.mockResolvedValueOnce(null);
      const socket = createSocket();
      const res = await gw.handlePartyJoin(socket as never, { partyId: VALID_PARTY_ID });
      expect(res.ok).toBe(false);
      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        WS_EVENTS.partyError,
        expect.objectContaining({ event: WS_EVENTS.partyJoin, code: 'NOT_MEMBER' }),
      );
    });

    it('joins room, clears offline mark and re-seeds membership set', async () => {
      deps.prisma.partyMember.findUnique.mockResolvedValueOnce({ userId: TEST_USER_ID, leftAt: null });
      const socket = createSocket();
      const res = await gw.handlePartyJoin(socket as never, { partyId: VALID_PARTY_ID });

      expect(res.ok).toBe(true);
      expect(socket.join).toHaveBeenCalledWith(`party:${VALID_PARTY_ID}`);
      expect(deps.party.clearOfflineMark).toHaveBeenCalledWith(TEST_USER_ID, VALID_PARTY_ID);
      expect(deps.prisma.partyMember.update).toHaveBeenCalled();
      expect(deps.redis.sadd).toHaveBeenCalledWith(`party:${VALID_PARTY_ID}:members`, TEST_USER_ID);
    });
  });

  // ============== party:leave ==============
  describe('handlePartyLeave', () => {
    it('calls PartyService.leaveParty and leaves the room', async () => {
      deps.party.leaveParty.mockResolvedValueOnce({ ended: false, newLeaderId: 'u2' });
      const socket = createSocket();
      const res = await gw.handlePartyLeave(socket as never, { partyId: VALID_PARTY_ID });

      expect(res).toEqual({ ok: true, ended: false });
      expect(deps.party.leaveParty).toHaveBeenCalledWith(TEST_USER_ID, VALID_PARTY_ID, 'LEFT');
      expect(socket.leave).toHaveBeenCalledWith(`party:${VALID_PARTY_ID}`);
    });

    it('surfaces service errors via party:error', async () => {
      deps.party.leaveParty.mockRejectedValueOnce(new Error('boom'));
      const socket = createSocket();
      const res = await gw.handlePartyLeave(socket as never, { partyId: VALID_PARTY_ID });
      expect(res.ok).toBe(false);
      expect(socket.emit).toHaveBeenCalledWith(
        WS_EVENTS.partyError,
        expect.objectContaining({ event: WS_EVENTS.partyLeave, code: 'FAIL' }),
      );
    });
  });

  // ============== party:update_location ==============
  describe('handlePartyUpdateLocation (Spec 5.1 privacy bypass)', () => {
    const validPayload = {
      partyId: VALID_PARTY_ID,
      lat: 41.01,
      lng: 29.0,
      heading: 180,
      speed: 45,
      accuracy: 6,
      clientTimestamp: Date.now(),
    };

    it('rejects when user is not in the membership set (Redis SISMEMBER)', async () => {
      deps.redis.sismember.mockResolvedValueOnce(0);
      const socket = createSocket();
      const res = await gw.handlePartyUpdateLocation(socket as never, validPayload);
      expect(res.ok).toBe(false);
      expect(deps.location.updateLocation).not.toHaveBeenCalled();
    });

    it('writes with source=PARTY and broadcasts member_updated except sender', async () => {
      deps.redis.sismember.mockResolvedValueOnce(1);
      deps.prisma.user.findUnique.mockResolvedValueOnce({
        city: 'istanbul',
        locationSharing: 'OFF', // Spec 5.1 - sharing OFF olsa bile parti uyeleri goruyor (bypass)
        isBanned: false,
      });
      const socket = createSocket();
      const res = await gw.handlePartyUpdateLocation(socket as never, validPayload);

      expect(res.ok).toBe(true);
      expect(deps.location.updateLocation).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          partyId: VALID_PARTY_ID,
          source: 'PARTY',
          lat: 41.01,
          lng: 29.0,
        }),
        expect.objectContaining({ locationSharing: 'OFF' }),
      );
      expect(server.to).toHaveBeenCalledWith(`party:${VALID_PARTY_ID}`);
      expect(server.except).toHaveBeenCalledWith(socket.id);
      expect(server.emit).toHaveBeenCalledWith(
        WS_EVENTS.partyMemberUpdated,
        expect.objectContaining({
          partyId: VALID_PARTY_ID,
          userId: TEST_USER_ID,
          lat: 41.01,
          lng: 29.0,
        }),
      );
    });

    it('aborts when user is banned', async () => {
      deps.redis.sismember.mockResolvedValueOnce(1);
      deps.prisma.user.findUnique.mockResolvedValueOnce({
        city: 'istanbul',
        locationSharing: 'PUBLIC',
        isBanned: true,
      });
      const socket = createSocket();
      const res = await gw.handlePartyUpdateLocation(socket as never, validPayload);
      expect(res.ok).toBe(false);
      expect(deps.location.updateLocation).not.toHaveBeenCalled();
    });
  });

  // ============== party:send_signal ==============
  describe('handleSendSignal (Spec 7.3.1 — NO DB WRITE)', () => {
    const payload = {
      partyId: VALID_PARTY_ID,
      type: 'REGROUP' as const,
      clientTimestamp: Date.now(),
    };

    it('delegates to PartyService.recordSignal (DB write is service-level forbidden)', async () => {
      const socket = createSocket();
      const res = await gw.handleSendSignal(socket as never, payload);

      expect(res.ok).toBe(true);
      expect(deps.party.recordSignal).toHaveBeenCalledWith(
        VALID_PARTY_ID,
        TEST_USER_ID,
        'REGROUP',
        'mike',
      );
    });

    it('emits party:error with rate_limited when allowed=false', async () => {
      deps.party.recordSignal.mockResolvedValueOnce({ allowed: false, count: 13 });
      const socket = createSocket();
      const res = await gw.handleSendSignal(socket as never, payload);
      expect(res.ok).toBe(false);
      expect(res.rateLimited).toBe(true);
      expect(socket.emit).toHaveBeenCalledWith(
        WS_EVENTS.partyError,
        expect.objectContaining({ message: 'rate_limited' }),
      );
    });

    it('ignores payload for a different party (validation passes; service decides)', async () => {
      const socket = createSocket();
      await gw.handleSendSignal(socket as never, {
        ...payload,
        partyId: OTHER_PARTY_ID,
      });
      expect(deps.party.recordSignal).toHaveBeenCalledWith(
        OTHER_PARTY_ID,
        TEST_USER_ID,
        'REGROUP',
        'mike',
      );
    });
  });

  // ============== connection lifecycle ==============
  describe('handleConnection / handleDisconnect', () => {
    it('joins user:{id} room on connect', () => {
      const socket = createSocket('user-xyz');
      gw.handleConnection(socket as never);
      expect(socket.join).toHaveBeenCalledWith('user:user-xyz');
    });

    it('disconnects socket with no userId', () => {
      const socket = createSocket();
      socket.data.userId = undefined;
      gw.handleConnection(socket as never);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('marks user offline in party on disconnect (Spec 7.3.3)', async () => {
      deps.redis.get.mockResolvedValueOnce(VALID_PARTY_ID);
      const socket = createSocket('user-xyz');
      await gw.handleDisconnect(socket as never);
      expect(deps.party.markOffline).toHaveBeenCalledWith('user-xyz', VALID_PARTY_ID);
      expect(deps.redis.hset).toHaveBeenCalledWith(
        'user:user-xyz:status',
        'online',
        'false',
      );
    });
  });

  // ============== PartyEmitter contract (room-targeted broadcast) ==============
  describe('PartyEmitter (room scoping)', () => {
    it('emits party:signal_received only to party room (Spec 7.3.1)', () => {
      gw.emitSignal(VALID_PARTY_ID, {
        type: 'STOP',
        senderId: TEST_USER_ID,
        senderName: 'mike',
        timestamp: 123,
      });
      expect(server.to).toHaveBeenCalledWith(`party:${VALID_PARTY_ID}`);
      expect(server.emit).toHaveBeenCalledWith(
        WS_EVENTS.partySignalReceived,
        expect.objectContaining({ partyId: VALID_PARTY_ID, type: 'STOP' }),
      );
    });

    it('emits party:leader_changed with newLeaderId', () => {
      gw.emitLeaderChanged(VALID_PARTY_ID, TEST_PEER_ID, 'LEADER_LEFT');
      expect(server.to).toHaveBeenCalledWith(`party:${VALID_PARTY_ID}`);
      expect(server.emit).toHaveBeenCalledWith(
        WS_EVENTS.partyLeaderChanged,
        expect.objectContaining({ newLeaderId: TEST_PEER_ID, reason: 'LEADER_LEFT' }),
      );
    });

    it('emits party:ended when party ends', () => {
      gw.emitEnded(VALID_PARTY_ID, 'LEADER_LEFT_ALONE');
      expect(server.emit).toHaveBeenCalledWith(
        WS_EVENTS.partyEnded,
        expect.objectContaining({ partyId: VALID_PARTY_ID, reason: 'LEADER_LEFT_ALONE' }),
      );
    });
  });
});
