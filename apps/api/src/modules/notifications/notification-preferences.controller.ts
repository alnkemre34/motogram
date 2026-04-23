import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  NotificationPreferencesSchema,
  UpdateNotificationPreferencesSchema,
  type NotificationPreferencesDto,
  type UpdateNotificationPreferencesDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { NotificationsService } from './notifications.service';

/** B-14 — Kullanıcı push / e-posta özet tercihleri. */
@Controller('notification-preferences')
@UseGuards(JwtAuthGuard)
export class NotificationPreferencesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ZodResponse(NotificationPreferencesSchema)
  async get(@CurrentUser() user: AuthenticatedUser): Promise<NotificationPreferencesDto> {
    return this.notifications.getPreferences(user.userId);
  }

  @Patch()
  @ZodResponse(NotificationPreferencesSchema)
  async patch(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(UpdateNotificationPreferencesSchema)) dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesDto> {
    return this.notifications.updatePreferences(user.userId, dto);
  }
}
