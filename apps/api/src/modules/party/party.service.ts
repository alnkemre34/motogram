import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCodes,
  type CreatePartyDto,
  type PartyDetail,
  type PartyMemberDto,
  type PartySummary,
  type PartySignalType,
} from '@motogram/shared';
import type { Party, PartyMember, User } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LeaderElectionService } from './leader-election.service';
import {
  PARTY_CREATE_LIMIT,
  PARTY_REDIS_KEYS,
  PARTY_TTL,
} from './party.constants';

// Spec 3.2 + 3.3.1 + 4.1 + 7.3.1 + 8.1 + 8.2 + 8.7.1
// Parti CRUD + Redis senkronizasyon + lider gecisi.

export interface PartyEmitter {
  emitMemberJoined(partyId: string, member: PartyMemberDto): void;
  emitMemberLeft(partyId: string, userId: string, reason: 'LEFT' | 'DISCONNECT_TIMEOUT' | 'KICKED'): void;
  emitStatusChanged(partyId: string, status: Party['status']): void;
  emitLeaderChanged(partyId: string, newLeaderId: string, reason: 'LEADER_LEFT' | 'LEADER_OFFLINE' | 'MANUAL'): void;
  emitSignal(partyId: string, payload: {
    type: PartySignalType;
    senderId: string;
    senderName: string;
    timestamp: number;
  }): void;
  emitEnded(partyId: string, reason: 'LEADER_LEFT_ALONE' | 'MANUAL' | 'TIMEOUT'): void;
}

