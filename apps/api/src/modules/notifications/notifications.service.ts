import { Injectable } from '@nestjs/common';
import type {
  NotificationPreferencesDto,
  NotificationType,
  UpdateNotificationPreferencesDto,
} from '@motogram/shared';
import type { Notification } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PREFS = {
  pushFollow: true,
  pushLike: true,
  pushComment: true,
  pushMention: true,
  pushParty: true,
  pushEmergency: true,
  pushCommunity: true,
  pushEvent: true,
  emailDigest: false,
} as const;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** B-14 — GET; kayıt yoksa varsayılanlar (DB’ye yazılmaz). */
  async getPreferences(userId: string): Promise<NotificationPreferencesDto> {
    const row = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    if (!row) {
      return { ...DEFAULT_PREFS };
    }
    return this.mapPrefs(row);
  }

  /** B-14 — PATCH upsert. */
  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesDto> {
    const current = await this.getPreferences(userId);
    const next = { ...current, ...dto };
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...next },
      update: next,
    });
    return this.mapPrefs(row);
  }

  private mapPrefs(row: {
    pushFollow: boolean;
    pushLike: boolean;
    pushComment: boolean;
    pushMention: boolean;
    pushParty: boolean;
    pushEmergency: boolean;
    pushCommunity: boolean;
    pushEvent: boolean;
    emailDigest: boolean;
  }): NotificationPreferencesDto {
    return {
      pushFollow: row.pushFollow,
      pushLike: row.pushLike,
      pushComment: row.pushComment,
      pushMention: row.pushMention,
      pushParty: row.pushParty,
      pushEmergency: row.pushEmergency,
      pushCommunity: row.pushCommunity,
      pushEvent: row.pushEvent,
      emailDigest: row.emailDigest,
    };
  }

  /** B-14 — Tip → tercih alanı eşlemesi; kapalıysa DB bildirimi oluşturulmaz. */
  private async allowsInAppFor(userId: string, type: NotificationType): Promise<boolean> {
    const p = await this.getPreferences(userId);
    switch (type) {
      case 'FOLLOW':
        return p.pushFollow;
      case 'LIKE':
        return p.pushLike;
      case 'COMMENT':
      case 'MESSAGE':
        return p.pushComment;
      case 'MENTION':
        return p.pushMention;
      case 'PARTY_INVITE':
        return p.pushParty;
      case 'EMERGENCY_NEARBY':
        return p.pushEmergency;
      case 'GROUP_INVITE':
        return p.pushCommunity;
      case 'EVENT_INVITE':
        return p.pushEvent;
      default:
        return true;
    }
  }

  // Spec 3.7 - NotificationTemplate'den render edilmis title/body ile kayit
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<Notification | null> {
    const allow = await this.allowsInAppFor(params.userId, params.type);
    if (!allow) {
      return null;
    }
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: (params.data ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async listForUser(userId: string, cursor?: string, limit = 30) {
    const items = cursor
      ? await this.prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          cursor: { id: cursor },
          skip: 1,
        })
      : await this.prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
    return {
      items,
      nextCursor: items.length === limit ? items[items.length - 1]!.id : null,
    };
  }

  async markRead(userId: string, ids: string[]): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, id: { in: ids }, isRead: false },
      data: { isRead: true },
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }
}
