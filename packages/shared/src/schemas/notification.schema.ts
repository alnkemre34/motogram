import { z } from 'zod';

import { NotificationTypeEnum } from '../enums';
import { DateLikeSchema } from '../lib/api-response';

// Spec 3.2 - Notification, 3.7 - NotificationTemplate

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: NotificationTypeEnum,
  title: z.string(),
  body: z.string(),
  data: z.record(z.unknown()).nullable(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const MarkNotificationReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).min(1).max(100),
});
export type MarkNotificationReadDto = z.infer<typeof MarkNotificationReadSchema>;

export const NotificationRowResponseSchema = NotificationSchema.extend({
  createdAt: DateLikeSchema,
}).passthrough();

export const NotificationListPageResponseSchema = z.object({
  items: z.array(NotificationRowResponseSchema),
  nextCursor: z.string().nullable(),
});

export const NotificationUnreadCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});