@Injectable()
export class PartyService {
  private readonly logger = new Logger(PartyService.name);
  private emitter: PartyEmitter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly leaderElection: LeaderElectionService,
    private readonly notifications: NotificationsService,
  ) {}

  registerEmitter(emitter: PartyEmitter): void {
    this.emitter = emitter;
  }

  // ================= CREATE =================
  async createParty(leaderId: string, dto: CreatePartyDto): Promise<PartySummary> {
    // Spec 8.7.1 - saatte 5 parti olusturma limiti
    const count = await this.redis.incrementActionCount(
      leaderId,
      'party_create',
      PARTY_CREATE_LIMIT.windowSeconds,
    );
    if (count > PARTY_CREATE_LIMIT.perHour) {
      throw new ForbiddenException({
        error: 'party_create_rate_limited',
        code: ErrorCodes.FORBIDDEN,
      });
    }

    // Ayni kullanici aktif baska partide varsa engelle (2.4.2 - "ayrilip katil" client tarafi; burada sunucu guvenligi)
    const existing = await this.findActivePartyForUser(leaderId);
    if (existing) {
      throw new ConflictException({
        error: 'user_already_in_party',
        code: ErrorCodes.CONFLICT,
        details: { partyId: existing.partyId },
      });
    }

    if (dto.routeId) {
      const route = await this.prisma.route.findUnique({ where: { id: dto.routeId } });
      if (!route || route.deletedAt) {
        throw new NotFoundException({ error: 'route_not_found', code: ErrorCodes.NOT_FOUND });
      }
    }

    const party = await this.prisma.$transaction(async (tx) => {
      const created = await tx.party.create({
        data: {
          name: dto.name,
          leaderId,
          coLeaderIds: dto.coLeaderIds,
          routeId: dto.routeId ?? null,
          eventId: dto.eventId ?? null,
          isPrivate: dto.isPrivate,
          maxMembers: dto.maxMembers,
          status: 'WAITING',
        },
      });
      await tx.partyMember.create({
        data: {
          partyId: created.id,
          userId: leaderId,
          role: 'LEADER',
          isOnline: true,
        },
      });
      return created;
    });

    // Redis - party:{id}:members + user:{uid}:party
    await this.redis.raw
      .multi()
      .sadd(PARTY_REDIS_KEYS.members(party.id), leaderId)
      .sadd(PARTY_REDIS_KEYS.activePartyIndex(), party.id)
      .set(PARTY_REDIS_KEYS.userParty(leaderId), party.id)
      .exec();

    return this.toSummary(party, 1);
  }

  // ================= JOIN =================
  async joinParty(userId: string, partyId: string): Promise<PartyDetail> {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });
    if (!party || party.deletedAt || party.status === 'ENDED') {
      throw new NotFoundException({ error: 'party_not_found', code: ErrorCodes.NOT_FOUND });
    }

    const activeMembers = party.members.filter((m) => m.leftAt === null);
    if (activeMembers.length >= party.maxMembers) {
      throw new ConflictException({ error: 'party_full', code: ErrorCodes.CONFLICT });
    }

    // Kullanici zaten baska partide mi?
    const other = await this.findActivePartyForUser(userId);
    if (other && other.partyId !== partyId) {
      throw new ConflictException({
        error: 'user_already_in_party',
        code: ErrorCodes.CONFLICT,
        details: { partyId: other.partyId },
      });
    }

    // isPrivate ve invite yoksa hata (Spec 2.4.2)
    if (party.isPrivate) {
      const invite = await this.prisma.partyInvite.findUnique({
        where: { partyId_inviteeId: { partyId, inviteeId: userId } },
      });
      if (!invite || invite.status !== 'PENDING') {
        throw new ForbiddenException({ error: 'invite_required', code: ErrorCodes.FORBIDDEN });
      }
    }

    const existing = activeMembers.find((m) => m.userId === userId);
    const member = existing
      ? await this.prisma.partyMember.update({
          where: { partyId_userId: { partyId, userId } },
          data: { isOnline: true, leftAt: null },
        })
      : await this.prisma.partyMember.create({
          data: { partyId, userId, role: 'MEMBER', isOnline: true },
        });

    if (party.isPrivate) {
      await this.prisma.partyInvite.updateMany({
        where: { partyId, inviteeId: userId, status: 'PENDING' },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
    }

    await this.redis.raw
      .multi()
      .sadd(PARTY_REDIS_KEYS.members(partyId), userId)
      .set(PARTY_REDIS_KEYS.userParty(userId), partyId)
      .exec();

    const memberDto = await this.toMemberDto(member);
    this.emitter?.emitMemberJoined(partyId, memberDto);

    return this.getPartyDetail(partyId);
  }

  // ================= LEAVE =================
  async leaveParty(
    userId: string,
    partyId: string,
    reason: 'LEFT' | 'DISCONNECT_TIMEOUT' | 'KICKED' = 'LEFT',
  ): Promise<{ ended: boolean; newLeaderId: string | null }> {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });
    if (!party || party.deletedAt) {
      throw new NotFoundException({ error: 'party_not_found', code: ErrorCodes.NOT_FOUND });
    }
    if (party.status === 'ENDED') {
      return { ended: true, newLeaderId: null };
    }
    const memberRow = party.members.find((m) => m.userId === userId);
    if (!memberRow || memberRow.leftAt) {
      throw new BadRequestException({ error: 'not_member', code: ErrorCodes.VALIDATION_FAILED });
    }

    // DB update
    await this.prisma.partyMember.update({
      where: { partyId_userId: { partyId, userId } },
      data: { leftAt: new Date(), isOnline: false },
    });

    await this.redis.raw
      .multi()
      .srem(PARTY_REDIS_KEYS.members(partyId), userId)
      .del(PARTY_REDIS_KEYS.userParty(userId))
      .exec();

    this.emitter?.emitMemberLeft(partyId, userId, reason);

    const wasLeader = party.leaderId === userId;
    const remaining = party.members.filter(
      (m) => m.userId !== userId && m.leftAt === null,
    );

    if (!wasLeader) {
      return { ended: false, newLeaderId: null };
    }

    // Spec 4.1 - Lider ayrildi: yeni lider sec
    if (remaining.length === 0) {
      await this.endParty(partyId, 'LEADER_LEFT_ALONE');
      return { ended: true, newLeaderId: null };
    }

    // Online uyelerden aday listesi
    const candidates = remaining.map((m) => ({
      userId: m.userId,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
      isOnline: m.isOnline,
    }));
    const election = await this.leaderElection.elect({
      partyId,
      coLeaderIds: party.coLeaderIds,
      onlineMembers: candidates.filter((c) => c.isOnline),
    });

    if (!election.locked || !election.newLeaderId) {
      // Baska instance kilidi aldi veya online aday yok. Herhangi bir fallback offline uye.
      const fallback = election.newLeaderId
        ? election.newLeaderId
        : candidates
            .slice()
            .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0]?.userId ?? null;
      if (!fallback) {
        await this.endParty(partyId, 'LEADER_LEFT_ALONE');
        return { ended: true, newLeaderId: null };
      }
      return { ended: false, newLeaderId: fallback };
    }

    await this.prisma.$transaction([
      this.prisma.party.update({
        where: { id: partyId },
        data: { leaderId: election.newLeaderId },
      }),
      this.prisma.partyMember.update({
        where: { partyId_userId: { partyId, userId: election.newLeaderId } },
        data: { role: 'LEADER' },
      }),
    ]);

    this.emitter?.emitLeaderChanged(partyId, election.newLeaderId, 'LEADER_LEFT');
    await this.leaderElection.release(partyId, election.newLeaderId);
    return { ended: false, newLeaderId: election.newLeaderId };
  }

  // ================= END =================
  async endParty(partyId: string, reason: 'LEADER_LEFT_ALONE' | 'MANUAL' | 'TIMEOUT'): Promise<void> {
    const party = await this.prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.status === 'ENDED') return;

    // Spec 8.1 - Parti ENDED olunca transaction + DLQ: aktif uyelerin son pingleri
    // BullMQ write-behind tarafindan zaten yazilir. Burada sadece status + Redis flush.
    await this.prisma.$transaction(async (tx) => {
      await tx.party.update({
        where: { id: partyId },
        data: { status: 'ENDED', endedAt: new Date() },
      });
      await tx.partyMember.updateMany({
        where: { partyId, leftAt: null },
        data: { leftAt: new Date(), isOnline: false },
      });
    });

    // Redis flush: party:{id}:members + user:{uid}:party (tum uyeler icin)
    const memberIds = await this.redis.raw.smembers(PARTY_REDIS_KEYS.members(partyId));
    const multi = this.redis.raw.multi();
    multi.del(PARTY_REDIS_KEYS.members(partyId));
    multi.del(PARTY_REDIS_KEYS.meta(partyId));
    multi.del(PARTY_REDIS_KEYS.zombieWatch(partyId));
    multi.srem(PARTY_REDIS_KEYS.activePartyIndex(), partyId);
    for (const uid of memberIds) {
      multi.del(PARTY_REDIS_KEYS.userParty(uid));
    }
    await multi.exec();

    this.emitter?.emitStatusChanged(partyId, 'ENDED');
    this.emitter?.emitEnded(partyId, reason);

    this.logger.log(`party_ended partyId=${partyId} reason=${reason} flushedMembers=${memberIds.length}`);
  }

  // ================= SIGNAL (7.3.1) =================
  async recordSignal(
    partyId: string,
    senderId: string,
    type: PartySignalType,
    senderName: string,
  ): Promise<{ allowed: boolean; count: number }> {
    // Rate limit: dakika basina 12 sinyal (urun karari)
    const count = await this.redis.incrementActionCount(
      senderId,
      'party_signal',
      60,
    );
    if (count > PARTY_TTL.signalRatePerMinute) {
      return { allowed: false, count };
    }

    // Membership guard (server-side authorization)
    const isMember = await this.redis.raw.sismember(PARTY_REDIS_KEYS.members(partyId), senderId);
    if (!isMember) {
      throw new ForbiddenException({ error: 'not_member', code: ErrorCodes.FORBIDDEN });
    }

    // Spec 7.3.1 - DB'YE YAZMA YOK. Sadece WS broadcast.
    this.emitter?.emitSignal(partyId, {
      type,
      senderId,
      senderName,
      timestamp: Date.now(),
    });
    return { allowed: true, count };
  }

  // ================= INVITE =================
  async invite(
    inviterId: string,
    partyId: string,
    inviteeIds: string[],
  ): Promise<{ created: number; skipped: number }> {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { members: true },
    });
    if (!party || party.deletedAt) {
      throw new NotFoundException({ error: 'party_not_found', code: ErrorCodes.NOT_FOUND });
    }
    if (party.status === 'ENDED') {
      throw new BadRequestException({ error: 'party_ended', code: ErrorCodes.VALIDATION_FAILED });
    }
    const isAllowed =
      party.leaderId === inviterId || party.coLeaderIds.includes(inviterId);
    if (!isAllowed) {
      throw new ForbiddenException({ error: 'not_leader', code: ErrorCodes.FORBIDDEN });
    }

    let created = 0;
    let skipped = 0;
    for (const inviteeId of inviteeIds) {
      if (inviteeId === inviterId) {
        skipped += 1;
        continue;
      }
      const existing = await this.prisma.partyInvite.findUnique({
        where: { partyId_inviteeId: { partyId, inviteeId } },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await this.prisma.partyInvite.create({
        data: { partyId, inviterId, inviteeId, status: 'PENDING' },
      });
      await this.notifications.create({
        userId: inviteeId,
        type: 'PARTY_INVITE',
        title: 'party_invite_title',
        body: 'party_invite_body',
        data: { partyId, partyName: party.name, inviterId },
      });
      created += 1;
    }
    return { created, skipped };
  }

  // ================= HELPERS =================
  async findActivePartyForUser(
    userId: string,
  ): Promise<{ partyId: string; role: PartyMember['role'] } | null> {
    const row = await this.prisma.partyMember.findFirst({
      where: { userId, leftAt: null, party: { status: { not: 'ENDED' }, deletedAt: null } },
      select: { partyId: true, role: true },
    });
    return row ? { partyId: row.partyId, role: row.role } : null;
  }

  async getPartyDetail(partyId: string): Promise<PartyDetail> {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        members: {
          where: { leftAt: null },
          orderBy: { joinedAt: 'asc' },
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        },
        route: true,
      },
    });
    if (!party) {
      throw new NotFoundException({ error: 'party_not_found', code: ErrorCodes.NOT_FOUND });
    }
    return {
      ...this.toSummary(party, party.members.length),
      route: party.route
        ? {
            id: party.route.id,
            name: party.route.name,
            distance: party.route.distance,
            estimatedDuration: party.route.estimatedDuration,
            waypoints: (party.route.waypoints as Array<{ lat: number; lng: number; label?: string }>) ?? [],
            privacy: party.route.privacy,
          }
        : null,
      members: party.members.map((m) => ({
        userId: m.user.id,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl ?? null,
        role: m.role,
        isOnline: m.isOnline,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  async listNearbyPublicParties(limit: number): Promise<PartySummary[]> {
    // Geo-sorted mesafe Faz 4'te (parti lider konumu Redis'ten). Faz 3: en yakinlari
    // server tarafi filtresiz doner, distance=null.
    const parties = await this.prisma.party.findMany({
      where: {
        status: { in: ['WAITING', 'RIDING'] },
        isPrivate: false,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { members: { where: { leftAt: null }, select: { userId: true } } },
    });
    return parties.map((p) => this.toSummary(p, p.members.length));
  }

  async listInvitesForUser(userId: string) {
    return this.prisma.partyInvite.findMany({
      where: { inviteeId: userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { party: true, inviter: { select: { id: true, username: true, avatarUrl: true } } },
    });
  }

  async respondInvite(userId: string, inviteId: string, accept: boolean): Promise<{ joined: boolean; partyId: string | null }> {
    const invite = await this.prisma.partyInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.inviteeId !== userId) {
      throw new NotFoundException({ error: 'invite_not_found', code: ErrorCodes.NOT_FOUND });
    }
    if (invite.status !== 'PENDING') {
      throw new BadRequestException({ error: 'invite_resolved', code: ErrorCodes.VALIDATION_FAILED });
    }
    if (!accept) {
      await this.prisma.partyInvite.update({
        where: { id: inviteId },
        data: { status: 'DECLINED', respondedAt: new Date() },
      });
      return { joined: false, partyId: null };
    }
    await this.joinParty(userId, invite.partyId);
    return { joined: true, partyId: invite.partyId };
  }

  // ================= PRIVATE =================
  private toSummary(party: Party, memberCount: number): PartySummary {
    return {
      id: party.id,
      name: party.name,
      leaderId: party.leaderId,
      coLeaderIds: party.coLeaderIds,
      status: party.status,
      routeId: party.routeId,
      memberCount,
      isPrivate: party.isPrivate,
      maxMembers: party.maxMembers,
      startedAt: party.startedAt?.toISOString() ?? null,
      endedAt: party.endedAt?.toISOString() ?? null,
      createdAt: party.createdAt.toISOString(),
    };
  }

  private async toMemberDto(member: PartyMember): Promise<PartyMemberDto> {
    const user = (await this.prisma.user.findUnique({
      where: { id: member.userId },
      select: { id: true, username: true, avatarUrl: true },
    })) as Pick<User, 'id' | 'username' | 'avatarUrl'> | null;
    return {
      userId: member.userId,
      username: user?.username ?? '',
      avatarUrl: user?.avatarUrl ?? null,
      role: member.role,
      isOnline: member.isOnline,
      joinedAt: member.joinedAt.toISOString(),
    };
  }

  // Spec 7.3.3 - Zombie watch: disconnect oldugunda lastSeen kaydeder, cron 60sn
  // sonra otomatik leaveParty tetikler.
  async markOffline(userId: string, partyId: string): Promise<void> {
    const now = Date.now();
    await this.redis.raw.zadd(PARTY_REDIS_KEYS.zombieWatch(partyId), now, userId);
    await this.prisma.partyMember.updateMany({
      where: { partyId, userId, leftAt: null },
      data: { isOnline: false, serverHostname: null },
    });
  }

  async clearOfflineMark(userId: string, partyId: string): Promise<void> {
    await this.redis.raw.zrem(PARTY_REDIS_KEYS.zombieWatch(partyId), userId);
    await this.prisma.partyMember.updateMany({
      where: { partyId, userId, leftAt: null },
      data: { isOnline: true },
    });
  }

  /**
   * Spec 7.3.3 - 60sn'den eski offline uyeleri otomatik ayir (cron).
   */
  async sweepZombieMembers(): Promise<{ removed: number }> {
    const threshold = Date.now() - PARTY_TTL.zombieOfflineSeconds * 1000;
    const activePartyIds = await this.redis.raw.smembers(PARTY_REDIS_KEYS.activePartyIndex());
    let removed = 0;
    for (const partyId of activePartyIds) {
      const stale = await this.redis.raw.zrangebyscore(
        PARTY_REDIS_KEYS.zombieWatch(partyId),
        0,
        threshold,
      );
      for (const userId of stale) {
        try {
          await this.leaveParty(userId, partyId, 'DISCONNECT_TIMEOUT');
          await this.redis.raw.zrem(PARTY_REDIS_KEYS.zombieWatch(partyId), userId);
          removed += 1;
        } catch (err) {
          this.logger.warn(
            `zombie_leave_failed party=${partyId} user=${userId}: ${(err as Error).message}`,
          );
        }
      }
    }
    return { removed };
  }
}
