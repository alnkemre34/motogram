import { LeaderElectionService, type PartyMemberLite } from './leader-election.service';

// Spec 8.2.2 - Lider secimi testleri:
// - Deterministik secim: coLeader -> joinedAt -> userId hash
// - Race condition: Redis NX EX 5 — sadece bir instance kilidi alabilir

interface RedisMock {
  raw: {
    set: jest.Mock;
    eval: jest.Mock;
  };
}

function createRedisMock(): RedisMock {
  return {
    raw: {
      set: jest.fn(),
      eval: jest.fn(),
    },
  };
}

const baseMember = (
  userId: string,
  joinedAt: Date,
  opts: Partial<PartyMemberLite> = {},
): PartyMemberLite => ({
  userId,
  joinedAt,
  leftAt: null,
  isOnline: true,
  ...opts,
});

describe('LeaderElectionService (Spec 8.2.2)', () => {
  let redis: RedisMock;
  let service: LeaderElectionService;

  beforeEach(() => {
    redis = createRedisMock();
    service = new LeaderElectionService({ raw: redis.raw } as never);
  });

  // ===== pickNextLeader (pure) =====
  describe('pickNextLeader', () => {
    it('prefers a co-leader when one is online', () => {
      const pick = service.pickNextLeader({
        partyId: 'p1',
        coLeaderIds: ['co1', 'co2'],
        onlineMembers: [
          baseMember('m1', new Date('2026-04-01T10:00:00Z')),
          baseMember('co2', new Date('2026-04-01T10:05:00Z')),
          baseMember('co1', new Date('2026-04-01T10:10:00Z')),
        ],
      });
      expect(pick).toEqual({ userId: 'co1', reason: 'co_leader' });
    });

    it('skips co-leaders not in online list', () => {
      const pick = service.pickNextLeader({
        partyId: 'p1',
        coLeaderIds: ['co1'],
        onlineMembers: [baseMember('m1', new Date('2026-04-01T10:00:00Z'))],
      });
      expect(pick.userId).toBe('m1');
      expect(pick.reason).toBe('oldest_member');
    });

    it('falls back to oldest joinedAt among onlineMembers', () => {
      const pick = service.pickNextLeader({
        partyId: 'p1',
        coLeaderIds: [],
        onlineMembers: [
          baseMember('late', new Date('2026-04-01T12:00:00Z')),
          baseMember('early', new Date('2026-04-01T10:00:00Z')),
          baseMember('mid', new Date('2026-04-01T11:00:00Z')),
        ],
      });
      expect(pick).toEqual({ userId: 'early', reason: 'oldest_member' });
    });

    it('is deterministic on joinedAt tie (userId lex asc)', () => {
      const sameTime = new Date('2026-04-01T10:00:00Z');
      const pick = service.pickNextLeader({
        partyId: 'p1',
        coLeaderIds: [],
        onlineMembers: [
          baseMember('zeta', sameTime),
          baseMember('alpha', sameTime),
          baseMember('mike', sameTime),
        ],
      });
      expect(pick.userId).toBe('alpha');
    });

    it('returns no_candidates when onlineMembers is empty', () => {
      const pick = service.pickNextLeader({
        partyId: 'p1',
        coLeaderIds: ['co1'],
        onlineMembers: [],
      });
      expect(pick).toEqual({ userId: null, reason: 'no_candidates' });
    });
  });

  // ===== elect (race condition) =====
  describe('elect (distributed lock)', () => {
    it('returns newLeaderId with locked=true when NX lock acquired', async () => {
      redis.raw.set.mockResolvedValueOnce('OK');
      const result = await service.elect({
        partyId: 'p1',
        coLeaderIds: [],
        onlineMembers: [baseMember('m1', new Date('2026-04-01T10:00:00Z'))],
      });

      expect(result.newLeaderId).toBe('m1');
      expect(result.locked).toBe(true);
      expect(result.reason).toBe('oldest_member');
      expect(redis.raw.set).toHaveBeenCalledWith(
        'party:p1:leader_lock',
        'm1',
        'EX',
        5,
        'NX',
      );
    });

    it('returns lock_failed when Redis NX returns null (race lost)', async () => {
      // Spec 8.2.2 - ayni anda baska instance kilidi almis
      redis.raw.set.mockResolvedValueOnce(null);
      const result = await service.elect({
        partyId: 'p1',
        coLeaderIds: [],
        onlineMembers: [baseMember('m1', new Date('2026-04-01T10:00:00Z'))],
      });

      expect(result.locked).toBe(false);
      expect(result.newLeaderId).toBeNull();
      expect(result.reason).toBe('lock_failed');
    });

    it('serialises concurrent election attempts — only one wins', async () => {
      // Simule edilmis race: 3 instance ayni anda elect() cagiriyor,
      // Redis.set ilkinde OK, sonrakilerde null dondurur.
      let lockHolder: string | null = null;
      redis.raw.set.mockImplementation(async (_key: string, value: string) => {
        if (lockHolder) return null;
        lockHolder = value;
        return 'OK';
      });

      const members = [
        baseMember('m1', new Date('2026-04-01T10:00:00Z')),
        baseMember('m2', new Date('2026-04-01T10:01:00Z')),
        baseMember('m3', new Date('2026-04-01T10:02:00Z')),
      ];
      const input = { partyId: 'p1', coLeaderIds: [], onlineMembers: members };
      const results = await Promise.all([
        service.elect(input),
        service.elect(input),
        service.elect(input),
      ]);

      const winners = results.filter((r) => r.locked);
      const losers = results.filter((r) => !r.locked);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(2);
      expect(winners[0]!.newLeaderId).toBe('m1');
      losers.forEach((l) => expect(l.reason).toBe('lock_failed'));
    });

    it('does not call Redis when there are no candidates', async () => {
      const result = await service.elect({
        partyId: 'p1',
        coLeaderIds: [],
        onlineMembers: [],
      });
      expect(result.newLeaderId).toBeNull();
      expect(result.reason).toBe('no_candidates');
      expect(redis.raw.set).not.toHaveBeenCalled();
    });
  });

  // ===== release (Lua CAS) =====
  describe('release', () => {
    it('returns true when the Lua CAS script deletes the key', async () => {
      redis.raw.eval.mockResolvedValueOnce(1);
      const released = await service.release('p1', 'm1');
      expect(released).toBe(true);
      expect(redis.raw.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("GET"'),
        1,
        'party:p1:leader_lock',
        'm1',
      );
    });

    it('returns false when value no longer matches', async () => {
      redis.raw.eval.mockResolvedValueOnce(0);
      const released = await service.release('p1', 'm1');
      expect(released).toBe(false);
    });
  });
});
