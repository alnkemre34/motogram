import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCodes,
  isReservedUsername,
  normalizeUsernameForStorage,
  type ChangeUsernameDto,
  type UpdateProfileDto,
  type UserSearchQueryDto,
} from '@motogram/shared';

import { PrismaService } from '../prisma/prisma.service';

const USERNAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfileByUsername(username: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: username.trim(), mode: 'insensitive' },
        deletedAt: null,
        isBanned: false,
      },
      select: this.publicSelect(),
    });
    if (!user) {
      throw new NotFoundException({ error: 'user_not_found', code: ErrorCodes.NOT_FOUND });
    }
    return user;
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        ...this.publicSelect(),
        email: true,
        pendingEmail: true,
        phoneNumber: true,
        phoneVerifiedAt: true,
        settings: true,
      },
    });
    if (!user) {
      throw new NotFoundException({ error: 'user_not_found', code: ErrorCodes.NOT_FOUND });
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: this.publicSelect(),
    });
  }

  /** B-06 — 30 gün cooldown, rezerv liste, küçük harf depo; çakışma 409. */
  async changeUsername(userId: string, dto: ChangeUsernameDto) {
    const next = normalizeUsernameForStorage(dto.username);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, username: true, usernameChangedAt: true },
    });
    if (!user) {
      throw new NotFoundException({ error: 'user_not_found', code: ErrorCodes.NOT_FOUND });
    }
    if (normalizeUsernameForStorage(user.username) === next) {
      return this.prisma.user.findFirstOrThrow({
        where: { id: userId },
        select: this.publicSelect(),
      });
    }
    if (isReservedUsername(next)) {
      throw new BadRequestException({
        error: 'username_reserved',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
    if (user.usernameChangedAt) {
      const elapsed = Date.now() - user.usernameChangedAt.getTime();
      if (elapsed < USERNAME_CHANGE_COOLDOWN_MS) {
        throw new BadRequestException({
          error: 'username_change_cooldown',
          code: ErrorCodes.VALIDATION_FAILED,
        });
      }
    }
    const taken = await this.prisma.user.findFirst({
      where: {
        id: { not: userId },
        username: { equals: next, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException({
        error: 'username_taken',
        code: ErrorCodes.CONFLICT,
      });
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { username: next, usernameChangedAt: new Date() },
      select: this.publicSelect(),
    });
  }

  /** B-08 — Kullanıcı adı prefix veya isim içerir; blok ilişkisi + kendin hariç. */
  async searchUsers(viewerId: string, query: UserSearchQueryDto) {
    const q = query.q.trim();
    const limit = query.limit;
    const cursor = query.cursor;
    const excluded = await this.blockRelatedUserIds(viewerId);
    const rows = await this.prisma.user.findMany({
      where: {
        id: { notIn: excluded },
        deletedAt: null,
        isBanned: false,
        OR: [
          { username: { startsWith: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      select: this.publicSelect(),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };
  }

  /** İki yönlü blok: viewer başlattıysa hedef, başkası viewer’ı blokladıysa initiator hariç tutulur. */
  private async blockRelatedUserIds(viewerId: string): Promise<string[]> {
    const rows = await this.prisma.block.findMany({
      where: { OR: [{ initiatorId: viewerId }, { targetId: viewerId }] },
      select: { initiatorId: true, targetId: true },
    });
    const ids = new Set<string>([viewerId]);
    for (const r of rows) {
      if (r.initiatorId === viewerId) {
        ids.add(r.targetId);
      } else {
        ids.add(r.initiatorId);
      }
    }
    return [...ids];
  }

  private publicSelect() {
    return {
      id: true,
      username: true,
      name: true,
      bio: true,
      avatarUrl: true,
      coverImageUrl: true,
      city: true,
      country: true,
      ridingStyle: true,
      isPrivate: true,
      isVerified: true,
      followersCount: true,
      followingCount: true,
      postsCount: true,
      xp: true,
      level: true,
      createdAt: true,
    } as const;
  }
}
