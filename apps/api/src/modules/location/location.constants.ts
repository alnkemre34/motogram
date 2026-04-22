// Spec 3.3.1 - Redis anahtar isimleri (sabit)
// Spec 8.3.2 - Sehir bazli sharding: user_locations:{city} -> fallback :global

export const REDIS_KEYS = {
  userStatus: (userId: string) => `user:${userId}:status`,
  userPing: (userId: string) => `user:${userId}:ping`,
  partyMembers: (partyId: string) => `party:${partyId}:members`,
  userLocationShard: (city?: string | null) => {
    const key = city?.trim().toLowerCase();
    return key ? `user_locations:${key}` : 'user_locations:global';
  },
  userLocationShardIndex: () => 'user_locations:_shards', // aktif shard listesi (SADD)
} as const;

// Spec 3.3.1 - TTL tablosu
export const TTL = {
  userStatus: 60,       // s - Hash
  userPing: 30,         // s - String
  zombieThreshold: 300, // s (5dk) - ZREM esigi (Spec 5.2 + 7.3.3)
} as const;

// Spec 5.3 - Performans butcesi hedefi
export const PERF_BUDGET = {
  georadiusMs: 15,           // < 15ms hedef
  locationUpdateMs: 50,      // < 50ms hedef
} as const;

// Spec 7.3.5 - Rate limit
export const RATE_LIMITS = {
  locationPingPerSecond: 1, // saniyede 1'den fazla = IP ban
} as const;
