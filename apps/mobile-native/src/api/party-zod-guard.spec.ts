import {
  CreatePartySchema,
  InviteToPartySchema,
  JoinPartySchema,
  RespondPartyInviteSchema,
} from '@motogram/shared';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('Party REST client semalari (R6, party.api)', () => {
  it('CreatePartySchema rejects short name', () => {
    const r = CreatePartySchema.safeParse({
      name: 'a',
      isPrivate: false,
      maxMembers: 20,
      coLeaderIds: [],
    });
    expect(r.success).toBe(false);
  });

  it('CreatePartySchema accepts minimal valid party', () => {
    const r = CreatePartySchema.safeParse({
      name: 'Pazar Turu',
      isPrivate: false,
      maxMembers: 20,
      coLeaderIds: [],
    });
    expect(r.success).toBe(true);
  });

  it('CreatePartySchema accepts PartyCreateModal default payload shape', () => {
    const r = CreatePartySchema.safeParse({
      name: 'Gece Turu',
      routeId: undefined,
      eventId: undefined,
      isPrivate: false,
      maxMembers: 20,
      coLeaderIds: [],
    });
    expect(r.success).toBe(true);
  });

  it('JoinPartySchema requires uuid partyId', () => {
    expect(JoinPartySchema.safeParse({ partyId: 'not-uuid' }).success).toBe(false);
    expect(JoinPartySchema.safeParse({ partyId: uuid(1) }).success).toBe(true);
  });

  it('InviteToPartySchema requires at least one userId', () => {
    expect(
      InviteToPartySchema.safeParse({ partyId: uuid(1), userIds: [] }).success,
    ).toBe(false);
    expect(
      InviteToPartySchema.safeParse({ partyId: uuid(1), userIds: [uuid(2)] }).success,
    ).toBe(true);
  });

  it('RespondPartyInviteSchema parses accept flag', () => {
    const r = RespondPartyInviteSchema.safeParse({ inviteId: uuid(3), accept: true });
    expect(r.success).toBe(true);
  });
});

