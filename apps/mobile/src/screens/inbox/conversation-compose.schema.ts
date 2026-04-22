import { z } from 'zod';

/** TEXT mesaji — trim + bosluk reddi + 4000 karakter ust siniri (SendMessageSchema ile uyumlu). */
export const ConversationComposeSchema = z.object({
  content: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.string().min(1, 'message_empty').max(4000),
  ),
});

export type ConversationComposeValues = z.infer<typeof ConversationComposeSchema>;
