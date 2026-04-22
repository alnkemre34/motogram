import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { PARTY_REDIS_KEYS, PARTY_TTL } from './party.constants';

// Spec 8.2 - Deterministik + race-condition korumali lider secimi.
//
// Kilit mekanizmasi: SET party:{partyId}:leader_lock <newLeaderId> NX EX 5
// Eger NX basarisizsa: "Leader election already in progress" - race atlanmis.
//
// Onceleme zinciri (Spec 8.2.2):
//   1. coLeaderIds listesindeki ilk aktif uye
//   2. joinedAt'e gore en eski aktif uye
//   3. Hic yoksa, userId hash'i ile deterministik (aslinda bu case'de secim yok)

export interface PartyMemberLite {
  userId: string;
  joinedAt: Date;
  leftAt: Date | null;
  isOnline: boolean;
}

export interface ElectionInput {
  partyId: string;
  coLeaderIds: string[];
  onlineMembers: PartyMemberLite[]; // leaderId haric, ayrilan haric - caller filtreler
}

export interface ElectionResult {
  newLeaderId: string | null;
  locked: boolean;
  reason: 'co_leader' | 'oldest_member' | 'hash_fallback' | 'no_candidates' | 'lock_failed';
}

@Injectable()
export class LeaderElectionService {
  private readonly logger = new Logger(LeaderElectionService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Spec 8.2.2 - Deterministik secim (saf fonksiyon, redis'e degmez).
   * Test edilebilmesi icin public + static degil, injectable ama side-effect'siz.
   */
  pickNextLeader(input: ElectionInput): { userId: string | null; reason: ElectionResult['reason'] } {
    const { coLeaderIds, onlineMembers } = input;
    if (onlineMembers.length === 0) {
      return { userId: null, reason: 'no_candidates' };
    }
    const onlineSet = new Set(onlineMembers.map((m) => m.userId));

    // 1. coLeaderIds sirasiyla kontrol
    for (const coLeader of coLeaderIds) {
      if (onlineSet.has(coLeader)) {
        return { userId: coLeader, reason: 'co_leader' };
      }
    }

    // 2. joinedAt'e gore en eski aktif uye
    const sorted = [...onlineMembers].sort((a, b) => {
      const diff = a.joinedAt.getTime() - b.joinedAt.getTime();
      if (diff !== 0) return diff;
      // tie-break: userId hash (asc) -> deterministic
      return a.userId < b.userId ? -1 : 1;
    });
    const oldest = sorted[0]!;
    return { userId: oldest.userId, reason: 'oldest_member' };
  }

  /**
   * Spec 8.2.2 - Dagitik kilit ile lider secimi.
   * Redis SET NX EX 5 - ayni anda sadece BIR instance kilidi alabilir.
   */
  async elect(input: ElectionInput): Promise<ElectionResult> {
    const { partyId } = input;
    const pick = this.pickNextLeader(input);
    if (!pick.userId) {
      return { newLeaderId: null, locked: false, reason: pick.reason };
    }

    const lockKey = PARTY_REDIS_KEYS.leaderLock(partyId);
    // NX EX - eger kilit baskasi tarafindan alinmissa false doner.
    const locked = await this.redis.raw.set(
      lockKey,
      pick.userId,
      'EX',
      PARTY_TTL.leaderLockSeconds,
      'NX',
    );

    if (locked !== 'OK') {
      this.logger.warn(`leader_election_race partyId=${partyId} skipped`);
      return { newLeaderId: null, locked: false, reason: 'lock_failed' };
    }

    return { newLeaderId: pick.userId, locked: true, reason: pick.reason };
  }

  /**
   * Secim + DB guncellemesi tamamlandiktan sonra kilidi salmak (idempotent).
   * TTL 5sn oldugu icin kilit zaten kendiligindek duser; bu yardimci erken
   * serbest birakma icin kullanilir.
   */
  async release(partyId: string, expectedLeaderId: string): Promise<boolean> {
    // Lua: sadece value eslesirse sil (safety)
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    const result = (await this.redis.raw.eval(
      script,
      1,
      PARTY_REDIS_KEYS.leaderLock(partyId),
      expectedLeaderId,
    )) as number;
    return result === 1;
  }
}
