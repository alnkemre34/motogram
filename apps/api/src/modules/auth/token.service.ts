import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { TokenPair, UserRole } from '@motogram/shared';
import { v4 as uuidv4 } from 'uuid';

import { RedisService } from '../redis/redis.service';

// Spec 8.6 - Access Token 15dk, Refresh Token 7gun (Redis'te)

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface AccessPayload {
  sub: string;
  username: string;
  // Spec 5.4 - Admin guard JWT'den role okuyacak (DB lookup'i onlemek icin).
  // Opsiyonel cunku eski tokenlarda yok; guard defaultu 'USER' kabul eder.
  role?: UserRole;
  typ: 'access';
}

export interface RefreshPayload {
  sub: string;
  jti: string;
  typ: 'refresh';
}

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.accessSecret = config.get<string>('JWT_ACCESS_SECRET', 'dev_access_secret_change_me');
    this.refreshSecret = config.get<string>('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me');
  }

  async issueTokenPair(
    userId: string,
    username: string,
    role: UserRole = 'USER',
  ): Promise<TokenPair> {
    const jti = uuidv4();

    const accessToken = await this.jwt.signAsync(
      { sub: userId, username, role, typ: 'access' } satisfies AccessPayload,
      { secret: this.accessSecret, expiresIn: ACCESS_TTL_SECONDS },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti, typ: 'refresh' } satisfies RefreshPayload,
      { secret: this.refreshSecret, expiresIn: REFRESH_TTL_SECONDS },
    );

    await this.redis.setRefreshToken(userId, jti, REFRESH_TTL_SECONDS);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: ACCESS_TTL_SECONDS,
      refreshTokenExpiresIn: REFRESH_TTL_SECONDS,
    };
  }

  async verifyAccess(token: string): Promise<AccessPayload> {
    return this.jwt.verifyAsync<AccessPayload>(token, { secret: this.accessSecret });
  }

  async verifyRefresh(token: string): Promise<RefreshPayload> {
    return this.jwt.verifyAsync<RefreshPayload>(token, { secret: this.refreshSecret });
  }

  async revokeRefresh(userId: string, jti: string): Promise<void> {
    await this.redis.revokeRefreshToken(userId, jti);
  }

  async revokeAllForUser(userId: string): Promise<number> {
    return this.redis.revokeAllUserRefreshTokens(userId);
  }

  async isRefreshActive(userId: string, jti: string): Promise<boolean> {
    return this.redis.isRefreshTokenValid(userId, jti);
  }
}
