import { formatDistanceMeters } from './p7-geo';

describe('formatDistanceMeters', () => {
  it('meters for short ranges', () => {
    expect(formatDistanceMeters(0)).toBe('0 m');
    expect(formatDistanceMeters(500)).toBe('500 m');
    expect(formatDistanceMeters(999)).toBe('999 m');
  });

  it('km for 1 km and above', () => {
    expect(formatDistanceMeters(1000)).toBe('1.0 km');
    expect(formatDistanceMeters(1500)).toBe('1.5 km');
  });

  it('non-finite', () => {
    expect(formatDistanceMeters(NaN)).toBe('—');
    expect(formatDistanceMeters(-1)).toBe('—');
  });
});
