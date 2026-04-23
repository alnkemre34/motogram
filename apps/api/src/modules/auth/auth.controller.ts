import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AppleSignInSchema,
  AuthResultSchema,
  ChangeEmailRequestSchema,
  ChangeEmailResponseSchema,
  ChangeEmailVerifyResponseSchema,
  ChangeEmailVerifySchema,
  ChangePasswordResponseSchema,
  ChangePasswordSchema,
  ForgotPasswordResponseSchema,
  ForgotPasswordSchema,
  GoogleSignInSchema,
  LoginSchema,
  LogoutSchema,
  OtpRequestResponseSchema,
  OtpRequestSchema,
  OtpVerifyResponseSchema,
  OtpVerifySchema,
  RefreshTokenSchema,
  RegisterSchema,
  ResetPasswordResponseSchema,
  ResetPasswordSchema,
  TokenPairResponseSchema,
  type AppleSignInDto,
  type ChangeEmailRequestDto,
  type ChangeEmailVerifyDto,
  type ChangePasswordDto,
  type ForgotPasswordDto,
  type GoogleSignInDto,
  type LoginDto,
  type LogoutDto,
  type OtpRequestDto,
  type OtpVerifyDto,
  type RefreshTokenDto,
  type RegisterDto,
  type ResetPasswordDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';

import { AuthService } from './auth.service';

// Spec 8.7.1 - Auth denemeleri: 15 dakikada 5 basarisiz giris -> hesap kilidi
// Burada global ThrottlerGuard uzerinden @Throttle ile override ediliyor.

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** B-16 — Telefon OTP isteği (enumeration yok; 60 sn servis içi throttle). */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @Post('otp/request')
  @ZodResponse(OtpRequestResponseSchema)
  async otpRequest(@Body(new ZodBody(OtpRequestSchema)) dto: OtpRequestDto) {
    return this.auth.requestOtp(dto);
  }

  /** B-16 — OTP doğrulama; eşleşen kullanıcıda `phoneVerifiedAt`. */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @HttpCode(200)
  @Post('otp/verify')
  @ZodResponse(OtpVerifyResponseSchema)
  async otpVerify(@Body(new ZodBody(OtpVerifySchema)) dto: OtpVerifyDto) {
    return this.auth.verifyOtp(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 15 * 60_000, limit: 10 } })
  @Post('register')
  @ZodResponse(AuthResultSchema)
  async register(
    @Body(new ZodBody(RegisterSchema)) dto: RegisterDto,
  ) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  @HttpCode(200)
  @Post('login')
  @ZodResponse(AuthResultSchema)
  async login(
    @Body(new ZodBody(LoginSchema)) dto: LoginDto,
  ) {
    return this.auth.login(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 15 * 60_000, limit: 3 } })
  @HttpCode(200)
  @Post('password/forgot')
  @ZodResponse(ForgotPasswordResponseSchema)
  async forgotPassword(@Body(new ZodBody(ForgotPasswordSchema)) dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 15 * 60_000, limit: 10 } })
  @HttpCode(200)
  @Post('password/reset')
  @ZodResponse(ResetPasswordResponseSchema)
  async resetPassword(@Body(new ZodBody(ResetPasswordSchema)) dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  @ZodResponse(TokenPairResponseSchema)
  async refresh(
    @Body(new ZodBody(RefreshTokenSchema)) dto: RefreshTokenDto,
  ) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  @HttpCode(200)
  @Post('oauth/apple')
  @ZodResponse(AuthResultSchema)
  async appleOAuth(@Body(new ZodBody(AppleSignInSchema)) dto: AppleSignInDto) {
    return this.auth.appleSignIn(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  @HttpCode(200)
  @Post('oauth/google')
  @ZodResponse(AuthResultSchema)
  async googleOAuth(@Body(new ZodBody(GoogleSignInSchema)) dto: GoogleSignInDto) {
    return this.auth.googleSignIn(dto);
  }

  @HttpCode(204)
  @Post('logout')
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(LogoutSchema.extend({ refreshToken: RefreshTokenSchema.shape.refreshToken.optional() }))) dto: LogoutDto & { refreshToken?: string },
  ): Promise<void> {
    await this.auth.logout(user.userId, dto.refreshToken, dto.allDevices);
  }

  /** B-04 — JWT zorunlu; başarıda tüm refresh token'lar iptal (yeniden giriş / refresh gerekir). */
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  @HttpCode(200)
  @Post('password/change')
  @ZodResponse(ChangePasswordResponseSchema)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(ChangePasswordSchema)) dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user.userId, dto);
  }

  /** B-07 — JWT + şifre; `pendingEmail` + doğrulama maili (mevcut adrese). */
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  @HttpCode(200)
  @Post('email/change')
  @ZodResponse(ChangeEmailResponseSchema)
  async requestEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(ChangeEmailRequestSchema)) dto: ChangeEmailRequestDto,
  ) {
    return this.auth.requestEmailChange(user.userId, dto);
  }

  @Public()
  @Throttle({ default: { ttl: 15 * 60_000, limit: 20 } })
  @HttpCode(200)
  @Post('email/verify')
  @ZodResponse(ChangeEmailVerifyResponseSchema)
  async verifyEmailChange(@Body(new ZodBody(ChangeEmailVerifySchema)) dto: ChangeEmailVerifyDto) {
    return this.auth.verifyEmailChange(dto);
  }
}
