import { computeLocationIntervalMs } from './useThermalFrequency';

// Spec 7.1.2 - Normal=3sn, Fair=5sn, Serious=8sn, Critical=10sn, sharing=off=0

describe('computeLocationIntervalMs (Spec 7.1.2)', () => {
  it('returns 0 when sharing disabled', () => {
    expect(computeLocationIntervalMs('NORMAL', false)).toBe(0);
    expect(computeLocationIntervalMs('CRITICAL', false)).toBe(0);
  });

  it('returns 3s on NORMAL thermal state', () => {
    expect(computeLocationIntervalMs('NORMAL', true)).toBe(3_000);
  });

  it('bumps to 5s on FAIR', () => {
    expect(computeLocationIntervalMs('FAIR', true)).toBe(5_000);
  });

  it('bumps to 8-10s range under thermal warning (Spec 7.1.2)', () => {
    expect(computeLocationIntervalMs('SERIOUS', true)).toBe(8_000);
    expect(computeLocationIntervalMs('CRITICAL', true)).toBe(10_000);
  });
});
