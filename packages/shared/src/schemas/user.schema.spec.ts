import {
  ChangeUsernameSchema,
  isReservedUsername,
  normalizeUsernameForStorage,
} from './user.schema';

describe('normalizeUsernameForStorage (B-06)', () => {
  it('trims and lowercases', () => {
    expect(normalizeUsernameForStorage('  Alice_01  ')).toBe('alice_01');
  });
});

describe('isReservedUsername (B-06)', () => {
  it('flags reserved and motogram prefix', () => {
    expect(isReservedUsername('admin')).toBe(true);
    expect(isReservedUsername('MOTOGRAM')).toBe(true);
    expect(isReservedUsername('motogram_helper')).toBe(true);
    expect(isReservedUsername('valid_rider_1')).toBe(false);
  });
});

describe('ChangeUsernameSchema (B-06)', () => {
  it('accepts valid username', () => {
    expect(ChangeUsernameSchema.safeParse({ username: 'good_name' }).success).toBe(true);
  });

  it('rejects short username', () => {
    expect(ChangeUsernameSchema.safeParse({ username: 'ab' }).success).toBe(false);
  });
});
