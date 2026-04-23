import { z } from 'zod';

/** BullMQ location-sync job (producer + worker SSOT) */
export const LocationSyncJobSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).nullable(),
  speed: z.number().min(0).nullable(),
  accuracy: z.number().min(0).nullable(),
  batteryLevel: z.number().min(0).max(1).nullable(),
  timestamp: z.number().int().positive(),
});
export type LocationSyncJob = z.infer<typeof LocationSyncJobSchema>;

/** BullMQ DELETE_USER_DATA job */
export const AccountDeletionJobSchema = z.object({
  userId: z.string().uuid(),
  scheduledFor: z.string().min(1),
  reason: z.string().nullable().optional(),
});
export type AccountDeletionJob = z.infer<typeof AccountDeletionJobSchema>;

/** BullMQ AUTH_PASSWORD_RESET_MAIL — worker e-posta gönderir veya dev’de loglar (B-05). */
export const PasswordResetEmailJobSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  /** Tek seferlik düz metin token (URL’de); üretimde worker SMTP ile gönderir. */
  resetToken: z.string().min(32).max(128),
});
export type PasswordResetEmailJob = z.infer<typeof PasswordResetEmailJobSchema>;

/** BullMQ AUTH_EMAIL_CHANGE_MAIL — mevcut adrese doğrulama linki (B-07). */
export const EmailChangeMailJobSchema = z.object({
  userId: z.string().uuid(),
  /** Mevcut hesap e-postası (doğrulama linki buraya gider). */
  email: z.string().email(),
  /** Hedef yeni adres (log / şablon metni). */
  newEmail: z.string().email(),
  verifyToken: z.string().min(32).max(128),
});
export type EmailChangeMailJob = z.infer<typeof EmailChangeMailJobSchema>;
