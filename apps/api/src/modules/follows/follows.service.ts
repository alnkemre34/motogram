import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCodes,
  GamificationTriggerPayloadSchema,
  type FollowListQueryDto,
} from '@motogram/shared';

import { ZodEventBus } from '../../common/events/zod-event-bus.service';
import { PrismaService } from '../prisma/prisma.service';

const FOLLOW_LIST_USER_SELECT = {
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

type FollowListUserRow = {
  id: string;
  username: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  city: string | null;
  country: string | null;
  ridingStyle: string[];
  isPrivate: boolean;
  isVerified: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  xp: number;
  level: number;
  createdAt: Date;
};

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

  /** B-09 — ACCEPTED takipçiler; blok ilişkisindeki kullanıcılar listeden çıkar. */
  async listFollowersForProfile(viewerId: string, profileUserId: string, query: FollowListQueryDto) {
    await this.assertViewableUser(profileUserId);
    const blocked = await this.viewerBlockedPeerIds(viewerId);
    const limit = query.limit;
    const cursor = query.cursor;
    const rows = await this.prisma.follow.findMany({
      where: {
        followingId: profileUserId,
        status: 'ACCEPTED',
        ...(blocked.length ? { followerId: { notIn: blocked } } : {}),
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      include: { follower: { select: FOLLOW_LIST_USER_SELECT } },
    });
    return await this.pageToFollowListResponse(viewerId, rows, limit);
  }

  /** B-09 — ACCEPTED takip edilenler; blok filtresi aynı. */
  async listFollowingForProfile(viewerId: string, profileUserId: string, query: FollowListQueryDto) {
    await this.assertViewableUser(profileUserId);
    const blocked = await this.viewerBlockedPeerIds(viewerId);
    const limit = query.limit;
    const cursor = query.cursor;
    const rows = await this.prisma.follow.findMany({
      where: {
        followerId: profileUserId,
        status: 'ACCEPTED',
        ...(blocked.length ? { followingId: { notIn: blocked } } : {}),
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      include: { following: { select: FOLLOW_LIST_USER_SELECT } },
    });
    return await this.pageToFollowingListResponse(viewerId, rows, limit);
  }

  private async assertViewableUser(userId: string): Promise<void> {
    const u = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isBanned: false },
      select: { id: true },
    });
    if (!u) {
      throw new NotFoundException({ error: 'user_not_found', code: ErrorCodes.NOT_FOUND });
    }
  }

  /** Bloklanan veya bloklayan kullanıcı id’leri (viewer kendisi dahil değil). */
  private async viewerBlockedPeerIds(viewerId: string): Promise<string[]> {
    const rows = await this.prisma.block.findMany({
      where: { OR: [{ initiatorId: viewerId }, { targetId: viewerId }] },
      select: { initiatorId: true, targetId: true },
    });
    const ids = new Set<string>();
    for (const r of rows) {
      if (r.initiatorId === viewerId) {
        ids.add(r.targetId);
      } else {
        ids.add(r.initiatorId);
      }
    }
    return [...ids];
  }

  private async batchIsFollowedByMe(viewerId: string, targetUserIds: string[]): Promise<Set<string>> {
    if (targetUserIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.follow.findMany({
      where: {
        followerId: viewerId,
        followingId: { in: targetUserIds },
        status: 'ACCEPTED',
      },
      select: { followingId: true },
    });
    return new Set(rows.map((r) => r.followingId));
  }

  private async pageToFollowListResponse(
    viewerId: string,
    rows: { id: string; follower: FollowListUserRow }[],
    limit: number,
  ) {
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const ids = page.map((r) => r.follower.id);
    return await this.buildFollowListPage(viewerId, page.map((r) => r.follower), ids, hasMore, page);
  }

  private async pageToFollowingListResponse(
    viewerId: string,
    rows: { id: string; following: FollowListUserRow }[],
    limit: number,
  ) {
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const ids = page.map((r) => r.following.id);
    return await this.buildFollowListPage(viewerId, page.map((r) => r.following), ids, hasMore, page);
  }

  private async buildFollowListPage(
    viewerId: string,
    users: FollowListUserRow[],
    idsForFollowCheck: string[],
    hasMore: boolean,
    followRows: { id: string }[],
  ) {
    const followed = await this.batchIsFollowedByMe(viewerId, idsForFollowCheck);
    return {
      items: users.map((u) => ({ ...u, isFollowedByMe: followed.has(u.id) })),
      nextCursor: hasMore ? followRows[followRows.length - 1]!.id : null,
    };
  }
}
