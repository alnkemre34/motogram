import { z } from 'zod';

// Spec 9.4 - Standart hata yaniti: { error: string, code: number }

export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.number().int(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ErrorCodes = {
  VALIDATION_FAILED: 4000,
  UNAUTHORIZED: 4010,
  INVALID_CREDENTIALS: 4011,
  TOKEN_EXPIRED: 4012,
  TOKEN_INVALID: 4013,
  FORBIDDEN: 4030,
  BLOCKED: 4031,
  NOT_FOUND: 4040,
  CONFLICT: 4090,
  USER_EXISTS: 4091,
  RATE_LIMITED: 4290,
  /** Apple/Google OAuth env yapılandırılmadığında (503). */
  OAUTH_NOT_CONFIGURED: 5030,
  INTERNAL: 5000,
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
