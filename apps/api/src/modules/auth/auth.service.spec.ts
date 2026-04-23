import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ErrorCodes } from '@motogram/shared';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

import { AuthService } from './auth.service';
import type { TokenService } from './token.service';
import * as oauthVerify from './oauth-token.verify';

jest.mock('./oauth-token.verify', () => ({
  verifyAppleIdentityToken: jest.fn(),
  verifyGoogleIdToken: jest.fn(),
}));

function hashPasswordResetToken(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}

// Tests validate SPEC behaviors:
// - Spec 9.2: register must create user, set EULA timestamp, issue token pair
// - Spec 9.4: errors must use { error, code } standard format
// - Spec 8.6: refresh rotation - old jti revoked, new pair issued
// - Spec 8.6: invalid/revoked refresh tokens must fail with TOKEN_INVALID
// - Spec 9.2: login with wrong password must fail with INVALID_CREDENTIALS

function createPrismaMock() {
  const m: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    accountDeletion: { findUnique: jest.Mock };
    passwordResetToken: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    emailChangeToken: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    otpCode: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  } = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    accountDeletion: { findUnique: jest.fn() },
    passwordResetToken: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    emailChangeToken: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    otpCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  m.$transaction.mockImplementation(async (fn: (tx: typeof m) => Promise<unknown>) => fn(m));
  return m;
}

function createTokenServiceMock(): jest.Mocked<TokenService> {
  return {
    issueTokenPair: jest.fn(),
    verifyAccess: jest.fn(),
    verifyRefresh: jest.fn(),
    revokeRefresh: jest.fn(),
    revokeAllForUser: jest.fn(),
    isRefreshActive: jest.fn(),
  } as unknown as jest.Mocked<TokenService>;
}

