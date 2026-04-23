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

  /** Batch-resolve whether viewer liked each post (B-01). */
  private async attachLikedByMe<T extends { id: string }>(
    viewerId: string,
    rows: T[],
  ): Promise<Array<T & { likedByMe: boolean }>> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const likes = await this.prisma.like.findMany({
      where: { userId: viewerId, postId: { in: ids } },
      select: { postId: true },
    });
    const liked = new Set(likes.map((l) => l.postId));
    return rows.map((r) => ({ ...r, likedByMe: liked.has(r.id) }));
  }

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
    const enriched = await this.attachLikedByMe(userId, [post]);
    return enriched[0]!;
  }

  async findById(id: string, viewerId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, deletedAt: null },
    });
    if (!post) {
      throw new NotFoundException({ error: 'post_not_found', code: ErrorCodes.NOT_FOUND });
    }
    const enriched = await this.attachLikedByMe(viewerId, [post]);
    return enriched[0]!;
  }

  async update(userId: string, id: string, dto: UpdatePostDto) {
    const post = await this.findById(id, userId);
    if (post.userId !== userId) {
      throw new ForbiddenException({ error: 'forbidden', code: ErrorCodes.FORBIDDEN });
    }
    const updated = await this.prisma.post.update({
      where: { id },
      data: dto,
    });
    const enriched = await this.attachLikedByMe(userId, [updated]);
    return enriched[0]!;
  }

  async remove(userId: string, id: string): Promise<void> {
    const post = await this.prisma.post.findFirst({
      where: { id, deletedAt: null },
    });
    if (!post) {
      throw new NotFoundException({ error: 'post_not_found', code: ErrorCodes.NOT_FOUND });
    }
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

    const items = await this.attachLikedByMe(userId, posts);
    return {
      items,
      nextCursor: posts.length === query.limit ? posts[posts.length - 1]!.id : null,
    };
  }

  async userPosts(profileUserId: string, viewerId: string, query: PostFeedQueryDto) {
    const posts = query.cursor
      ? await this.prisma.post.findMany({
          where: { userId: profileUserId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          cursor: { id: query.cursor },
          skip: 1,
        })
      : await this.prisma.post.findMany({
          where: { userId: profileUserId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: query.limit,
        });
    const items = await this.attachLikedByMe(viewerId, posts);
    return {
      items,
      nextCursor: posts.length === query.limit ? posts[posts.length - 1]!.id : null,
    };
  }
}
