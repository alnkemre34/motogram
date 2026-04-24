import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  AuthLoginSuccessEventSchema,
  ErrorCodes,
  type AppleSignInDto,
  type ChangeEmailRequestDto,
  type ChangeEmailVerifyDto,
  type ChangePasswordDto,
  type ForgotPasswordDto,
  type GoogleSignInDto,
  type LoginDto,
  type OtpRequestDto,
  type OtpVerifyDto,
  type RegisterDto,
  type ResetPasswordDto,
  type TokenPair,
} from '@motogram/shared';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'node:crypto';

import { ZodEventBus } from '../../common/events/zod-event-bus.service';
import { PrismaService } from '../prisma/prisma.service';

import { EmailChangeMailQueue } from './email-change-mail.queue';
import { verifyAppleIdentityToken, verifyGoogleIdToken } from './oauth-token.verify';
import { OtpSmsQueue } from './otp-sms.queue';
import { PasswordResetMailQueue } from './password-reset-mail.queue';
import { TokenService } from './token.service';

// Spec 7.2.1 - login event'i; AccountService 30 gun icinde silme talebini
// iptal etmek icin dinler (deletedAt reset + BullMQ is iptali).
export const AUTH_LOGIN_EVENT = 'auth.login_success';
export interface AuthLoginEventPayload {
  userId: string;
  ts: string;
}

const BCRYPT_ROUNDS = 12;

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const EMAIL_CHANGE_TTL_MS = 48 * 60 * 60 * 1000;

/** B-16 — OTP süresi, istek aralığı ve deneme limiti. */
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_BCRYPT_ROUNDS = 10;

function randomOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashPasswordResetToken(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly events: ZodEventBus,
    private readonly passwordResetMail: PasswordResetMailQueue,
    private readonly emailChangeMail: EmailChangeMailQueue,
    private readonly otpSms: OtpSmsQueue,
    private readonly config: ConfigService,
  ) {}

  /** Pre-login: hangi auth yüzeyleri açık (OTP bayrağı `OTP_AUTH_ENABLED` ile). */
  getCapabilities(): { otpAuthEnabled: boolean } {
    return { otpAuthEnabled: this.config.get<boolean>('OTP_AUTH_ENABLED') === true };
  }

  private assertOtpEnabled(): void {
    if (this.config.get<boolean>('OTP_AUTH_ENABLED') !== true) {
      throw new ForbiddenException({
        error: 'otp_disabled',
        code: ErrorCodes.FORBIDDEN,
      });
    }
  }

  // Spec 9.2 - Email+sifre register. EULA zorunlu (Zod sema literal(true) ile
  // garanti altinda).
  async register(dto: RegisterDto): Promise<{ userId: string; tokens: TokenPair }> {
    const usernameNorm = dto.username.trim().toLowerCase();
    const emailNorm = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: emailNorm, mode: 'insensitive' } },
          { pendingEmail: { equals: emailNorm, mode: 'insensitive' } },
          { username: { equals: usernameNorm, mode: 'insensitive' } },
        ],
      },
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
        email: emailNorm,
        username: usernameNorm,
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
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { username: { equals: identifier, mode: 'insensitive' } },
        ],
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

  /** B-05 — Enumeration yok: geçersiz e-posta / OAuth-only / ban / silinmiş hesap hep `{ success: true }`. */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: true }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        deletedAt: true,
        isBanned: true,
      },
    });
    if (!user?.passwordHash || user.isBanned) {
      return { success: true as const };
    }
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
        return { success: true as const };
      }
    }

    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });
    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = hashPasswordResetToken(plainToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });
    await this.passwordResetMail.enqueue({
      userId: user.id,
      email: user.email,
      resetToken: plainToken,
    });
    return { success: true as const };
  }

  /** B-05 — Tek kullanımlık token; başarıda şifre + tüm refresh oturumları düşer. */
  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<{ success: true; revokedSessions: number }> {
    const tokenHash = hashPasswordResetToken(dto.token);
    const rec = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { select: { id: true, isBanned: true, deletedAt: true } },
      },
    });
    if (!rec || rec.user.isBanned || rec.user.deletedAt) {
      throw new BadRequestException({
        error: 'reset_token_invalid',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: rec.id },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: rec.userId },
        data: { passwordHash: newHash },
      });
    });
    const revokedSessions = await this.tokens.revokeAllForUser(rec.userId);
    return { success: true as const, revokedSessions };
  }

  /** B-07 — Mevcut şifre + benzersiz yeni e-posta; doğrulama linki mevcut adrese (kuyruk). */
  async requestEmailChange(
    userId: string,
    dto: ChangeEmailRequestDto,
  ): Promise<{ success: true; pendingEmail: string }> {
    const newNorm = dto.newEmail.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException({
        error: 'invalid_credentials',
        code: ErrorCodes.INVALID_CREDENTIALS,
      });
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        error: 'invalid_credentials',
        code: ErrorCodes.INVALID_CREDENTIALS,
      });
    }
    const currentNorm = user.email.trim().toLowerCase();
    if (newNorm === currentNorm) {
      throw new BadRequestException({
        error: 'email_unchanged',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
    const taken = await this.prisma.user.findFirst({
      where: {
        id: { not: userId },
        deletedAt: null,
        OR: [
          { email: { equals: newNorm, mode: 'insensitive' } },
          { pendingEmail: { equals: newNorm, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException({
        error: 'email_taken',
        code: ErrorCodes.CONFLICT,
      });
    }

    await this.prisma.emailChangeToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });
    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = hashPasswordResetToken(plainToken);
    const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { pendingEmail: newNorm },
      });
      await tx.emailChangeToken.create({
        data: { userId: user.id, newEmail: newNorm, tokenHash, expiresAt },
      });
    });
    await this.emailChangeMail.enqueue({
      userId: user.id,
      email: user.email,
      newEmail: newNorm,
      verifyToken: plainToken,
    });
    return { success: true as const, pendingEmail: newNorm };
  }

  /** B-07 — Public; token geçerliyse `email` güncellenir, pending temizlenir, refresh oturumları düşer. */
  async verifyEmailChange(dto: ChangeEmailVerifyDto): Promise<{ success: true }> {
    const tokenHash = hashPasswordResetToken(dto.token);
    const rec = await this.prisma.emailChangeToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            pendingEmail: true,
            isBanned: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!rec || rec.user.isBanned || rec.user.deletedAt) {
      throw new BadRequestException({
        error: 'email_change_token_invalid',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
    const pendingNorm = rec.user.pendingEmail?.trim().toLowerCase();
    const newNorm = rec.newEmail.trim().toLowerCase();
    if (!pendingNorm || pendingNorm !== newNorm) {
      throw new BadRequestException({
        error: 'email_change_token_invalid',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.emailChangeToken.update({
        where: { id: rec.id },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: rec.userId },
        data: { email: newNorm, pendingEmail: null },
      });
    });
    await this.tokens.revokeAllForUser(rec.userId);
    return { success: true as const };
  }

  /** B-16 — Kayıtlı telefon için OTP üretir; 60 sn throttle; enumeration yok (her zaman success). */
  async requestOtp(dto: OtpRequestDto): Promise<{ success: true }> {
    this.assertOtpEnabled();
    const phone = dto.phoneNumber.trim();
    const user = await this.prisma.user.findFirst({
      where: { phoneNumber: phone, deletedAt: null, isBanned: false },
      select: { id: true },
    });
    if (!user) {
      return { success: true as const };
    }
    const latest = await this.prisma.otpCode.findFirst({
      where: { phone, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (latest && Date.now() - latest.createdAt.getTime() < OTP_COOLDOWN_MS) {
      throw new HttpException(
        {
          error: 'otp_rate_limited',
          code: ErrorCodes.RATE_LIMITED,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.prisma.otpCode.updateMany({
      where: { phone, usedAt: null },
      data: { usedAt: new Date() },
    });
    const plain = randomOtpCode();
    const codeHash = await bcrypt.hash(plain, OTP_BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await this.prisma.otpCode.create({
      data: { phone, codeHash, expiresAt },
    });
    try {
      await this.otpSms.enqueue({ phone, code: plain });
    } catch (err) {
      this.logger.warn(`otp_enqueue_failed phone=${phone} err=${(err as Error).message}`);
    }
    return { success: true as const };
  }

  /** B-16 — Kod doğrulanırsa eşleşen kullanıcıda `phoneVerifiedAt` set edilir. */
  async verifyOtp(dto: OtpVerifyDto): Promise<{ success: true; phoneVerified: boolean }> {
    this.assertOtpEnabled();
    const phone = dto.phoneNumber.trim();
    const code = dto.code.trim();
    const now = new Date();
    const row = await this.prisma.otpCode.findFirst({
      where: { phone, usedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) {
      throw new BadRequestException({
        error: 'otp_invalid_or_expired',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
    if (row.attemptCount >= OTP_MAX_ATTEMPTS) {
      throw new ForbiddenException({
        error: 'otp_locked',
        code: ErrorCodes.FORBIDDEN,
      });
    }
    const match = await bcrypt.compare(code, row.codeHash);
    if (!match) {
      await this.prisma.otpCode.update({
        where: { id: row.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new UnauthorizedException({
        error: 'otp_code_invalid',
        code: ErrorCodes.INVALID_CREDENTIALS,
      });
    }
    await this.prisma.otpCode.update({
      where: { id: row.id },
      data: { usedAt: now },
    });
    const res = await this.prisma.user.updateMany({
      where: { phoneNumber: phone, deletedAt: null },
      data: { phoneVerifiedAt: now },
    });
    return { success: true as const, phoneVerified: res.count > 0 };
  }

  async appleSignIn(dto: AppleSignInDto): Promise<{ userId: string; tokens: TokenPair }> {
    const clientId = this.config.get<string>('APPLE_CLIENT_ID');
    if (!clientId) {
      throw new ServiceUnavailableException({
        error: 'oauth_apple_not_configured',
        code: ErrorCodes.OAUTH_NOT_CONFIGURED,
      });
    }
    let claims: { sub: string; email?: string };
    try {
      claims = await verifyAppleIdentityToken(dto.identityToken, clientId);
    } catch {
      throw new UnauthorizedException({
        error: 'oauth_token_invalid',
        code: ErrorCodes.TOKEN_INVALID,
      });
    }
    const sub = claims.sub;
    const bySub = await this.prisma.user.findUnique({
      where: { appleSub: sub },
    });
    if (bySub) {
      return this.issueSessionAfterLogin({
        id: bySub.id,
        username: bySub.username,
        role: bySub.role,
        isBanned: bySub.isBanned,
        deletedAt: bySub.deletedAt,
      });
    }
    const emailFromClient = dto.email?.trim().toLowerCase();
    const emailFromToken = claims.email?.trim().toLowerCase();
    const emailNorm = emailFromClient ?? emailFromToken ?? this.applePlaceholderEmail(sub);
    await this.assertNoOAuthEmailConflict(emailNorm, 'apple', sub);
    const name = this.displayNameFromAppleFullName(dto.fullName);
    const user = await this.createOAuthUser({
      emailNorm,
      appleSub: sub,
      name,
      preferredLanguage: dto.preferredLanguage,
    });
    return this.issueSessionAfterLogin({
      id: user.id,
      username: user.username,
      role: user.role,
      isBanned: user.isBanned,
      deletedAt: user.deletedAt,
    });
  }

  async googleSignIn(dto: GoogleSignInDto): Promise<{ userId: string; tokens: TokenPair }> {
    const audiences = this.parseGoogleClientIds();
    if (audiences.length === 0) {
      throw new ServiceUnavailableException({
        error: 'oauth_google_not_configured',
        code: ErrorCodes.OAUTH_NOT_CONFIGURED,
      });
    }
    let claims: { sub: string; email: string; name?: string };
    try {
      claims = await verifyGoogleIdToken(dto.idToken, audiences);
    } catch {
      throw new UnauthorizedException({
        error: 'oauth_token_invalid',
        code: ErrorCodes.TOKEN_INVALID,
      });
    }
    const bySub = await this.prisma.user.findUnique({
      where: { googleSub: claims.sub },
    });
    if (bySub) {
      return this.issueSessionAfterLogin({
        id: bySub.id,
        username: bySub.username,
        role: bySub.role,
        isBanned: bySub.isBanned,
        deletedAt: bySub.deletedAt,
      });
    }
    const emailNorm = claims.email.trim().toLowerCase();
    await this.assertNoOAuthEmailConflict(emailNorm, 'google', claims.sub);
    const nameRaw = claims.name?.trim();
    const name = nameRaw && nameRaw.length > 0 ? nameRaw.slice(0, 80) : null;
    const user = await this.createOAuthUser({
      emailNorm,
      googleSub: claims.sub,
      name,
      preferredLanguage: dto.preferredLanguage,
    });
    return this.issueSessionAfterLogin({
      id: user.id,
      username: user.username,
      role: user.role,
      isBanned: user.isBanned,
      deletedAt: user.deletedAt,
    });
  }

  private parseGoogleClientIds(): string[] {
    const raw = this.config.get<string>('GOOGLE_CLIENT_IDS');
    if (!raw?.trim()) return [];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private applePlaceholderEmail(sub: string): string {
    const h = createHash('sha256').update(sub, 'utf8').digest('hex').slice(0, 32);
    return `apple_${h}@oauth.motogram.local`;
  }

  private displayNameFromAppleFullName(
    fullName: AppleSignInDto['fullName'] | undefined,
  ): string | null {
    if (!fullName) return null;
    const parts = [fullName.givenName, fullName.familyName].filter(
      (x): x is string => typeof x === 'string' && x.trim().length > 0,
    );
    if (parts.length === 0) return null;
    const joined = parts.join(' ').trim();
    return joined.length > 0 ? joined.slice(0, 80) : null;
  }

  private async usernameCandidateFromEmail(email: string): Promise<string> {
    const local = email.split('@')[0] ?? 'user';
    const base = local
      .toLowerCase()
      .replace(/[^a-z0-9_.]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 20);
    const prefix = (base.length >= 3 ? base : `u_${base}`).slice(0, 20);
    const suffix = randomBytes(3).toString('hex');
    return `${prefix}_${suffix}`.slice(0, 30);
  }

  private async assertNoOAuthEmailConflict(
    emailNorm: string,
    provider: 'apple' | 'google',
    sub: string,
  ): Promise<void> {
    const row = await this.prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: 'insensitive' } },
      select: { appleSub: true, googleSub: true },
    });
    if (!row) return;
    const bound = provider === 'apple' ? row.appleSub : row.googleSub;
    if (bound === sub) return;
    throw new ConflictException({
      error: 'oauth_email_provider_mismatch',
      code: ErrorCodes.CONFLICT,
    });
  }

  private async createOAuthUser(params: {
    emailNorm: string;
    appleSub?: string;
    googleSub?: string;
    name: string | null;
    preferredLanguage: 'tr' | 'en';
  }): Promise<{
    id: string;
    username: string;
    role: UserRole;
    isBanned: boolean;
    deletedAt: Date | null;
  }> {
    const now = new Date();
    for (let attempt = 0; attempt < 8; attempt++) {
      const username = await this.usernameCandidateFromEmail(params.emailNorm);
      try {
        return await this.prisma.user.create({
          data: {
            email: params.emailNorm,
            username,
            passwordHash: null,
            ...(params.appleSub ? { appleSub: params.appleSub } : {}),
            ...(params.googleSub ? { googleSub: params.googleSub } : {}),
            name: params.name,
            preferredLanguage: params.preferredLanguage,
            eulaAcceptedAt: now,
            settings: {
              create: {
                language: params.preferredLanguage,
              },
            },
          },
          select: {
            id: true,
            username: true,
            role: true,
            isBanned: true,
            deletedAt: true,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          continue;
        }
        throw e;
      }
    }
    throw new ConflictException({
      error: 'oauth_username_exhausted',
      code: ErrorCodes.CONFLICT,
    });
  }

  private async assertPasswordlessUserCanLogin(user: {
    id: string;
    isBanned: boolean;
    deletedAt: Date | null;
  }): Promise<void> {
    if (user.isBanned) {
      throw new UnauthorizedException({
        error: 'account_banned',
        code: ErrorCodes.BLOCKED,
      });
    }
    if (!user.deletedAt) return;
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

  private async issueSessionAfterLogin(user: {
    id: string;
    username: string;
    role: UserRole;
    isBanned: boolean;
    deletedAt: Date | null;
  }): Promise<{ userId: string; tokens: TokenPair }> {
    await this.assertPasswordlessUserCanLogin(user);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });
    this.events.emit(AUTH_LOGIN_EVENT, AuthLoginSuccessEventSchema, {
      userId: user.id,
      ts: new Date().toISOString(),
    } satisfies AuthLoginEventPayload);
    const tokens = await this.tokens.issueTokenPair(user.id, user.username, user.role);
    return { userId: user.id, tokens };
  }
}
