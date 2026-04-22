// Spec 8.11.1 - FeatureFlagService unit testleri.
// Redis raw komutlari bir in-memory mock ile test edilir.
import { FeatureFlagService } from './feature-flag.service';

class FakeRedis {
  private hashes = new Map<string, Record<string, string>>();
  raw = {
    hset: async (key: string, payload: Record<string, string>) => {
      const existing = this.hashes.get(key) ?? {};
      this.hashes.set(key, { ...existing, ...payload });
      return Object.keys(payload).length;
    },
    hgetall: async (key: string) => this.hashes.get(key) ?? {},
    del: async (key: string) => (this.hashes.delete(key) ? 1 : 0),
    keys: async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      return [...this.hashes.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

describe('FeatureFlagService', () => {
  let svc: FeatureFlagService;
  let redis: FakeRedis;

  beforeEach(() => {
    redis = new FakeRedis();
    svc = new FeatureFlagService(redis as never);
  });

  it('upsert + readValue OFF strategy', async () => {
    await svc.upsert({ key: 'test_flag', strategy: 'OFF' });
    const value = await svc.readValue('test_flag');
    expect(value?.strategy).toBe('OFF');
  });

  it('evaluate OFF returns enabled=false', async () => {
    await svc.upsert({ key: 'flag_off', strategy: 'OFF' });
    const e = await svc.evaluate('flag_off', 'u1');
    expect(e.enabled).toBe(false);
  });

  it('evaluate ON returns enabled=true', async () => {
    await svc.upsert({ key: 'flag_on', strategy: 'ON' });
    const e = await svc.evaluate('flag_on', 'u1');
    expect(e.enabled).toBe(true);
  });

  it('evaluate USER_LIST respects whitelist', async () => {
    await svc.upsert({
      key: 'flag_ul',
      strategy: 'USER_LIST',
      userIds: ['11111111-1111-1111-1111-111111111111'],
    });
    const inList = await svc.evaluate('flag_ul', '11111111-1111-1111-1111-111111111111');
    const outOfList = await svc.evaluate('flag_ul', '22222222-2222-2222-2222-222222222222');
    expect(inList.enabled).toBe(true);
    expect(outOfList.enabled).toBe(false);
  });

  it('evaluate PERCENTAGE is deterministic for same userId', async () => {
    await svc.upsert({ key: 'flag_pct', strategy: 'PERCENTAGE', percentage: 50 });
    const uid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const first = await svc.evaluate('flag_pct', uid);
    const second = await svc.evaluate('flag_pct', uid);
    expect(first.enabled).toBe(second.enabled);
  });

  it('evaluate PERCENTAGE roughly matches target distribution', async () => {
    await svc.upsert({ key: 'flag_pct2', strategy: 'PERCENTAGE', percentage: 30 });
    let enabledCount = 0;
    const total = 1000;
    for (let i = 0; i < total; i++) {
      const uid = `test-user-${i.toString().padStart(12, '0')}-0000-0000-0000-000000000000`;
      const e = await svc.evaluate('flag_pct2', uid);
      if (e.enabled) enabledCount++;
    }
    const ratio = enabledCount / total;
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.4);
  });

  it('evaluate returns flag_not_found for undefined flag (safe default false)', async () => {
    const e = await svc.evaluate('unknown_flag', 'u1');
    expect(e.enabled).toBe(false);
    expect(e.reason).toBe('flag_not_found');
  });

  it('delete removes the flag', async () => {
    await svc.upsert({ key: 'temp', strategy: 'ON' });
    await svc.delete('temp');
    const e = await svc.evaluate('temp');
    expect(e.reason).toBe('flag_not_found');
  });

  it('list returns all flags sorted', async () => {
    await svc.upsert({ key: 'b_flag', strategy: 'ON' });
    await svc.upsert({ key: 'a_flag', strategy: 'OFF' });
    const list = await svc.list();
    expect(list.map((f) => f.key)).toEqual(['a_flag', 'b_flag']);
  });

  it('hashBucket is deterministic', () => {
    const a = FeatureFlagService.hashBucket('flag', 'user-1');
    const b = FeatureFlagService.hashBucket('flag', 'user-1');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
  });
});
