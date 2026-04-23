import { ListConversationsQuerySchema, MuteConversationSchema } from './message.schema';

describe('ListConversationsQuerySchema (B-02)', () => {
  it('accepts empty query', () => {
    const res = ListConversationsQuerySchema.safeParse({});
    expect(res.success).toBe(true);
  });

  it('accepts each conversation type', () => {
    for (const type of ['DIRECT', 'GROUP_CHAT', 'COMMUNITY_CHAT'] as const) {
      const res = ListConversationsQuerySchema.safeParse({ type });
      expect(res.success).toBe(true);
      if (res.success) expect(res.data.type).toBe(type);
    }
  });

  it('rejects invalid type', () => {
    expect(ListConversationsQuerySchema.safeParse({ type: 'INVALID' }).success).toBe(false);
  });
});

describe('MuteConversationSchema (B-18)', () => {
  it('accepts empty body (indefinite mute)', () => {
    const r = MuteConversationSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('accepts mutedUntil null (unmute)', () => {
    const r = MuteConversationSchema.safeParse({ mutedUntil: null });
    expect(r.success).toBe(true);
  });
});
