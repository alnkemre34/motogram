import { parseDeepLink } from './linking';

// Spec 3.5 - Deep link parsing.

describe('parseDeepLink', () => {
  it('parses post links', () => {
    expect(parseDeepLink('motogram://post/abc-123')).toEqual({
      type: 'POST',
      postId: 'abc-123',
    });
  });

  it('parses emergency alert links', () => {
    expect(parseDeepLink('motogram://emergency/alert-xyz')).toEqual({
      type: 'EMERGENCY',
      alertId: 'alert-xyz',
    });
  });

  it('parses party/profile/community/event links', () => {
    expect(parseDeepLink('motogram://party/p1')).toEqual({ type: 'PARTY', partyId: 'p1' });
    expect(parseDeepLink('motogram://profile/u1')).toEqual({ type: 'PROFILE', userId: 'u1' });
    expect(parseDeepLink('motogram://community/c1')).toEqual({
      type: 'COMMUNITY',
      communityId: 'c1',
    });
    expect(parseDeepLink('motogram://event/e1')).toEqual({ type: 'EVENT', eventId: 'e1' });
    expect(parseDeepLink('motogram://story/s1')).toEqual({ type: 'STORY', storyId: 's1' });
  });

  it('returns null for unknown paths and malformed urls', () => {
    expect(parseDeepLink('motogram://unknown/1')).toBeNull();
    expect(parseDeepLink('motogram://')).toBeNull();
    expect(parseDeepLink('not-a-url')).toBeNull();
  });
});
