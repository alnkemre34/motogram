import { parseRidingStyleCommas } from './riding-style';

describe('parseRidingStyleCommas', () => {
  it('splits on comma, semicolon, newline and trims, max 10', () => {
    expect(parseRidingStyleCommas('a, b ; c\nd')).toEqual(['a', 'b', 'c', 'd']);
    const long = Array.from({ length: 12 }, (_, i) => `s${i}`).join(',');
    expect(parseRidingStyleCommas(long).length).toBe(10);
  });

  it('returns empty for blank input', () => {
    expect(parseRidingStyleCommas('  ,  ')).toEqual([]);
  });
});
