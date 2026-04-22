import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCodes,
  type CommunityDetail,
  type CommunitySummary,
  type CreateCommunityDto,
  type JoinCommunityDto,
  type NearbyCommunitiesQueryDto,
  type RespondCommunityJoinDto,
  type UpdateCommunityDto,
  type UpdateCommunityMemberRoleDto,
} from '@motogram/shared';
import type {
  Community,
  CommunityRole as PrismaCommunityRole,
  MemberStatus as PrismaMemberStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

// Spec 2.4.2 / 2.4.3 / 3.2 / 8.1 - Community servisi.
// - Public: join -> ACTIVE instant
// - Private: join -> PENDING (owner/admin onayi)
// - Hidden: davet zorunlu + listelerden gizli
// - Roles: OWNER > ADMIN > MODERATOR > MEMBER
// - PostGIS: find_communities_within(lat, lng, radius_m) -> ST_DWithin

type CommunityRow = Community & { members?: Array<{ role: PrismaCommunityRole; status: PrismaMemberStatus; userId: string }> };

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  async createCommunity(ownerId: string, dto: CreateCommunityDto): Promise<CommunityDetail> {
    const community = await this.prisma.$transaction(async (tx) => {
      const created = await tx.community.create({
        data: {
          ownerId,
          name: dto.name,
          description: dto.description,
          avatarUrl: dto.avatarUrl,
          coverImageUrl: dto.coverImageUrl,
          visibility: dto.visibility,
          region: dto.region,
          tags: dto.tags,
          rules: dto.rules,
          latitude: dto.latitude,
          longitude: dto.longitude,
          membersCount: 1,
        },
      });
      await tx.communityMember.create({
        data: {
          communityId: created.id,
          userId: ownerId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });
      return created;
    });
    return this.toDetail(community, 'OWNER', 'ACTIVE');
  }

  async updateCommunity(
    userId: string,
    communityId: string,
    dto: UpdateCommunityDto,
  ): Promise<CommunityDetail> {
    await this.requireRole(communityId, userId, ['OWNER', 'ADMIN']);
    const updated = await this.prisma.community.update({
      where: { id: communityId },
      data: dto,
    });
    const membership = await this.getMembership(communityId, userId);
    return this.toDetail(updated, membership?.role ?? null, membership?.status ?? null);
  }

  async getCommunityDetail(
    communityId: string,
    viewerId: string | null,
  ): Promise<CommunityDetail> {
    const community = await this.prisma.community.findFirst({
      where: { id: communityId, deletedAt: null },
    });
    if (!community) {
      throw new NotFoundException({
        error: 'Community not found',
        code: ErrorCodes.NOT_FOUND,
      });
    }
    const membership = viewerId ? await this.getMembership(communityId, viewerId) : null;
    if (community.visibility === 'HIDDEN' && (!membership || membership.status !== 'ACTIVE')) {
      throw new NotFoundException({
        error: 'Community not found',
        code: ErrorCodes.NOT_FOUND,
      });
    }
    return this.toDetail(community, membership?.role ?? null, membership?.status ?? null);
  }

  // Spec 2.4.2 - kullanicinin aktif topluluklari (Profil > Topluluklar sekmesi)
  async listMine(userId: string): Promise<CommunitySummary[]> {
    const memberships = await this.prisma.communityMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { community: true },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships
      .filter((m) => m.community && m.community.deletedAt === null)
      .map((m) => this.toSummary(m.community));
  }

  async listMembers(
    communityId: string,
    viewerId: string,
  ): Promise<
    Array<{
      userId: string;
      username: string;
      avatarUrl: string | null;
      role: PrismaCommunityRole;
      status: PrismaMemberStatus;
      joinedAt: string;
    }>
  > {
    await this.assertViewable(communityId, viewerId);
    const rows = await this.prisma.communityMember.findMany({
      where: { communityId, status: 'ACTIVE' },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    return rows.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl ?? null,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt.toISOString(),
    }));
  }

  // Spec 2.4.2 - katilma istegi. Public -> ACTIVE, Private/Hidden -> PENDING
  async joinCommunity(userId: string, dto: JoinCommunityDto): Promise<{
    community: CommunityDetail;
    status: PrismaMemberStatus;
  }> {
    const community = await this.prisma.community.findFirst({
      where: { id: dto.communityId, deletedAt: null },
    });
    if (!community) {
      throw new NotFoundException({
        error: 'Community not found',
        code: ErrorCodes.NOT_FOUND,
      });
    }
    const existing = await this.getMembership(dto.communityId, userId);
    if (existing && existing.status === 'ACTIVE') {
      return { community: this.toDetail(community, existing.role, existing.status), status: existing.status };
    }
    if (existing && existing.status === 'BANNED') {
      throw new ForbiddenException({
        error: 'User is banned from this community',
        code: ErrorCodes.FORBIDDEN,
      });
    }
    const nextStatus: PrismaMemberStatus =
      community.visibility === 'PUBLIC' ? 'ACTIVE' : 'PENDING';

    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.communityMember.update({
          where: { communityId_userId: { communityId: dto.communityId, userId } },
          data: { status: nextStatus, joinedAt: new Date() },
        });
      } else {
        await tx.communityMember.create({
          data: {
            communityId: dto.communityId,
            userId,
            role: 'MEMBER',
            status: nextStatus,
          },
        });
      }
      if (nextStatus === 'ACTIVE') {
        await tx.community.update({
          where: { id: dto.communityId },
          data: { membersCount: { increment: 1 } },
        });
      }
    });

    return {
      community: this.toDetail(community, 'MEMBER', nextStatus),
      status: nextStatus,
    };
  }

  // Spec 2.4.2 - ozel topluluklarda owner/admin PENDING istegi onaylar/reddeder.
  async respondJoinRequest(
    actorUserId: string,
    dto: RespondCommunityJoinDto,
  ): Promise<{ status: PrismaMemberStatus | 'REJECTED' }> {
    await this.requireRole(dto.communityId, actorUserId, ['OWNER', 'ADMIN']);
    const membership = await this.getMembership(dto.communityId, dto.userId);
    if (!membership || membership.status !== 'PENDING') {
      throw new BadRequestException({
        error: 'No pending request found',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
    if (dto.accept) {
      await this.prisma.$transaction(async (tx) => {
        await tx.communityMember.update({
          where: { communityId_userId: { communityId: dto.communityId, userId: dto.userId } },
          data: { status: 'ACTIVE', joinedAt: new Date() },
        });
        await tx.community.update({
          where: { id: dto.communityId },
          data: { membersCount: { increment: 1 } },
        });
      });
      return { status: 'ACTIVE' };
    }
    await this.prisma.communityMember.delete({
      where: { communityId_userId: { communityId: dto.communityId, userId: dto.userId } },
    });
    return { status: 'REJECTED' };
  }

  async leaveCommunity(userId: string, communityId: string): Promise<void> {
    const membership = await this.getMembership(communityId, userId);
    if (!membership || membership.status !== 'ACTIVE') {
      return;
    }
    if (membership.role === 'OWNER') {
      throw new ForbiddenException({
        error: 'Owner cannot leave without transferring ownership',
        code: ErrorCodes.FORBIDDEN,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.communityMember.delete({
        where: { communityId_userId: { communityId, userId } },
      });
      await tx.community.update({
        where: { id: communityId },
        data: { membersCount: { decrement: 1 } },
      });
    });
  }

  async updateMemberRole(
    actorUserId: string,
    dto: UpdateCommunityMemberRoleDto,
  ): Promise<void> {
    await this.requireRole(dto.communityId, actorUserId, ['OWNER']);
    if (dto.role === 'OWNER') {
      throw new BadRequestException({
        error: 'Use transferOwnership to assign OWNER role',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
    const membership = await this.getMembership(dto.communityId, dto.userId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException({
        error: 'Member not found',
        code: ErrorCodes.NOT_FOUND,
      });
    }
    await this.prisma.communityMember.update({
      where: { communityId_userId: { communityId: dto.communityId, userId: dto.userId } },
      data: { role: dto.role },
    });
  }

  // Spec 2.4.2 - Yakindaki Onerilen Topluluklar (PostGIS ST_DWithin).
  // PostGIS hazir degilse (test DB), tablolari duz sorguyla dondurecegiz.
  async listNearby(
    dto: NearbyCommunitiesQueryDto,
  ): Promise<Array<CommunitySummary & { distance: number | null }>> {
    let ids: Array<{ community_id: string; distance_m: number }> = [];
    try {
      ids = await this.prisma.$queryRaw<
        Array<{ community_id: string; distance_m: number }>
      >`SELECT community_id, distance_m FROM find_communities_within(${dto.lat}, ${dto.lng}, ${dto.radius}) LIMIT ${dto.limit}`;
    } catch {
      // PostGIS yoksa fallback: en yeni public topluluklar
      ids = [];
    }
    if (!ids.length) {
      const fallback = await this.prisma.community.findMany({
        where: { deletedAt: null, visibility: 'PUBLIC' },
        orderBy: { membersCount: 'desc' },
        take: dto.limit,
      });
      return fallback.map((c) => ({ ...this.toSummary(c), distance: null }));
    }
    const distanceMap = new Map(ids.map((r) => [r.community_id, r.distance_m]));
    const list = await this.prisma.community.findMany({
      where: { id: { in: ids.map((r) => r.community_id) }, deletedAt: null },
    });
    return list
      .map((c) => ({ ...this.toSummary(c), distance: distanceMap.get(c.id) ?? null }))
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }

  async listPendingJoinRequests(
    actorUserId: string,
    communityId: string,
  ): Promise<Array<{ userId: string; username: string; avatarUrl: string | null; requestedAt: string }>> {
    await this.requireRole(communityId, actorUserId, ['OWNER', 'ADMIN']);
    const rows = await this.prisma.communityMember.findMany({
      where: { communityId, status: 'PENDING' },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl ?? null,
      requestedAt: m.joinedAt.toISOString(),
    }));
  }

  // ============ yardimci fonksiyonlar ============

  private async getMembership(communityId: string, userId: string) {
    return this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
  }

  private async requireRole(
    communityId: string,
    userId: string,
    allowed: PrismaCommunityRole[],
  ) {
    const m = await this.getMembership(communityId, userId);
    if (!m || m.status !== 'ACTIVE' || !allowed.includes(m.role)) {
      throw new ForbiddenException({
        error: 'Insufficient community privileges',
        code: ErrorCodes.FORBIDDEN,
      });
    }
    return m;
  }

  private async assertViewable(communityId: string, userId: string) {
    const community = await this.prisma.community.findFirst({
      where: { id: communityId, deletedAt: null },
    });
    if (!community) {
      throw new NotFoundException({
        error: 'Community not found',
        code: ErrorCodes.NOT_FOUND,
      });
    }
    if (community.visibility === 'HIDDEN') {
      const m = await this.getMembership(communityId, userId);
      if (!m || m.status !== 'ACTIVE') {
        throw new NotFoundException({
          error: 'Community not found',
          code: ErrorCodes.NOT_FOUND,
        });
      }
    }
  }

  private toSummary(c: Community): CommunitySummary {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      avatarUrl: c.avatarUrl,
      coverImageUrl: c.coverImageUrl,
      visibility: c.visibility,
      region: c.region,
      tags: c.tags,
      ownerId: c.ownerId,
      membersCount: c.membersCount,
      latitude: c.latitude,
      longitude: c.longitude,
      createdAt: c.createdAt.toISOString(),
    };
  }

  private toDetail(
    c: CommunityRow,
    viewerRole: PrismaCommunityRole | null,
    viewerStatus: PrismaMemberStatus | null,
  ): CommunityDetail {
    return {
      ...this.toSummary(c),
      rules: c.rules ?? null,
      viewerRole,
      viewerStatus,
    };
  }
}
