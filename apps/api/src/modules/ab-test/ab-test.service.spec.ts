// Spec 8.11.2 - AbTestService unit testleri.
// Redis komutlari in-memory mock ile test edilir.
import { NotFoundException } from '@nestjs/common';

import { AbTestService } from './ab-test.service';

class FakeRedis {
  private kv = new Map<string, string>();
  raw = {
    set: async (key: string, value: string) => {
      this.kv.set(key, value);
      return 'OK';
    },
    get: async (key: string) => this.kv.get(key) ?? null,
    del: async (...keys: string[]) => {
      let removed = 0;
      for (const k of keys) {
        if (this.kv.delete(k)) removed++;
      }
      return removed;
    },
    keys: async (pattern: string) => {
      const star = pattern.indexOf('*');
      if (star < 0) return this.kv.has(pattern) ? [pattern] : [];
      const prefix = pattern.slice(0, star);
      return [...this.kv.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

describe('AbTestService', () => {
  let svc: AbTestService;
  let redis: FakeRedis;

  beforeEach(() => {
    redis = new FakeRedis();
    svc = new AbTestService(redis as never);
  });

  it('upsert stores config and get returns same value', async () => {
    const stored = await svc.upsert({
      key: 'home_feed',
      enabled: true,
      variants: [
        { id: 'CONTROL', weight: 50 },
        { id: 'TREATMENT', weight: 50 },
      ],
    });
    expect(stored.key).toBe('home_feed');
    const got = await svc.get('home_feed');
    expect(got?.variants).toHaveLength(2);
  });

  it('assign is deterministic for same userId', async () => {
    await svc.upsert({
      key: 'det_test',
      enabled: true,
      variants: [
        { id: 'A', weight: 50 },
        { id: 'B', weight: 50 },
      ],
    });
    const uid = '11111111-1111-1111-1111-111111111111';
    const first = await svc.assign('det_test', uid);
    const second = await svc.assign('det_test', uid);
    expect(first).toBe(second);
  });

  it('assign distributes roughly by weight over many users', async () => {
    await svc.upsert({
      key: 'distr_test',
      enabled: true,
      variants: [
        { id: 'A', weight: 25 },
        { id: 'B', weight: 75 },
      ],
    });
    const counts: Record<string, number> = { A: 0, B: 0 };
    for (let i = 0; i < 1000; i++) {
      const uid = `00000000-0000-0000-0000-${i.toString().padStart(12, '0')}`;
      const v = await svc.assign('distr_test', uid);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    // Beklenen yaklasik 25/75; +-8 salinima izin ver.
    expect(counts.A).toBeGreaterThan(150);
    expect(counts.A).toBeLessThan(350);
    expect(counts.B).toBeGreaterThan(650);
  });

  it('assign returns first variant when test disabled', async () => {
    await svc.upsert({
      key: 'disabled_test',
      enabled: false,
      variants: [
        { id: 'CONTROL', weight: 50 },
        { id: 'TREATMENT', weight: 50 },
      ],
    });
    const uid = '22222222-2222-2222-2222-222222222222';
    const v = await svc.assign('disabled_test', uid);
    expect(v).toBe('CONTROL');
  });

  it('assign throws NotFound for missing test', async () => {
    await expect(svc.assign('missing_test', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delete wipes config and assignments', async () => {
    await svc.upsert({
      key: 'tmp',
      enabled: true,
      variants: [
        { id: 'A', weight: 50 },
        { id: 'B', weight: 50 },
      ],
    });
    const uid = '33333333-3333-3333-3333-333333333333';
    await svc.assign('tmp', uid);
    await svc.delete('tmp');
    const got = await svc.get('tmp');
    expect(got).toBeNull();
  });

  it('pickVariant static is pure and deterministic', () => {
    const config = {
      key: 'static_test',
      enabled: true,
      variants: [
        { id: 'A', weight: 40 },
        { id: 'B', weight: 60 },
      ],
    };
    const a = AbTestService.pickVariant(config, 'user-x');
    const b = AbTestService.pickVariant(config, 'user-x');
    expect(a).toBe(b);
    expect(['A', 'B']).toContain(a);
  });
});
