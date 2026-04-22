import { Injectable } from '@nestjs/common';
import { GamificationTriggerPayloadSchema, type CreateStoryDto } from '@motogram/shared';
import { Prisma } from '@prisma/client';

import { ZodEventBus } from '../../common/events/zod-event-bus.service';
import { PrismaService } from '../prisma/prisma.service';

// Spec 2.2 - Hikaye 24 saat sonra expire olur
const STORY_TTL_HOURS = 24;

@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ZodEventBus,
  ) {}

  async create(userId: string, dto: CreateStoryDto) {
    const expiresAt = new Date(Date.now() + STORY_TTL_HOURS * 60 * 60 * 1000);
    const story = await this.prisma.story.create({
      data: {
        userId,
        mediaUrl: dto.mediaUrl,
        mediaType: dto.mediaType,
        caption: dto.caption ?? null,
        locationSticker: dto.locationSticker
          ? (dto.locationSticker as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        garageSticker: dto.garageSticker
          ? (dto.garageSticker as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        expiresAt,
      },
    });
    // Spec 3.6 - STORY_CREATED trigger
    this.events.emit('gamification.trigger', GamificationTriggerPayloadSchema, {
      userId,
      trigger: 'STORY_CREATED',
      increment: 1,
      metadata: { storyId: story.id },
    });
    return story;
  }

  async activeForFollowing(userId: string) {
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      select: { followingId: true },
    });
    const authorIds = [userId, ...following.map((f) => f.followingId)];
    return this.prisma.story.findMany({
      where: {
        userId: { in: authorIds },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
  }

  async recordView(storyId: string, viewerId: string): Promise<void> {
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true },
    });
    if (!story || story.userId === viewerId) {
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.storyView.findUnique({
        where: { storyId_viewerId: { storyId, viewerId } },
      });
      if (existing) {
        return;
      }
      await tx.storyView.create({ data: { storyId, viewerId } });
      await tx.story.update({
        where: { id: storyId },
        data: { viewsCount: { increment: 1 } },
      });
    });
  }
}
