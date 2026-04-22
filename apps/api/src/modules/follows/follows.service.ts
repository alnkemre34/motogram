import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCodes, GamificationTriggerPayloadSchema } from '@motogram/shared';

import { ZodEventBus } from '../../common/events/zod-event-bus.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ZodEventBus,
  ) {}

  // Spec 8.7.1 - Takip: dakikada 20 (controller seviyesinde @Throttle ile)
  async follow(followerId: string, followingId: string): Promise<{ status: string }> {
    if (followerId === followingId) {
      throw new BadRequestException({
        error: 'cannot_follow_self',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }

    const target = await this.prisma.user.findFirst({
      where: { id: followingId, deletedAt: null, isBanned: false },
      select: { id: true, isPrivate: true },
    });
    if (!target) {
      throw new NotFoundException({ error: 'user_not_found', code: ErrorCodes.NOT_FOUND });
    }

    // Engelleme kontrolu (tek yonlu da olsa takip acilmasin - Spec 7.2.2)
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { initiatorId: followerId, targetId: followingId },
          { initiatorId: followingId, targetId: followerId },
        ],
      },
    });
    if (block) {
      throw new BadRequestException({ error: 'blocked', code: ErrorCodes.BLOCKED });
    }

    const status = target.isPrivate ? 'PENDING' : 'ACCEPTED';

    await this.prisma.$transaction(async (tx) => {
      await tx.follow.upsert({
        where: { followerId_followingId: { followerId, followingId } },
        update: { status },
        create: { followerId, followingId, status },
      });
      if (status === 'ACCEPTED') {
        await tx.user.update({
          where: { id: followingId },
          data: { followersCount: { increment: 1 } },
        });
        await tx.user.update({
          where: { id: followerId },
          data: { followingCount: { increment: 1 } },
        });
      }
    });

    // Spec 3.6 - FOLLOW_GAINED trigger: takipci kazanilan kullaniciya XP gonder.
    if (status === 'ACCEPTED') {
      this.events.emit('gamification.trigger', GamificationTriggerPayloadSchema, {
        userId: followingId,
        trigger: 'FOLLOW_GAINED',
        increment: 1,
        metadata: { followerId },
      });
    }

    return { status };
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (!existing) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      });
      if (existing.status === 'ACCEPTED') {
        await tx.user.update({
          where: { id: followingId },
          data: { followersCount: { decrement: 1 } },
        });
        await tx.user.update({
          where: { id: followerId },
          data: { followingCount: { decrement: 1 } },
        });
      }
    });
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const f = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return f?.status === 'ACCEPTED';
  }
}
