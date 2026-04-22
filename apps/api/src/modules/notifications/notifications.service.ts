import { Injectable } from '@nestjs/common';
import type { NotificationType } from '@motogram/shared';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Spec 3.7 - NotificationTemplate'den render edilmis title/body ile kayit
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }) {
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
