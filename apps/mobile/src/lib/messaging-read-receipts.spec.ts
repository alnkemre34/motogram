import { isReadByAllPeers, getLastOwnMessageId } from './messaging-read-receipts';
import type { MessageWithPending } from './messaging-merge';

const base = (over: Partial<MessageWithPending> & { id: string }): MessageWithPending => ({
  id: over.id,
  conversationId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  senderId: over.senderId ?? 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  content: 'hi',
  mediaUrls: [],
  messageType: 'TEXT',
  inviteData: null,
  isDeleted: over.isDeleted ?? false,
  createdAt: over.createdAt ?? '2020-01-01T00:00:00.000Z',
  reactions: [],
  clientId: over.clientId,
  _pending: over._pending,
  _failed: over._failed,
});

describe('messaging-read-receipts', () => {
  const me = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const peer = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  it('getLastOwnMessageId ignores pending and takes last own', () => {
    const list: MessageWithPending[] = [
      base({ id: '1', senderId: peer, createdAt: '2020-01-01T00:00:00.000Z' }),
      base({ id: '2', senderId: me, _pending: true, createdAt: '2020-01-01T00:00:01.000Z' }),
      base({ id: '3', senderId: me, createdAt: '2020-01-01T00:00:02.000Z' }),
    ];
    expect(getLastOwnMessageId(list, me)).toBe('3');
  });

  it('isReadByAllPeers is true when peer readAt is >= message time', () => {
    const msg = base({ id: '3', senderId: me, createdAt: '2020-01-01T00:00:02.000Z' });
    const t = new Date('2020-01-01T00:00:02.000Z').getTime();
    expect(
      isReadByAllPeers(msg, me, [peer], { [peer]: t }),
    ).toBe(true);
    expect(
      isReadByAllPeers(msg, me, [peer], { [peer]: t - 1 }),
    ).toBe(false);
  });
});
