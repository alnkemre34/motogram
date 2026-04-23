import { mergeMessageReceived, type MessageWithPending } from './messaging-merge';
import type { MessageDto } from '@motogram/shared';

function msg(p: Partial<MessageDto> & { id: string; createdAt: string }): MessageWithPending {
  return {
    conversationId: '00000000-0000-4000-8000-000000000001',
    senderId: '00000000-0000-4000-8000-000000000002',
    clientId: null,
    content: 'hi',
    mediaUrls: [],
    messageType: 'TEXT',
    inviteData: null,
    isDeleted: false,
    reactions: [],
    ...p,
  };
}

describe('mergeMessageReceived (P7.2 /messaging)', () => {
  it('replaces pending row with same clientId', () => {
    const cid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const pending: MessageWithPending = {
      ...msg({ id: cid, clientId: cid, createdAt: '2020-01-01T00:00:00.000Z' }),
      _pending: true,
    };
    const server: MessageDto = {
      ...msg({
        id: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
        clientId: cid,
        content: 'hi',
        createdAt: '2020-01-01T00:00:01.000Z',
      }),
    };
    const out = mergeMessageReceived([pending], server, server.clientId ?? undefined);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe(server.id);
    expect(out[0]!._pending).toBeFalsy();
    expect(out[0]!.content).toBe('hi');
  });

  it('appends new message when no clientId match', () => {
    const a = msg({ id: '00000000-0000-4000-8000-0000000000aa', createdAt: '2020-01-01T00:00:00.000Z' });
    const b = msg({ id: '00000000-0000-4000-8000-0000000000bb', createdAt: '2020-01-01T00:00:01.000Z' });
    const out = mergeMessageReceived([a], b, undefined);
    expect(out.map((m) => m.id)).toEqual([a.id, b.id]);
  });
});
