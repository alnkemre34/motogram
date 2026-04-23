import { z } from 'zod';

// Spec 9.2 - Auth yontemler: Email+Sifre, OTP (telefon), Apple
// Spec 9.2 - EULA onay kutusu zorunlu (App Store UGC kurali)

export const UsernameSchema = z
  .string()
  .min(3, 'username_too_short')
  .max(30, 'username_too_long')
  .regex(/^[a-zA-Z0-9_.]+$/, 'username_invalid_chars');

export const PasswordSchema = z
  .string()
  .min(8, 'password_too_short')
  .max(128, 'password_too_long');

export const RegisterSchema = z.object({
  email: z.string().email('email_invalid'),
  username: UsernameSchema,
  password: PasswordSchema,
  name: z.string().max(80).optional(),
  eulaAccepted: z.literal(true, {
    errorMap: () => ({ message: 'eula_required' }),
  }),
  preferredLanguage: z.enum(['tr', 'en']).default('tr'),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  identifier: z.string().min(3, 'identifier_required'),
  password: z.string().min(1, 'password_required'),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(10, 'refresh_token_invalid'),
});
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;

export const OtpRequestSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, 'phone_e164_required'),
});
export type OtpRequestDto = z.infer<typeof OtpRequestSchema>;

export const OtpVerifySchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/, 'phone_e164_required'),
  code: z.string().regex(/^\d{6}$/, 'otp_6_digits'),
});
export type OtpVerifyDto = z.infer<typeof OtpVerifySchema>;

/** B-16 — Her zaman 200 (enumeration yok); SMS kuyruğu yalnızca kayıtlı telefonda. */
export const OtpRequestResponseSchema = z.object({
  success: z.literal(true),
});
export type OtpRequestResponse = z.infer<typeof OtpRequestResponseSchema>;

export const OtpVerifyResponseSchema = z.object({
  success: z.literal(true),
  /** Eşleşen `User.phoneNumber` satırı güncellendiyse true. */
  phoneVerified: z.boolean(),
});
export type OtpVerifyResponse = z.infer<typeof OtpVerifyResponseSchema>;

export const AppleSignInSchema = z.object({
  identityToken: z.string().min(10, 'apple_token_invalid'),
  authorizationCode: z.string().optional(),
  fullName: z
    .object({
      givenName: z.string().nullable().optional(),
      familyName: z.string().nullable().optional(),
    })
    .optional(),
  email: z.string().email().optional(),
  eulaAccepted: z.literal(true, {
    errorMap: () => ({ message: 'eula_required' }),
  }),
  preferredLanguage: z.enum(['tr', 'en']).default('tr'),
});
export type AppleSignInDto = z.infer<typeof AppleSignInSchema>;

export const GoogleSignInSchema = z.object({
  idToken: z.string().min(10, 'google_token_invalid'),
  eulaAccepted: z.literal(true, {
    errorMap: () => ({ message: 'eula_required' }),
  }),
  preferredLanguage: z.enum(['tr', 'en']).default('tr'),
});
export type GoogleSignInDto = z.infer<typeof GoogleSignInSchema>;

export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresIn: z.number(),
  refreshTokenExpiresIn: z.number(),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

export const TokenPairResponseSchema = TokenPairSchema.passthrough();

/** POST /auth/register | POST /auth/login response */
export const AuthResultSchema = z
  .object({
    userId: z.string().uuid(),
    tokens: TokenPairSchema,
  })
  .passthrough();
export type AuthResult = z.infer<typeof AuthResultSchema>;

export const LogoutSchema = z.object({
  allDevices: z.boolean().default(false),
});
export type LogoutDto = z.infer<typeof LogoutSchema>;

/** POST /auth/password/change — oturum içi şifre değişimi (B-04). */
export const ChangePasswordSchema = z
  .object({
    currentPassword: PasswordSchema,
    newPassword: PasswordSchema,
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.newPassword === val.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newPassword'],
        message: 'password_must_change',
      });
    }
  });
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

export const ChangePasswordResponseSchema = z.object({
  success: z.literal(true),
  revokedSessions: z.number().int().nonnegative(),
});
export type ChangePasswordResponse = z.infer<typeof ChangePasswordResponseSchema>;

/** POST /auth/password/forgot (B-05) — enumeration koruması: her zaman aynı gövde. */
export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;

export const ForgotPasswordResponseSchema = z.object({ success: z.literal(true) });
export type ForgotPasswordResponse = z.infer<typeof ForgotPasswordResponseSchema>;

/** POST /auth/password/reset (B-05) */
export const ResetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  newPassword: PasswordSchema,
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;

/** Reset sonrası oturumlar düşer; ChangePassword ile aynı JSON şekli (ayrı Zod nesnesi → OpenAPI reflector). */
export const ResetPasswordResponseSchema = z.object({
  success: z.literal(true),
  revokedSessions: z.number().int().nonnegative(),
});
export type ResetPasswordResponse = z.infer<typeof ResetPasswordResponseSchema>;

/** POST /auth/email/change (B-07) — JWT + mevcut şifre. */
export const ChangeEmailRequestSchema = z.object({
  newEmail: z.string().email(),
  password: PasswordSchema,
});
export type ChangeEmailRequestDto = z.infer<typeof ChangeEmailRequestSchema>;

export const ChangeEmailResponseSchema = z.object({
  success: z.literal(true),
  pendingEmail: z.string().email(),
});
export type ChangeEmailResponse = z.infer<typeof ChangeEmailResponseSchema>;

/** POST /auth/email/verify (B-07) — public; maildeki tek kullanımlık token. */
export const ChangeEmailVerifySchema = z.object({
  token: z.string().min(32).max(128),
});
export type ChangeEmailVerifyDto = z.infer<typeof ChangeEmailVerifySchema>;

export const ChangeEmailVerifyResponseSchema = z.object({ success: z.literal(true) });
export type ChangeEmailVerifyResponse = z.infer<typeof ChangeEmailVerifyResponseSchema>;