describe('AuthService (Spec 8.6, 9.2, 9.4)', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let tokens: jest.Mocked<TokenService>;
  let service: AuthService;

  let events: { emit: jest.Mock };
  let passwordResetMail: { enqueue: jest.Mock };
  let emailChangeMail: { enqueue: jest.Mock };
  let otpSms: { enqueue: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    prisma = createPrismaMock();
    tokens = createTokenServiceMock();
    events = { emit: jest.fn(() => true) };
    passwordResetMail = { enqueue: jest.fn().mockResolvedValue(undefined) };
    emailChangeMail = { enqueue: jest.fn().mockResolvedValue(undefined) };
    otpSms = { enqueue: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn() };
    jest.mocked(oauthVerify.verifyAppleIdentityToken).mockReset();
    jest.mocked(oauthVerify.verifyGoogleIdToken).mockReset();
    service = new AuthService(
      prisma as never,
      tokens,
      events as never,
      passwordResetMail as never,
      emailChangeMail as never,
      otpSms as never,
      config as never,
    );
  });

  describe('register (Spec 9.2)', () => {
    it('creates user, stamps eulaAcceptedAt, and issues token pair', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u1', username: 'alice', role: 'USER' } as never);
      tokens.issueTokenPair.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        accessTokenExpiresIn: 900,
        refreshTokenExpiresIn: 7 * 24 * 3600,
      });

      const result = await service.register({
        email: 'alice@example.com',
        username: 'alice',
        password: 'password123',
        name: 'Alice',
        eulaAccepted: true,
        preferredLanguage: 'tr',
      });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      const createCall = prisma.user.create.mock.calls[0]![0];
      expect(createCall.data.eulaAcceptedAt).toBeInstanceOf(Date);
      expect(createCall.data.settings.create.language).toBe('tr');
      expect(createCall.data.username).toBe('alice');
      expect(result.userId).toBe('u1');
      expect(result.tokens.accessToken).toBe('a');
    });

    it('rejects duplicate username/email with 409 + USER_EXISTS', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' } as never);

      await expect(
        service.register({
          email: 'alice@example.com',
          username: 'alice',
          password: 'password123',
          eulaAccepted: true,
          preferredLanguage: 'tr',
        }),
      ).rejects.toMatchObject({
        response: { error: 'user_already_exists', code: ErrorCodes.USER_EXISTS },
      });
    });

    it('throws ConflictException type', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' } as never);
      await expect(
        service.register({
          email: 'alice@example.com',
          username: 'alice',
          password: 'password123',
          eulaAccepted: true,
          preferredLanguage: 'tr',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login (Spec 9.2, 9.4)', () => {
    it('fails with INVALID_CREDENTIALS when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.login({ identifier: 'missing', password: 'x' }),
      ).rejects.toMatchObject({
        response: { error: 'invalid_credentials', code: ErrorCodes.INVALID_CREDENTIALS },
      });
    });

    it('fails with INVALID_CREDENTIALS when password does not match', async () => {
      const hash = await bcrypt.hash('correct', 4);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        username: 'alice',
        passwordHash: hash,
        isBanned: false,
      } as never);
      await expect(
        service.login({ identifier: 'alice', password: 'wrong' }),
      ).rejects.toMatchObject({
        response: { error: 'invalid_credentials', code: ErrorCodes.INVALID_CREDENTIALS },
      });
    });

    it('rejects banned accounts with BLOCKED code', async () => {
      const hash = await bcrypt.hash('correct', 4);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        username: 'alice',
        passwordHash: hash,
        isBanned: true,
      } as never);
      await expect(
        service.login({ identifier: 'alice', password: 'correct' }),
      ).rejects.toMatchObject({
        response: { error: 'account_banned', code: ErrorCodes.BLOCKED },
      });
    });

    it('issues tokens and updates lastSeenAt on success', async () => {
      const hash = await bcrypt.hash('password123', 4);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        username: 'alice',
        passwordHash: hash,
        isBanned: false,
      } as never);
      tokens.issueTokenPair.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        accessTokenExpiresIn: 900,
        refreshTokenExpiresIn: 7 * 24 * 3600,
      });

      const result = await service.login({ identifier: 'alice', password: 'password123' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { lastSeenAt: expect.any(Date) },
      });
      expect(result.tokens.accessToken).toBe('a');
    });
  });

  describe('refresh (Spec 8.6 - rotation)', () => {
    it('rejects a token that is not active in Redis (replay protection)', async () => {
      tokens.verifyRefresh.mockResolvedValue({ sub: 'u1', jti: 'j1', typ: 'refresh' });
      tokens.isRefreshActive.mockResolvedValue(false);

      await expect(service.refresh('token')).rejects.toMatchObject({
        response: { error: 'refresh_token_revoked', code: ErrorCodes.TOKEN_INVALID },
      });
    });

    it('rotates: revokes old jti and issues new pair', async () => {
      tokens.verifyRefresh.mockResolvedValue({ sub: 'u1', jti: 'j1', typ: 'refresh' });
      tokens.isRefreshActive.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        username: 'alice',
        role: 'USER',
        isBanned: false,
        deletedAt: null,
      } as never);
      tokens.issueTokenPair.mockResolvedValue({
        accessToken: 'a2',
        refreshToken: 'r2',
        accessTokenExpiresIn: 900,
        refreshTokenExpiresIn: 7 * 24 * 3600,
      });

      const pair = await service.refresh('token');

      expect(tokens.revokeRefresh).toHaveBeenCalledWith('u1', 'j1');
      expect(tokens.issueTokenPair).toHaveBeenCalledWith('u1', 'alice', 'USER');
      expect(pair.accessToken).toBe('a2');
    });

    it('rejects when user is deleted or banned', async () => {
      tokens.verifyRefresh.mockResolvedValue({ sub: 'u1', jti: 'j1', typ: 'refresh' });
      tokens.isRefreshActive.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        username: 'alice',
        isBanned: true,
        deletedAt: null,
      } as never);

      await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an invalid signature refresh token with TOKEN_INVALID', async () => {
      tokens.verifyRefresh.mockRejectedValue(new Error('bad sig'));
      await expect(service.refresh('x')).rejects.toMatchObject({
        response: { error: 'refresh_token_invalid', code: ErrorCodes.TOKEN_INVALID },
      });
    });
  });

  describe('logout (Spec 8.6)', () => {
    it('revokes all when allDevices=true', async () => {
      await service.logout('u1', undefined, true);
      expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
    });

    it('revokes just the current jti when allDevices=false', async () => {
      tokens.verifyRefresh.mockResolvedValue({ sub: 'u1', jti: 'j1', typ: 'refresh' });
      await service.logout('u1', 'tokenstring', false);
      expect(tokens.revokeRefresh).toHaveBeenCalledWith('u1', 'j1');
    });

    it('is idempotent on invalid token (swallow)', async () => {
      tokens.verifyRefresh.mockRejectedValue(new Error('bad'));
      await expect(service.logout('u1', 'x', false)).resolves.toBeUndefined();
    });
  });

  describe('changePassword (B-04)', () => {
    it('rejects when current password is wrong', async () => {
      const hash = await bcrypt.hash('realold', 4);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: hash } as never);
      await expect(
        service.changePassword('u1', { currentPassword: 'wrong', newPassword: 'newpass12' }),
      ).rejects.toMatchObject({
        response: { error: 'invalid_credentials', code: ErrorCodes.INVALID_CREDENTIALS },
      });
    });

    it('rejects when user has no password hash', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: null } as never);
      await expect(
        service.changePassword('u1', { currentPassword: 'x', newPassword: 'newpass12' }),
      ).rejects.toMatchObject({
        response: { error: 'invalid_credentials', code: ErrorCodes.INVALID_CREDENTIALS },
      });
    });

    it('updates hash and revokes all refresh sessions', async () => {
      const hash = await bcrypt.hash('oldpass12', 4);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: hash } as never);
      prisma.user.update.mockResolvedValue({ id: 'u1' } as never);
      tokens.revokeAllForUser.mockResolvedValue(3);

      const out = await service.changePassword('u1', {
        currentPassword: 'oldpass12',
        newPassword: 'newpass34',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: expect.any(String) },
      });
      expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
      expect(out.success).toBe(true);
      expect(out.revokedSessions).toBe(3);
    });
  });

  describe('forgotPassword (B-05)', () => {
    it('returns success without DB mail work when user is missing', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const out = await service.forgotPassword({ email: 'nobody@example.com' });
      expect(out).toEqual({ success: true });
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(passwordResetMail.enqueue).not.toHaveBeenCalled();
    });

    it('returns success when user has no password (OAuth-only)', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        passwordHash: null,
        deletedAt: null,
        isBanned: false,
      } as never);
      const out = await service.forgotPassword({ email: 'a@example.com' });
      expect(out.success).toBe(true);
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('creates token row and enqueues mail when eligible', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        passwordHash: 'hash',
        deletedAt: null,
        isBanned: false,
      } as never);
      prisma.passwordResetToken.create.mockResolvedValue({ id: 't1' } as never);

      const out = await service.forgotPassword({ email: 'a@example.com' });

      expect(out.success).toBe(true);
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', usedAt: null },
      });
      expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
      const createArg = prisma.passwordResetToken.create.mock.calls[0]![0];
      expect(createArg.data.userId).toBe('u1');
      expect(createArg.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(passwordResetMail.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          email: 'a@example.com',
          resetToken: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      );
    });
  });

  describe('resetPassword (B-05)', () => {
    it('rejects invalid token with BadRequestException', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: 'a'.repeat(32), newPassword: 'newpass12' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.resetPassword({ token: 'a'.repeat(32), newPassword: 'newpass12' }),
      ).rejects.toMatchObject({
        response: { error: 'reset_token_invalid', code: ErrorCodes.VALIDATION_FAILED },
      });
    });

    it('updates password, marks token used, revokes refresh sessions', async () => {
      const plain = 'b'.repeat(32);
      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'pr1',
        userId: 'u1',
        user: { id: 'u1', isBanned: false, deletedAt: null },
      } as never);
      prisma.passwordResetToken.update.mockResolvedValue({} as never);
      prisma.user.update.mockResolvedValue({} as never);
      tokens.revokeAllForUser.mockResolvedValue(2);

      const out = await service.resetPassword({ token: plain, newPassword: 'newpass12' });

      expect(prisma.passwordResetToken.findFirst).toHaveBeenCalledWith({
        where: {
          tokenHash: hashPasswordResetToken(plain),
          usedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        include: { user: { select: { id: true, isBanned: true, deletedAt: true } } },
      });
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'pr1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: expect.any(String) },
      });
      expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
      expect(out.success).toBe(true);
      expect(out.revokedSessions).toBe(2);
    });
  });

  describe('requestEmailChange (B-07)', () => {
    it('rejects wrong password', async () => {
      const hash = await bcrypt.hash('good', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'old@example.com',
        passwordHash: hash,
      } as never);
      await expect(
        service.requestEmailChange('u1', { newEmail: 'new@example.com', password: 'bad' }),
      ).rejects.toMatchObject({
        response: { error: 'invalid_credentials', code: ErrorCodes.INVALID_CREDENTIALS },
      });
    });

    it('rejects when new email equals current', async () => {
      const hash = await bcrypt.hash('pw', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'Same@Example.com',
        passwordHash: hash,
      } as never);
      await expect(
        service.requestEmailChange('u1', { newEmail: 'same@example.com', password: 'pw' }),
      ).rejects.toMatchObject({
        response: { error: 'email_unchanged', code: ErrorCodes.VALIDATION_FAILED },
      });
    });

    it('rejects when email is taken', async () => {
      const hash = await bcrypt.hash('pw', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'old@example.com',
        passwordHash: hash,
      } as never);
      prisma.user.findFirst.mockResolvedValue({ id: 'u2' } as never);
      await expect(
        service.requestEmailChange('u1', { newEmail: 'taken@example.com', password: 'pw' }),
      ).rejects.toMatchObject({
        response: { error: 'email_taken', code: ErrorCodes.CONFLICT },
      });
    });

    it('creates token, sets pendingEmail, enqueues mail', async () => {
      const hash = await bcrypt.hash('pw', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'old@example.com',
        passwordHash: hash,
      } as never);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.emailChangeToken.deleteMany.mockResolvedValue({ count: 0 } as never);

      const out = await service.requestEmailChange('u1', {
        newEmail: 'New@Example.com',
        password: 'pw',
      });

      expect(out.success).toBe(true);
      expect(out.pendingEmail).toBe('new@example.com');
      expect(prisma.emailChangeToken.deleteMany).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: { pendingEmail: 'new@example.com' },
        }),
      );
      expect(prisma.emailChangeToken.create).toHaveBeenCalled();
      expect(emailChangeMail.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          email: 'old@example.com',
          newEmail: 'new@example.com',
          verifyToken: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      );
    });
  });

  describe('verifyEmailChange (B-07)', () => {
    it('rejects invalid token', async () => {
      prisma.emailChangeToken.findFirst.mockResolvedValue(null);
      await expect(service.verifyEmailChange({ token: 'x'.repeat(32) })).rejects.toMatchObject({
        response: { error: 'email_change_token_invalid', code: ErrorCodes.VALIDATION_FAILED },
      });
    });

    it('applies new email and revokes refresh sessions', async () => {
      const plain = 'y'.repeat(32);
      prisma.emailChangeToken.findFirst.mockResolvedValue({
        id: 'ec1',
        userId: 'u1',
        newEmail: 'next@example.com',
        user: {
          id: 'u1',
          pendingEmail: 'next@example.com',
          isBanned: false,
          deletedAt: null,
        },
      } as never);
      prisma.emailChangeToken.update.mockResolvedValue({} as never);
      prisma.user.update.mockResolvedValue({} as never);
      tokens.revokeAllForUser.mockResolvedValue(1);

      const out = await service.verifyEmailChange({ token: plain });

      expect(out.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { email: 'next@example.com', pendingEmail: null },
      });
      expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
    });
  });

  describe('requestOtp / verifyOtp (B-16)', () => {
    it('requestOtp no-op when phone not registered', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const r = await service.requestOtp({ phoneNumber: '+905551234567' });
      expect(r.success).toBe(true);
      expect(prisma.otpCode.create).not.toHaveBeenCalled();
    });

    it('requestOtp creates row when user exists', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' } as never);
      prisma.otpCode.findFirst.mockResolvedValue(null);
      prisma.otpCode.updateMany.mockResolvedValue({ count: 0 } as never);
      prisma.otpCode.create.mockResolvedValue({ id: 'o1' } as never);
      const r = await service.requestOtp({ phoneNumber: '+905551234567' });
      expect(r.success).toBe(true);
      expect(prisma.otpCode.create).toHaveBeenCalled();
    });

    it('verifyOtp succeeds and sets phoneVerified when user matches', async () => {
      const hash = await bcrypt.hash('654321', 10);
      prisma.otpCode.findFirst.mockResolvedValue({
        id: 'o1',
        phone: '+905551234567',
        codeHash: hash,
        attemptCount: 0,
        createdAt: new Date(),
      } as never);
      prisma.otpCode.update.mockResolvedValue({} as never);
      prisma.user.updateMany.mockResolvedValue({ count: 1 } as never);
      const out = await service.verifyOtp({ phoneNumber: '+905551234567', code: '654321' });
      expect(out.success).toBe(true);
      expect(out.phoneVerified).toBe(true);
    });
  });

  describe('appleSignIn / googleSignIn (OAuth)', () => {
    const tokenPair = {
      accessToken: 'a',
      refreshToken: 'r',
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 7 * 24 * 3600,
    };

    it('503 when APPLE_CLIENT_ID missing', async () => {
      config.get.mockReturnValue(undefined);
      await expect(
        service.appleSignIn({
          identityToken: 't',
          eulaAccepted: true,
          preferredLanguage: 'tr',
        }),
      ).rejects.toMatchObject({
        response: { code: ErrorCodes.OAUTH_NOT_CONFIGURED },
      });
    });

    it('Apple: issues session for existing user by appleSub without create', async () => {
      config.get.mockImplementation((k: string) => (k === 'APPLE_CLIENT_ID' ? 'com.app' : undefined));
      jest.mocked(oauthVerify.verifyAppleIdentityToken).mockResolvedValue({
        sub: 'apple_sub_x',
        email: 'x@example.com',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        username: 'bob',
        role: 'USER',
        isBanned: false,
        deletedAt: null,
      } as never);
      prisma.user.update.mockResolvedValue({} as never);
      tokens.issueTokenPair.mockResolvedValue(tokenPair);

      const out = await service.appleSignIn({
        identityToken: 'jwt',
        eulaAccepted: true,
        preferredLanguage: 'tr',
      });

      expect(out.userId).toBe('u1');
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(events.emit).toHaveBeenCalled();
    });

    it('Apple: creates user when token valid and email free', async () => {
      config.get.mockImplementation((k: string) => (k === 'APPLE_CLIENT_ID' ? 'com.app' : undefined));
      jest.mocked(oauthVerify.verifyAppleIdentityToken).mockResolvedValue({
        sub: 'apple_new',
        email: 'new@example.com',
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u-oauth',
        username: 'new_abcdef',
        role: 'USER',
        isBanned: false,
        deletedAt: null,
      } as never);
      prisma.user.update.mockResolvedValue({} as never);
      tokens.issueTokenPair.mockResolvedValue(tokenPair);

      const out = await service.appleSignIn({
        identityToken: 'jwt',
        eulaAccepted: true,
        preferredLanguage: 'en',
      });

      expect(out.userId).toBe('u-oauth');
      expect(prisma.user.create).toHaveBeenCalled();
      expect(oauthVerify.verifyAppleIdentityToken).toHaveBeenCalledWith('jwt', 'com.app');
    });

    it('503 when GOOGLE_CLIENT_IDS missing', async () => {
      config.get.mockReturnValue(undefined);
      await expect(
        service.googleSignIn({
          idToken: 't',
          eulaAccepted: true,
          preferredLanguage: 'tr',
        }),
      ).rejects.toMatchObject({
        response: { code: ErrorCodes.OAUTH_NOT_CONFIGURED },
      });
    });

    it('Google: creates user when token valid', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'GOOGLE_CLIENT_IDS' ? 'web-id, ios-id' : undefined,
      );
      jest.mocked(oauthVerify.verifyGoogleIdToken).mockResolvedValue({
        sub: 'g_sub',
        email: 'g@example.com',
        name: 'G User',
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u-g',
        username: 'g_x',
        role: 'USER',
        isBanned: false,
        deletedAt: null,
      } as never);
      prisma.user.update.mockResolvedValue({} as never);
      tokens.issueTokenPair.mockResolvedValue(tokenPair);

      const out = await service.googleSignIn({
        idToken: 'google-jwt',
        eulaAccepted: true,
        preferredLanguage: 'tr',
      });

      expect(out.userId).toBe('u-g');
      expect(oauthVerify.verifyGoogleIdToken).toHaveBeenCalledWith('google-jwt', ['web-id', 'ios-id']);
    });
  });
});
