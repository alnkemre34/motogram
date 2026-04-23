import { getConversationsListPath } from './messaging-path';

describe('getConversationsListPath', () => {
  it('omits query when no type', () => {
    expect(getConversationsListPath()).toBe('/conversations');
  });

  it('adds type query for each ConversationType', () => {
    expect(getConversationsListPath({ type: 'DIRECT' })).toBe('/conversations?type=DIRECT');
    expect(getConversationsListPath({ type: 'GROUP_CHAT' })).toBe('/conversations?type=GROUP_CHAT');
    expect(getConversationsListPath({ type: 'COMMUNITY_CHAT' })).toBe('/conversations?type=COMMUNITY_CHAT');
  });
});
