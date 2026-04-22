import { ConversationComposeSchema } from './conversation-compose.schema';

describe('ConversationComposeSchema (R6)', () => {
  it('rejects whitespace-only', () => {
    expect(ConversationComposeSchema.safeParse({ content: '   \n' }).success).toBe(false);
  });

  it('accepts non-empty trimmed', () => {
    const r = ConversationComposeSchema.safeParse({ content: '  merhaba  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.content).toBe('merhaba');
  });

  it('rejects over 4000 chars', () => {
    expect(ConversationComposeSchema.safeParse({ content: 'x'.repeat(4001) }).success).toBe(false);
  });
});
