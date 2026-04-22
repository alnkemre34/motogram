import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCodes,
  GamificationTriggerPayloadSchema,
  type CreatePostDto,
  type PostFeedQueryDto,
  type UpdatePostDto,
} from '@motogram/shared';

import { ZodEventBus } from '../../common/events/zod-event-bus.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ZodEventBus,
  ) {}

  async create(userId: string, dto: CreatePostDto) {
    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          userId,
          caption: dto.caption ?? null,
          mediaUrls: dto.mediaUrls,
          mediaType: dto.mediaType,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          locationName: dto.locationName ?? null,
          hashtags: dto.hashtags,
          mentionedUserIds: dto.mentionedUserIds,
          routeId: dto.routeId ?? null,
          eventId: dto.eventId ?? null,
          groupId: dto.groupId ?? null,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { postsCount: { increment: 1 } },
      });
      return created;
    });
    // Spec 3.6 - POST_CREATED trigger
    this.events.emit('gamification.trigger', GamificationTriggerPayloadSchema, {
      userId,
      trigger: 'POST_CREATED',
      increment: 1,
      metadata: { postId: post.id },
    });
    return post;
  }

  async findById(id: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, deletedAt: null },
    });
    if (!post) {
      throw new NotFoundException({ error: 'post_not_found', code: ErrorCodes.NOT_FOUND });
    }
    return post;
  }

  async update(userId: string, id: string, dto: UpdatePostDto) {
    const post = await this.findById(id);
    if (post.userId !== userId) {
      throw new ForbiddenException({ error: 'forbidden', code: ErrorCodes.FORBIDDEN });
    }
    return this.prisma.post.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const post = await this.findById(id);
    if (post.userId !== userId) {
      throw new ForbiddenException({ error: 'forbidden', code: ErrorCodes.FORBIDDEN });
    }
    // Spec 8.11.4 Soft delete
    await this.prisma.$transaction(async (tx) => {
      await tx.post.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.user.update({
        where: { id: userId },
        data: { postsCount: { decrement: 1 } },
      });
    });
  }

  // Spec 8.8 - Feed light ranking (basit versiyon: following + kendi postlari)
  // Spec 8.8.2 scoring Faz 2'de daha rafine olacak; Faz 1 MVP olarak
  // takipedilenlerin postlari + kendisinin postlari kronolojik.
  async feedForUser(userId: string, query: PostFeedQueryDto) {
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      select: { followingId: true },
    });
    const authorIds = [userId, ...following.map((f) => f.followingId)];

    const include = {
      user: {
        select: { id: true, username: true, avatarUrl: true, isVerified: true },
      },
    } as const;

    const posts = query.cursor
      ? await this.prisma.post.findMany({
          where: { userId: { in: authorIds }, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          cursor: { id: query.cursor },
          skip: 1,
          include,
        })
      : await this.prisma.post.findMany({
          where: { userId: { in: authorIds }, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          include,
        });

    return {
      items: posts,
      nextCursor: posts.length === query.limit ? posts[posts.length - 1]!.id : null,
    };
  }

  async userPosts(userId: string, query: PostFeedQueryDto) {
    const posts = query.cursor
      ? await this.prisma.post.findMany({
          where: { userId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          cursor: { id: query.cursor },
          skip: 1,
        })
      : await this.prisma.post.findMany({
          where: { userId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: query.limit,
        });
    return {
      items: posts,
      nextCursor: posts.length === query.limit ? posts[posts.length - 1]!.id : null,
    };
  }
}
