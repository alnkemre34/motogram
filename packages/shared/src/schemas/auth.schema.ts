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
});
export type AppleSignInDto = z.infer<typeof AppleSignInSchema>;

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
