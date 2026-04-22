import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCodes, type UpdateProfileDto } from '@motogram/shared';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfileByUsername(username: string) {
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null, isBanned: false },
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
