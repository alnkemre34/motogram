import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCodes,
  GamificationTriggerPayloadSchema,
  type CreateEmergencyAlertDto,
  type EmergencyAlertDto,
  type EmergencyNearbyPayload,
  type EmergencyResponderDto,
  type RespondEmergencyAlertDto,
  type ResolveEmergencyAlertDto,
} from '@motogram/shared';

import { ZodEventBus } from '../../common/events/zod-event-bus.service';
import { LocationService } from '../location/location.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { RedisService } from '../redis/redis.service';
import {
  EMERGENCY_DEFAULT_RADIUS_M,
  EMERGENCY_PERF,
  EMERGENCY_RATE,
  EMERGENCY_REDIS_KEYS,
  SOS_MIN_HOLD_MS,
} from './emergency.constants';

// Spec 2.3.2 + 3.7 + 4.4 + 8.7.1 - Acil Durum (SOS) is mantigi.
// - createAlert: rate limit + 3sn hold telemetri + Redis GEORADIUS ile yakindaki
//   suruculeri bul -> EmergencyResponder kaydi + push + WS emit.
// - respond / resolve / cancel: surecin gerisi.

export interface EmergencyGatewayBridge {
  broadcastNearby(recipientIds: string[], payload: EmergencyNearbyPayload): void;
  broadcastResponderUpdate(
    alertId: string,
    requesterId: string,
    responder: EmergencyResponderDto,
  ): void;
  broadcastResolved(
    alertId: string,
    recipientIds: string[],
    resolution: 'RESOLVED' | 'CANCELLED' | 'FALSE_ALARM',
  ): void;
}

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);
  private gateway: EmergencyGatewayBridge | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly location: LocationService,
    private readonly push: PushService,
    private readonly notifications: NotificationsService,
    private readonly events: ZodEventBus,
  ) {}

  registerGateway(bridge: EmergencyGatewayBridge): void {
    this.gateway = bridge;
  }

  /**
   * Spec 4.4 + 8.7.1 - SOS yaratir.
   * - holdDurationMs < 3000 -> uyari log + BadRequest firlat.
   * - Rate limit: 10 dk'da 3 cagri -> retry-after + admin flag.
   * - Yaratma sonrasi: Redis GEORADIUS -> yakindaki suruculer -> DB + push + WS.
   */
  async createAlert(
    userId: string,
    dto: CreateEmergencyAlertDto,
    user: { username: string; city: string | null; isBanned: boolean },
  ): Promise<EmergencyAlertDto> {
    if (user.isBanned) {
      throw new ForbiddenException({
        error: 'user_banned',
        code: ErrorCodes.FORBIDDEN,
      });
    }

    // Spec 4.4 - False tap korumasi telemetri.
    if (dto.holdDurationMs !== undefined && dto.holdDurationMs < SOS_MIN_HOLD_MS) {
      this.logger.warn(
        `sos_false_tap userId=${userId} holdMs=${dto.holdDurationMs} min=${SOS_MIN_HOLD_MS}`,
      );
      throw new BadRequestException({
        error: 'hold_too_short',
        code: ErrorCodes.VALIDATION_FAILED,
        minHoldMs: SOS_MIN_HOLD_MS,
      });
    }

    // Spec 8.7.1 - Rate limit kontrolu (Redis INCR + EX 600).
    const rateKey = EMERGENCY_REDIS_KEYS.rateCount(userId);
    const count = await this.redis.raw.incr(rateKey);
    if (count === 1) {
      await this.redis.raw.expire(rateKey, EMERGENCY_RATE.windowSeconds);
    }
    if (count > EMERGENCY_RATE.maxAlertsPer10Min) {
      const ttl = await this.redis.raw.ttl(rateKey);
      // Admin'e bildirim (ayni pencere icinde bir kere)
      await this.flagFalseAlarm(userId, count);
      throw new ForbiddenException({
        error: 'sos_rate_limit',
        code: ErrorCodes.RATE_LIMITED,
        retryAfterSeconds: ttl > 0 ? ttl : EMERGENCY_RATE.windowSeconds,
        accountRestricted: true,
      });
    }

    // 1) Alert kaydi olustur.
    const radius = dto.radiusMeters ?? EMERGENCY_DEFAULT_RADIUS_M;
    const alert = await this.prisma.emergencyAlert.create({
      data: {
        userId,
        type: dto.type,
        description: dto.description ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters ?? null,
        radiusMeters: radius,
        city: user.city,
        status: 'OPEN',
      },
    });

    // 2) Redis GEOSEARCH ile yakindaki suruculeri bul (kendi sehrinde).
    const t0 = Date.now();
    const nearby = await this.location.queryNearbyRaw(
      dto.latitude,
      dto.longitude,
      radius,
      { city: user.city, limit: EMERGENCY_PERF.maxRecipients },
    );

    // Kendisini hariç tut ve blok kontrolunu uygula.
    const candidateIds = nearby.riders
      .filter((r) => r.userId !== userId)
      .map((r) => ({ userId: r.userId, distance: r.distance }));

    if (candidateIds.length === 0) {
      this.logger.warn(
        `sos_no_nearby alertId=${alert.id} userId=${userId} radius=${radius}`,
      );
      return this.toDto(alert, []);
    }

    // Bloklar (iki yonlu) cikar.
    const blocks = await this.prisma.block.findMany({
      where: {
        OR: [
          {
            initiatorId: userId,
            targetId: { in: candidateIds.map((c) => c.userId) },
          },
          {
            targetId: userId,
            initiatorId: { in: candidateIds.map((c) => c.userId) },
          },
        ],
      },
      select: { initiatorId: true, targetId: true },
    });
    const blockedIds = new Set<string>();
    for (const b of blocks) {
      blockedIds.add(b.initiatorId);
      blockedIds.add(b.targetId);
    }
    const filtered = candidateIds.filter((c) => !blockedIds.has(c.userId));

    // 3) EmergencyResponder kaydi (createMany).
    if (filtered.length > 0) {
      await this.prisma.emergencyResponder.createMany({
        data: filtered.map((c) => ({
          alertId: alert.id,
          responderId: c.userId,
          status: 'NOTIFIED' as const,
          distanceMeters: Math.round(c.distance),
        })),
        skipDuplicates: true,
      });
    }

    await this.prisma.emergencyAlert.update({
      where: { id: alert.id },
      data: { notifiedCount: filtered.length },
    });

    // 4) Bildirim + push + WebSocket
    const recipientIds = filtered.map((c) => c.userId);
    if (recipientIds.length > 0) {
      await this.dispatchNearbyNotifications({
        alertId: alert.id,
        requesterId: userId,
        requesterUsername: user.username,
        type: dto.type,
        latitude: dto.latitude,
        longitude: dto.longitude,
        radiusMeters: radius,
        recipients: filtered,
        createdAt: alert.createdAt,
      });
    }

    const durationMs = Date.now() - t0;
    if (durationMs > EMERGENCY_PERF.notifyNearbyMaxMs) {
      this.logger.warn(
        `sos_dispatch_slow alertId=${alert.id} durationMs=${durationMs} recipients=${recipientIds.length}`,
      );
    }

    return this.toDto({ ...alert, notifiedCount: filtered.length }, []);
  }

  /** Spec 3.6 - Gamification EMERGENCY_ACKNOWLEDGED icin event emit eder. */
  async respond(
    responderId: string,
    alertId: string,
    dto: RespondEmergencyAlertDto,
  ): Promise<EmergencyResponderDto> {
    const alert = await this.prisma.emergencyAlert.findFirst({
      where: { id: alertId, deletedAt: null },
    });
    if (!alert) throw new NotFoundException({ error: 'alert_not_found' });
    if (alert.userId === responderId) {
      throw new ForbiddenException({ error: 'cannot_respond_to_own_alert' });
    }
    if (alert.status === 'RESOLVED' || alert.status === 'CANCELLED') {
      throw new BadRequestException({ error: 'alert_closed' });
    }

    const existing = await this.prisma.emergencyResponder.findUnique({
      where: { alertId_responderId: { alertId, responderId } },
    });

    const now = new Date();
    const data: Parameters<typeof this.prisma.emergencyResponder.upsert>[0]['update'] = {
      status: dto.status,
      etaSeconds: dto.etaSeconds ?? null,
    };
    if (dto.status === 'ACKNOWLEDGED') data.acknowledgedAt = now;
    if (dto.status === 'ARRIVED') data.arrivedAt = now;
    if (dto.status === 'DECLINED') data.declinedAt = now;

    const saved = await this.prisma.emergencyResponder.upsert({
      where: { alertId_responderId: { alertId, responderId } },
      create: {
        alertId,
        responderId,
        status: dto.status,
        etaSeconds: dto.etaSeconds ?? null,
        acknowledgedAt: dto.status === 'ACKNOWLEDGED' ? now : null,
        arrivedAt: dto.status === 'ARRIVED' ? now : null,
        declinedAt: dto.status === 'DECLINED' ? now : null,
      },
      update: data,
    });

    // Alert acik durumdaysa ACKNOWLEDGED moduna al.
    if (dto.status === 'ACKNOWLEDGED' && alert.status === 'OPEN') {
      await this.prisma.emergencyAlert.update({
        where: { id: alertId },
        data: { status: 'ACKNOWLEDGED' },
      });
    }

    const dto2: EmergencyResponderDto = this.responderToDto(saved);

    if (this.gateway) {
      this.gateway.broadcastResponderUpdate(alertId, alert.userId, dto2);
    }

    // Spec 3.6 - EMERGENCY_ACKNOWLEDGED trigger (gamification).
    if (
      dto.status === 'ACKNOWLEDGED' &&
      !existing?.acknowledgedAt // Sadece ilk onaylamada XP
    ) {
      this.events.emit('gamification.trigger', GamificationTriggerPayloadSchema, {
        userId: responderId,
        trigger: 'EMERGENCY_ACKNOWLEDGED',
        increment: 1,
        metadata: { alertId },
      });
      // Requester'a "Biri yaniliyor" notification.
      await this.notifications.create({
        userId: alert.userId,
        type: 'EMERGENCY_NEARBY',
        title: 'Yardim geliyor',
        body: 'Bir surucu sana yardim etmek icin yolda.',
        data: { alertId, responderId },
      });
    }

    return dto2;
  }

  async resolve(
    userId: string,
    alertId: string,
    dto: ResolveEmergencyAlertDto,
  ): Promise<EmergencyAlertDto> {
    const alert = await this.prisma.emergencyAlert.findFirst({
      where: { id: alertId, deletedAt: null },
    });
    if (!alert) throw new NotFoundException({ error: 'alert_not_found' });
    if (alert.userId !== userId) {
      throw new ForbiddenException({ error: 'not_alert_owner' });
    }

    const now = new Date();
    const updated = await this.prisma.emergencyAlert.update({
      where: { id: alertId },
      data: {
        status: dto.resolution,
        resolvedAt: dto.resolution === 'RESOLVED' ? now : null,
        cancelledAt: dto.resolution !== 'RESOLVED' ? now : null,
      },
    });

    // Yanit verenlere WS bildir.
    const responders = await this.prisma.emergencyResponder.findMany({
      where: { alertId },
      select: { responderId: true },
    });
    if (this.gateway) {
      this.gateway.broadcastResolved(
        alertId,
        responders.map((r) => r.responderId),
        dto.resolution,
      );
    }

    return this.toDto(updated, []);
  }

  async listForUser(userId: string, limit = 20): Promise<EmergencyAlertDto[]> {
    const alerts = await this.prisma.emergencyAlert.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return alerts.map((a) => this.toDto(a, []));
  }

  async getAlert(requesterId: string, alertId: string): Promise<EmergencyAlertDto> {
    const alert = await this.prisma.emergencyAlert.findFirst({
      where: { id: alertId, deletedAt: null },
      include: {
        responders: { take: 50, orderBy: { notifiedAt: 'asc' } },
      },
    });
    if (!alert) throw new NotFoundException({ error: 'alert_not_found' });
    // Requester + respondenler gorebilir.
    if (alert.userId !== requesterId) {
      const isResponder = await this.prisma.emergencyResponder.findUnique({
        where: { alertId_responderId: { alertId, responderId: requesterId } },
      });
      if (!isResponder) {
        throw new ForbiddenException({ error: 'not_authorized' });
      }
    }
    return this.toDto(
      alert,
      alert.responders.map((r) => this.responderToDto(r)),
    );
  }

  // ============ PRIVATE ============

  private async dispatchNearbyNotifications(params: {
    alertId: string;
    requesterId: string;
    requesterUsername: string;
    type: CreateEmergencyAlertDto['type'];
    latitude: number;
    longitude: number;
    radiusMeters: number;
    recipients: Array<{ userId: string; distance: number }>;
    createdAt: Date;
  }): Promise<void> {
    const recipientIds = params.recipients.map((r) => r.userId);

    // Spec 3.7 - EMERGENCY_NEARBY bildirim (DB kayit + push).
    await Promise.all(
      params.recipients.map((r) =>
        this.notifications.create({
          userId: r.userId,
          type: 'EMERGENCY_NEARBY',
          title: 'Yakininda bir surucu yardim istiyor',
          body: 'Yardim edebilir misin?',
          data: {
            alertId: params.alertId,
            requesterId: params.requesterId,
            distanceMeters: Math.round(r.distance),
          },
        }),
      ),
    );

    // Spec 9.3 - Push
    await this.push
      .sendToUsers(recipientIds, {
        title: 'Yakininda bir surucu yardim istiyor',
        body: 'Yardim edebilir misin?',
        data: {
          type: 'EMERGENCY_NEARBY',
          alertId: params.alertId,
          requesterId: params.requesterId,
        },
        sound: 'sos_alert',
      })
      .catch((err) =>
        this.logger.warn(
          `sos_push_failed alertId=${params.alertId} err=${(err as Error).message}`,
        ),
      );

    // WebSocket
    if (this.gateway) {
      for (const r of params.recipients) {
        this.gateway.broadcastNearby([r.userId], {
          alertId: params.alertId,
          requesterId: params.requesterId,
          requesterUsername: params.requesterUsername,
          type: params.type,
          latitude: params.latitude,
          longitude: params.longitude,
          distanceMeters: Math.round(r.distance),
          createdAt: params.createdAt.toISOString(),
        });
      }
    }
  }

  private async flagFalseAlarm(userId: string, count: number): Promise<void> {
    const lockKey = EMERGENCY_REDIS_KEYS.adminNotifyLock(userId);
    // Aynı 10dk penceresinde sadece bir admin bildirim
    const locked = await this.redis.raw.set(
      lockKey,
      '1',
      'EX',
      EMERGENCY_RATE.windowSeconds,
      'NX',
    );
    if (locked !== 'OK') return;

    this.logger.warn(
      `sos_rate_limit_hit userId=${userId} count=${count} threshold=${EMERGENCY_RATE.maxAlertsPer10Min}`,
    );

    await this.prisma.auditLog.create({
      data: {
        actorUserId: null,
        action: 'SOS_RATE_LIMIT_TRIGGERED',
        targetType: 'User',
        targetId: userId,
        metadata: {
          alertsInWindow: count,
          threshold: EMERGENCY_RATE.maxAlertsPer10Min,
          windowSeconds: EMERGENCY_RATE.windowSeconds,
        },
      },
    });
  }

  private toDto(
    alert: {
      id: string;
      userId: string;
      type: string;
      description: string | null;
      latitude: number;
      longitude: number;
      accuracyMeters: number | null;
      radiusMeters: number;
      city: string | null;
      status: string;
      notifiedCount: number;
      createdAt: Date;
      resolvedAt: Date | null;
      cancelledAt: Date | null;
    },
    responders: EmergencyResponderDto[],
  ): EmergencyAlertDto {
    return {
      id: alert.id,
      userId: alert.userId,
      type: alert.type as EmergencyAlertDto['type'],
      description: alert.description,
      latitude: alert.latitude,
      longitude: alert.longitude,
      accuracyMeters: alert.accuracyMeters,
      radiusMeters: alert.radiusMeters,
      city: alert.city,
      status: alert.status as EmergencyAlertDto['status'],
      notifiedCount: alert.notifiedCount,
      createdAt: alert.createdAt.toISOString(),
      resolvedAt: alert.resolvedAt ? alert.resolvedAt.toISOString() : null,
      cancelledAt: alert.cancelledAt ? alert.cancelledAt.toISOString() : null,
      responders,
    };
  }

  private responderToDto(r: {
    id: string;
    alertId: string;
    responderId: string;
    status: string;
    distanceMeters: number | null;
    etaSeconds: number | null;
    notifiedAt: Date;
    acknowledgedAt: Date | null;
    arrivedAt: Date | null;
    declinedAt: Date | null;
  }): EmergencyResponderDto {
    return {
      id: r.id,
      alertId: r.alertId,
      responderId: r.responderId,
      status: r.status as EmergencyResponderDto['status'],
      distanceMeters: r.distanceMeters,
      etaSeconds: r.etaSeconds,
      notifiedAt: r.notifiedAt.toISOString(),
      acknowledgedAt: r.acknowledgedAt ? r.acknowledgedAt.toISOString() : null,
      arrivedAt: r.arrivedAt ? r.arrivedAt.toISOString() : null,
      declinedAt: r.declinedAt ? r.declinedAt.toISOString() : null,
    };
  }
}
