import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCodes,
  type CreateEventDto,
  type EventDetail,
  type EventSummary,
  type NearbyEventsQueryDto,
  type RsvpEventDto,
  type UpdateEventDto,
} from '@motogram/shared';
import type { Event, RsvpStatus as PrismaRsvpStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

// Spec 2.4.3 / 3.2 / 8.1 - Event servisi.
// - CRUD (organizer + coHosts)
// - RSVP (GOING / INTERESTED / NOT_GOING / WAITLIST)
// - Otomatik waitlist: maxParticipants dolarsa GOING -> WAITLIST otomatik
// - Nearby: PostGIS ST_DWithin (find_events_within SQL fonksiyonu)

@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(organizerId: string, dto: CreateEventDto): Promise<EventDetail> {
    if (dto.endTime && dto.endTime < dto.startTime) {
      throw new BadRequestException({
        error: 'endTime must be after startTime',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
    if (dto.communityId) {
      await this.assertCommunityPrivilege(dto.communityId, organizerId);
    }
    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          organizerId,
          title: dto.title,
          description: dto.description,
          communityId: dto.communityId,
          coHostIds: dto.coHostIds,
          routeId: dto.routeId,
          meetingPointLat: dto.meetingPointLat,
          meetingPointLng: dto.meetingPointLng,
          meetingPointName: dto.meetingPointName,
          startTime: dto.startTime,
          endTime: dto.endTime,
          visibility: dto.visibility,
          difficulty: dto.difficulty,
          distance: dto.distance,
          category: dto.category,
          maxParticipants: dto.maxParticipants,
          rules: dto.rules,
          participantsCount: 1,
        },
      });
      await tx.eventParticipant.create({
        data: {
          eventId: created.id,
          userId: organizerId,
          rsvpStatus: 'GOING',
        },
      });
      return created;
    });
    return this.toDetail(event, 'GOING');
  }

  async updateEvent(
    actorUserId: string,
    eventId: string,
    dto: UpdateEventDto,
  ): Promise<EventDetail> {
    const event = await this.requireExisting(eventId);
    if (event.organizerId !== actorUserId && !event.coHostIds.includes(actorUserId)) {
      throw new ForbiddenException({
        error: 'Only organizer or co-hosts may edit',
        code: ErrorCodes.FORBIDDEN,
      });
    }
    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: dto,
    });
    const viewer = await this.prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId: actorUserId } },
    });
    return this.toDetail(updated, viewer?.rsvpStatus ?? null);
  }

  async getDetail(eventId: string, viewerId: string): Promise<EventDetail> {
    const event = await this.requireExisting(eventId);
    if (event.visibility === 'PRIVATE' && event.organizerId !== viewerId && !event.coHostIds.includes(viewerId)) {
      const p = await this.prisma.eventParticipant.findUnique({
        where: { eventId_userId: { eventId, userId: viewerId } },
      });
      if (!p) {
        throw new ForbiddenException({
          error: 'Event is private',
          code: ErrorCodes.FORBIDDEN,
        });
      }
    }
    const viewer = await this.prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId: viewerId } },
    });
    return this.toDetail(event, viewer?.rsvpStatus ?? null);
  }

  async listMine(userId: string): Promise<EventSummary[]> {
    const participations = await this.prisma.eventParticipant.findMany({
      where: { userId, rsvpStatus: { in: ['GOING', 'INTERESTED', 'WAITLIST'] } },
      include: { event: true },
      orderBy: { joinedAt: 'desc' },
    });
    return participations
      .filter((p) => p.event && p.event.deletedAt === null)
      .map((p) => this.toSummary(p.event));
  }

  // Spec 3.2 - RSVP akisi + waitlist otomatik promosyon
  async rsvp(
    userId: string,
    dto: RsvpEventDto,
  ): Promise<{ rsvpStatus: PrismaRsvpStatus; promotedFromWaitlist?: string[] }> {
    const event = await this.requireExisting(dto.eventId);
    const existing = await this.prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId: dto.eventId, userId } },
    });

    let effective: PrismaRsvpStatus = dto.status;
    const promoted: string[] = [];

    // NOT_GOING -> participant kaydı silinir
    if (dto.status === 'NOT_GOING') {
      if (!existing) {
        return { rsvpStatus: 'NOT_GOING' };
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.eventParticipant.delete({
          where: { eventId_userId: { eventId: dto.eventId, userId } },
        });
        if (existing.rsvpStatus === 'GOING') {
          await tx.event.update({
            where: { id: dto.eventId },
            data: { participantsCount: { decrement: 1 } },
          });
          // Waitlist'ten bir kisi GOING'e promote et (Spec 3.2)
          if (event.maxParticipants) {
            const next = await tx.eventParticipant.findFirst({
              where: { eventId: dto.eventId, rsvpStatus: 'WAITLIST' },
              orderBy: { joinedAt: 'asc' },
            });
            if (next) {
              await tx.eventParticipant.update({
                where: { eventId_userId: { eventId: dto.eventId, userId: next.userId } },
                data: { rsvpStatus: 'GOING' },
              });
              await tx.event.update({
                where: { id: dto.eventId },
                data: { participantsCount: { increment: 1 } },
              });
              promoted.push(next.userId);
            }
          }
        }
      });
      return { rsvpStatus: 'NOT_GOING', promotedFromWaitlist: promoted };
    }

    // GOING -> kapasite dolu mu? dolduysa WAITLIST
    if (dto.status === 'GOING' && event.maxParticipants) {
      const goingCount = await this.prisma.eventParticipant.count({
        where: { eventId: dto.eventId, rsvpStatus: 'GOING' },
      });
      const wasGoing = existing?.rsvpStatus === 'GOING';
      const effectiveCount = wasGoing ? goingCount : goingCount + 1;
      if (effectiveCount > event.maxParticipants) {
        effective = 'WAITLIST';
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.eventParticipant.update({
          where: { eventId_userId: { eventId: dto.eventId, userId } },
          data: { rsvpStatus: effective },
        });
        if (existing.rsvpStatus !== 'GOING' && effective === 'GOING') {
          await tx.event.update({
            where: { id: dto.eventId },
            data: { participantsCount: { increment: 1 } },
          });
        }
        if (existing.rsvpStatus === 'GOING' && effective !== 'GOING') {
          await tx.event.update({
            where: { id: dto.eventId },
            data: { participantsCount: { decrement: 1 } },
          });
        }
      } else {
        await tx.eventParticipant.create({
          data: {
            eventId: dto.eventId,
            userId,
            rsvpStatus: effective,
          },
        });
        if (effective === 'GOING') {
          await tx.event.update({
            where: { id: dto.eventId },
            data: { participantsCount: { increment: 1 } },
          });
        }
      }
    });

    return { rsvpStatus: effective, promotedFromWaitlist: promoted };
  }

  async listParticipants(eventId: string, viewerId: string) {
    await this.assertViewable(eventId, viewerId);
    const rows = await this.prisma.eventParticipant.findMany({
      where: { eventId },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      orderBy: [{ rsvpStatus: 'asc' }, { joinedAt: 'asc' }],
    });
    return rows.map((r) => ({
      userId: r.userId,
      username: r.user.username,
      avatarUrl: r.user.avatarUrl ?? null,
      rsvpStatus: r.rsvpStatus,
      checkedIn: r.checkedIn,
      joinedAt: r.joinedAt.toISOString(),
    }));
  }

  // Spec 8.1 - Yakindaki Etkinlikler: PostGIS find_events_within fonksiyonu.
  async listNearby(
    dto: NearbyEventsQueryDto,
  ): Promise<Array<EventSummary & { distance: number | null }>> {
    let rows: Array<{ event_id: string; distance_m: number }> = [];
    try {
      rows = await this.prisma.$queryRaw<
        Array<{ event_id: string; distance_m: number }>
      >`SELECT event_id, distance_m FROM find_events_within(${dto.lat}, ${dto.lng}, ${dto.radius}) LIMIT ${dto.limit}`;
    } catch {
      rows = [];
    }
    const timeFrom = dto.from ?? new Date();
    if (!rows.length) {
      const fallback = await this.prisma.event.findMany({
        where: {
          deletedAt: null,
          visibility: 'PUBLIC',
          startTime: { gte: timeFrom, ...(dto.to ? { lte: dto.to } : {}) },
        },
        orderBy: { startTime: 'asc' },
        take: dto.limit,
      });
      return fallback.map((e) => ({ ...this.toSummary(e), distance: null }));
    }
    const distMap = new Map(rows.map((r) => [r.event_id, r.distance_m]));
    const list = await this.prisma.event.findMany({
      where: {
        id: { in: rows.map((r) => r.event_id) },
        deletedAt: null,
        startTime: { gte: timeFrom, ...(dto.to ? { lte: dto.to } : {}) },
      },
    });
    return list
      .map((e) => ({ ...this.toSummary(e), distance: distMap.get(e.id) ?? null }))
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }

  // Spec 8.11.4 - soft delete
  async deleteEvent(actorUserId: string, eventId: string): Promise<void> {
    const event = await this.requireExisting(eventId);
    if (event.organizerId !== actorUserId) {
      throw new ForbiddenException({
        error: 'Only organizer can delete event',
        code: ErrorCodes.FORBIDDEN,
      });
    }
    await this.prisma.event.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });
  }

  // ============ yardimci ============

  private async requireExisting(eventId: string): Promise<Event> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    });
    if (!event) {
      throw new NotFoundException({
        error: 'Event not found',
        code: ErrorCodes.NOT_FOUND,
      });
    }
    return event;
  }

  private async assertViewable(eventId: string, userId: string): Promise<Event> {
    const event = await this.requireExisting(eventId);
    if (event.visibility === 'PRIVATE' && event.organizerId !== userId && !event.coHostIds.includes(userId)) {
      const p = await this.prisma.eventParticipant.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });
      if (!p) {
        throw new ForbiddenException({
          error: 'Event is private',
          code: ErrorCodes.FORBIDDEN,
        });
      }
    }
    return event;
  }

  private async assertCommunityPrivilege(communityId: string, userId: string) {
    const membership = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      !['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role)
    ) {
      throw new ForbiddenException({
        error: 'Need OWNER/ADMIN/MODERATOR role in community',
        code: ErrorCodes.FORBIDDEN,
      });
    }
  }

  private toSummary(e: Event): EventSummary {
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      organizerId: e.organizerId,
      communityId: e.communityId,
      meetingPointLat: e.meetingPointLat,
      meetingPointLng: e.meetingPointLng,
      meetingPointName: e.meetingPointName,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime ? e.endTime.toISOString() : null,
      visibility: e.visibility,
      difficulty: e.difficulty,
      category: e.category,
      maxParticipants: e.maxParticipants,
      participantsCount: e.participantsCount,
      createdAt: e.createdAt.toISOString(),
    };
  }

  private toDetail(e: Event, viewerRsvp: PrismaRsvpStatus | null): EventDetail {
    return {
      ...this.toSummary(e),
      rules: e.rules ?? null,
      routeId: e.routeId,
      coHostIds: e.coHostIds,
      viewerRsvp,
    };
  }
}
