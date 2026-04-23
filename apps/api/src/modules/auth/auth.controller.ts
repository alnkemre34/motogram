import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AuthResultSchema,
  ChangePasswordResponseSchema,
  ChangePasswordSchema,
  LoginSchema,
  LogoutSchema,
  RefreshTokenSchema,
  RegisterSchema,
  TokenPairResponseSchema,
  type ChangePasswordDto,
  type LoginDto,
  type LogoutDto,
  type RefreshTokenDto,
  type RegisterDto,
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
  @HttpCode(200)
  @Post('refresh')
  @ZodResponse(TokenPairResponseSchema)
  async refresh(
    @Body(new ZodBody(RefreshTokenSchema)) dto: RefreshTokenDto,
  ) {
    return this.auth.refresh(dto.refreshToken);
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
}
