import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthLoginSuccessEventSchema,
  ErrorCodes,
  type ChangePasswordDto,
  type LoginDto,
  type RegisterDto,
  type TokenPair,
} from '@motogram/shared';
import * as bcrypt from 'bcrypt';

import { ZodEventBus } from '../../common/events/zod-event-bus.service';
import { PrismaService } from '../prisma/prisma.service';

import { TokenService } from './token.service';

// Spec 7.2.1 - login event'i; AccountService 30 gun icinde silme talebini
// iptal etmek icin dinler (deletedAt reset + BullMQ is iptali).
export const AUTH_LOGIN_EVENT = 'auth.login_success';
export interface AuthLoginEventPayload {
  userId: string;
  ts: string;
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly events: ZodEventBus,
  ) {}

  // Spec 9.2 - Email+sifre register. EULA zorunlu (Zod sema literal(true) ile
  // garanti altinda).
  async register(dto: RegisterDto): Promise<{ userId: string; tokens: TokenPair }> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new ConflictException({
        error: 'user_already_exists',
        code: ErrorCodes.USER_EXISTS,
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        name: dto.name ?? null,
        preferredLanguage: dto.preferredLanguage,
        eulaAcceptedAt: new Date(),
        settings: {
          create: {
            language: dto.preferredLanguage,
          },
        },
      },
    });

    const tokens = await this.tokens.issueTokenPair(user.id, user.username, user.role);
    return { userId: user.id, tokens };
  }

  async login(dto: LoginDto): Promise<{ userId: string; tokens: TokenPair }> {
    const identifier = dto.identifier.trim().toLowerCase();
    // Spec 7.2.1 - Soft-delete edilmis kullanici 30 gun pencere icinde giris
    // yaparsa silme islemi iptal edilmelidir. Bu yuzden deletedAt != null olan
    // kullanicilari findFirst ile cekip grace window'u kontrol ediyoruz.
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        error: 'invalid_credentials',
        code: ErrorCodes.INVALID_CREDENTIALS,
      });
    }
    if (user.isBanned) {
      throw new UnauthorizedException({
        error: 'account_banned',
        code: ErrorCodes.BLOCKED,
      });
    }

    // Pencere disinda soft-delete (AccountDeletion executed veya 30 gun gecmis)
    // ise giris reddedilir. Bu, Spec 5.2 veri imha politikasina uygun.
    if (user.deletedAt) {
      const deletion = await this.prisma.accountDeletion.findUnique({
        where: { userId: user.id },
      });
      const now = new Date();
      const canRestore =
        deletion &&
        !deletion.executedAt &&
        !deletion.cancelledAt &&
        deletion.scheduledFor.getTime() > now.getTime();
      if (!canRestore) {
        throw new UnauthorizedException({
          error: 'account_deleted',
          code: ErrorCodes.UNAUTHORIZED,
        });
      }
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        error: 'invalid_credentials',
        code: ErrorCodes.INVALID_CREDENTIALS,
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    // Spec 7.2.1 - Basarili login sonrasi AccountService dinleyicisi
    // deletedAt'i sifirlar + BullMQ isini iptal eder.
    this.events.emit(AUTH_LOGIN_EVENT, AuthLoginSuccessEventSchema, {
      userId: user.id,
      ts: new Date().toISOString(),
    } satisfies AuthLoginEventPayload);

    const tokens = await this.tokens.issueTokenPair(user.id, user.username, user.role);
    return { userId: user.id, tokens };
  }

  // Spec 8.6 - Refresh akisi: eski jti iptal, yeni pair uretilir (rotation)
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload;
    try {
      payload = await this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException({
        error: 'refresh_token_invalid',
        code: ErrorCodes.TOKEN_INVALID,
      });
    }

    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException({
        error: 'wrong_token_type',
        code: ErrorCodes.TOKEN_INVALID,
      });
    }

    const active = await this.tokens.isRefreshActive(payload.sub, payload.jti);
    if (!active) {
      // Replay veya logout olmus token
      throw new UnauthorizedException({
        error: 'refresh_token_revoked',
        code: ErrorCodes.TOKEN_INVALID,
      });
    }

    // Eski jti'yi iptal et (rotation), yeni pair dondur
    await this.tokens.revokeRefresh(payload.sub, payload.jti);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, role: true, isBanned: true, deletedAt: true },
    });

    if (!user || user.isBanned || user.deletedAt) {
      throw new UnauthorizedException({
        error: 'user_inactive',
        code: ErrorCodes.UNAUTHORIZED,
      });
    }

    return this.tokens.issueTokenPair(user.id, user.username, user.role);
  }

  async logout(userId: string, refreshToken: string | undefined, allDevices: boolean): Promise<void> {
    if (allDevices) {
      await this.tokens.revokeAllForUser(userId);
      return;
    }
    if (!refreshToken) {
      return;
    }
    try {
      const payload = await this.tokens.verifyRefresh(refreshToken);
      await this.tokens.revokeRefresh(payload.sub, payload.jti);
    } catch {
      // Gecersiz token'i silence-swallow: logout idempotent
    }
  }

  /** B-04: Mevcut şifre doğrulanır, yeni hash yazılır, tüm refresh oturumları düşürülür. */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ success: true; revokedSessions: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException({
        error: 'invalid_credentials',
        code: ErrorCodes.INVALID_CREDENTIALS,
      });
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        error: 'invalid_credentials',
        code: ErrorCodes.INVALID_CREDENTIALS,
      });
    }
    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
    const revokedSessions = await this.tokens.revokeAllForUser(userId);
    return { success: true as const, revokedSessions };
  }
}
