import { CommunityJoinMessageSchema } from './community-join-form.schema';

describe('CommunityJoinMessageSchema (R6)', () => {
  it('allows empty join message', () => {
    expect(CommunityJoinMessageSchema.safeParse({ message: '' }).success).toBe(true);
  });

  it('rejects message over 500 chars', () => {
    expect(CommunityJoinMessageSchema.safeParse({ message: 'x'.repeat(501) }).success).toBe(false);
  });
});
