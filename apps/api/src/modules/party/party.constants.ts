// Spec 3.3.1 + 3.5 + 4.1 + 8.2 - Party icin Redis anahtarlari + sabitler.

export const PARTY_REDIS_KEYS = {
  members: (partyId: string) => `party:${partyId}:members`,
  meta: (partyId: string) => `party:${partyId}:meta`,
  leaderLock: (partyId: string) => `party:${partyId}:leader_lock`,
  electionLock: (partyId: string) => `party:${partyId}:election_lock`,
  activePartyIndex: () => 'parties:_active', // SADD - gozlem icin
  signalRate: (userId: string) => `rate:party_signal:${userId}`,
  userParty: (userId: string) => `user:${userId}:party`,
  zombieWatch: (partyId: string) => `party:${partyId}:zombie`, // ZSET partyId -> userId,lastSeen
} as const;

// Spec 8.2.2 + 7.3.3 + 4.1 - TTL ve esikler
export const PARTY_TTL = {
  leaderLockSeconds: 5,             // Spec 8.2 NX EX 5
  electionLockSeconds: 5,
  zombieOfflineSeconds: 60,         // Spec 7.3.3 - 60sn offline -> member_left
  signalRatePerMinute: 12,          // anti-spam (urun karari)
  endedGraceMs: 60 * 60 * 1000,     // Spec 4.1 - ENDED 1 saat sonra soft delete
} as const;

// Spec 8.7.1 - Parti olusturma saatte 5
export const PARTY_CREATE_LIMIT = {
  perHour: 5,
  windowSeconds: 60 * 60,
} as const;
