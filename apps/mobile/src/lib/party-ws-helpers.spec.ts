import { applyPartyStatusChange } from './party-ws-helpers';
import type { PartyDetail } from '@motogram/shared';

function detail(over: Partial<PartyDetail> = {}): PartyDetail {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'P',
    leaderId: '00000000-0000-4000-8000-000000000002',
    coLeaderIds: [],
    status: 'WAITING',
    memberCount: 2,
    isPrivate: false,
    maxMembers: 20,
    createdAt: new Date().toISOString(),
    members: [
      {
        userId: '00000000-0000-4000-8000-000000000002',
        username: 'lead',
        role: 'LEADER',
        isOnline: true,
        joinedAt: new Date().toISOString(),
      },
    ],
    ...over,
  };
}

describe('applyPartyStatusChange (P7 /realtime party:status_changed)', () => {
  it('updates status', () => {
    const a = detail({ status: 'WAITING' });
    const b = applyPartyStatusChange(a, 'RIDING');
    expect(b.status).toBe('RIDING');
    expect(b.name).toBe('P');
  });

  it('returns same object reference when status unchanged (idempotent)', () => {
    const a = detail({ status: 'RIDING' });
    const b = applyPartyStatusChange(a, 'RIDING');
    expect(b).toBe(a);
  });
});
