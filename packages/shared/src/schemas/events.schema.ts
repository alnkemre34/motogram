import { z } from 'zod';

import { GamificationTriggerPayloadSchema } from './gamification.schema';

/** auth.login_success payload */
export const AuthLoginSuccessEventSchema = z.object({
  userId: z.string().uuid(),
  ts: z.string().datetime(),
});
export type AuthLoginSuccessEvent = z.infer<typeof AuthLoginSuccessEventSchema>;

export const EVENT_SCHEMAS = {
  'gamification.trigger': GamificationTriggerPayloadSchema,
  'auth.login_success': AuthLoginSuccessEventSchema,
} as const;

export type KnownEventName = keyof typeof EVENT_SCHEMAS;
