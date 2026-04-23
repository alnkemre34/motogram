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
      select: { ...this.publicSelect(), email: true, settings: true },
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

  // Spec 7.2.1 - Hesap silme: 30 gun soft delete, sonra BullMQ ile fiziksel
  async requestAccountDeletion(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
    // Faz 6'da DELETE_USER_DATA BullMQ job'i eklenecek (Spec 7.2.1)
  }

  async cancelAccountDeletion(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    });
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
