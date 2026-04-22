import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  MarkNotificationReadSchema,
  NotificationListPageResponseSchema,
  NotificationUnreadCountResponseSchema,
  SuccessTrueSchema,
  type MarkNotificationReadDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';

import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ZodResponse(NotificationListPageResponseSchema)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.listForUser(user.userId, cursor, limit ? Number(limit) : 30);
  }

  @Get('unread-count')
  @ZodResponse(NotificationUnreadCountResponseSchema)
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.notifications.unreadCount(user.userId);
    return { count };
  }

  @Post('mark-read')
  @ZodResponse(SuccessTrueSchema)
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(MarkNotificationReadSchema)) dto: MarkNotificationReadDto,
  ) {
    await this.notifications.markRead(user.userId, dto.notificationIds);
    return { success: true };
  }
}
