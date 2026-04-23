import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ErrorCodes } from '@motogram/shared';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import type { TokenService } from './token.service';

// Tests validate SPEC behaviors:
// - Spec 9.2: register must create user, set EULA timestamp, issue token pair
// - Spec 9.4: errors must use { error, code } standard format
// - Spec 8.6: refresh rotation - old jti revoked, new pair issued
// - Spec 8.6: invalid/revoked refresh tokens must fail with TOKEN_INVALID
// - Spec 9.2: login with wrong password must fail with INVALID_CREDENTIALS

function createPrismaMock() {
  return {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as const;
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

  beforeEach(() => {
    prisma = createPrismaMock();
    tokens = createTokenServiceMock();
    events = { emit: jest.fn(() => true) };
    service = new AuthService(prisma as never, tokens, events as never);
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
});
