import { z } from 'zod';

import { DevicePlatformEnum } from '../enums';
import { DateLikeSchema } from '../lib/api-response';

// Spec 9.3 - Push notification cihaz kayit (Expo Push / FCM / APNs)
// Faz 1 Adim 24 - soft prompt sonrasi token register.

export const RegisterDeviceTokenSchema = z.object({
  token: z.string().trim().min(8).max(4096),
  platform: DevicePlatformEnum,
  appVersion: z.string().max(32).optional(),
});
export type RegisterDeviceTokenDto = z.infer<typeof RegisterDeviceTokenSchema>;

export const DeviceTokenDtoSchema = z.object({
  id: z.string().uuid(),
  platform: DevicePlatformEnum,
  appVersion: z.string().nullable().optional(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
});
export type DeviceTokenDto = z.infer<typeof DeviceTokenDtoSchema>;

export const DeviceTokenDtoResponseSchema = DeviceTokenDtoSchema.extend({
  createdAt: DateLikeSchema,
  lastSeenAt: DateLikeSchema,
});

export const DevicesListResponseSchema = z.object({
  devices: z.array(DeviceTokenDtoResponseSchema),
});
