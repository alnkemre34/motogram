import { canQueryCommunitySearch } from './discover-search';

describe('canQueryCommunitySearch', () => {
  it('is false for short or empty', () => {
    expect(canQueryCommunitySearch('')).toBe(false);
    expect(canQueryCommunitySearch('a')).toBe(false);
  });

  it('is true in 2..50 range', () => {
    expect(canQueryCommunitySearch('ab')).toBe(true);
    expect(canQueryCommunitySearch('  ab  ')).toBe(true);
  });

  it('is false over 50', () => {
    expect(canQueryCommunitySearch('x'.repeat(51))).toBe(false);
  });
});
