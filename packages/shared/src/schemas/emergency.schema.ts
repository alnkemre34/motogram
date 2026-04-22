import { z } from 'zod';

import {
  EmergencyStatusEnum,
  EmergencyTypeEnum,
  ResponderStatusEnum,
} from '../enums';

// Spec 2.3.2 + 4.4 + 8.7.1 - Acil Durum (SOS) semalari.

// ============ REQUESTS ============

// Spec 4.4 - Client 3sn basili tutma sonunda cagirir.
// holdDurationMs: UI tarafi 3000ms basili tutmayi kanitlamak icin server'a gonderir.
// Server bunu tek basina dogrulamaz (sadece telemetri); ama <3000 ise false-tap olarak log'lar.
export const CreateEmergencyAlertSchema = z.object({
  type: EmergencyTypeEnum.default('GENERAL'),
  description: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().max(10000).optional(),
  holdDurationMs: z.number().int().positive().optional(), // Spec 4.4 false-tap telemetri
  radiusMeters: z.number().int().min(500).max(20000).default(5000),
});
export type CreateEmergencyAlertDto = z.infer<typeof CreateEmergencyAlertSchema>;

export const RespondEmergencyAlertSchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'EN_ROUTE', 'ARRIVED', 'DECLINED']),
  etaSeconds: z.number().int().min(0).max(3600).optional(),
});
export type RespondEmergencyAlertDto = z.infer<typeof RespondEmergencyAlertSchema>;

export const ResolveEmergencyAlertSchema = z.object({
  resolution: z
    .enum(['RESOLVED', 'CANCELLED', 'FALSE_ALARM'])
    .default('RESOLVED'),
  note: z.string().max(500).optional(),
});
export type ResolveEmergencyAlertDto = z.infer<typeof ResolveEmergencyAlertSchema>;

// ============ DTOs ============

export const EmergencyResponderDtoSchema = z.object({
  id: z.string().uuid(),
  alertId: z.string().uuid(),
  responderId: z.string().uuid(),
  status: ResponderStatusEnum,
  distanceMeters: z.number().int().nullable(),
  etaSeconds: z.number().int().nullable(),
  notifiedAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().nullable(),
  arrivedAt: z.string().datetime().nullable(),
  declinedAt: z.string().datetime().nullable(),
  responder: z
    .object({
      id: z.string().uuid(),
      username: z.string(),
      avatarUrl: z.string().url().nullable(),
    })
    .optional(),
});
export type EmergencyResponderDto = z.infer<typeof EmergencyResponderDtoSchema>;

export const EmergencyAlertDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: EmergencyTypeEnum,
  description: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  accuracyMeters: z.number().nullable(),
  radiusMeters: z.number(),
  city: z.string().nullable(),
  status: EmergencyStatusEnum,
  notifiedCount: z.number().int(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  responders: z.array(EmergencyResponderDtoSchema).optional(),
});
export type EmergencyAlertDto = z.infer<typeof EmergencyAlertDtoSchema>;

// WebSocket payload - yakindaki kullanicilara tek seferlik notification.
export const EmergencyNearbyPayloadSchema = z.object({
  alertId: z.string().uuid(),
  requesterId: z.string().uuid(),
  requesterUsername: z.string(),
  type: EmergencyTypeEnum,
  latitude: z.number(),
  longitude: z.number(),
  distanceMeters: z.number(),
  createdAt: z.string().datetime(),
});
export type EmergencyNearbyPayload = z.infer<typeof EmergencyNearbyPayloadSchema>;

// Rate limit response (Spec 8.7.1 - 10dk'da 3 cagri asimi)
export const EmergencyRateLimitErrorSchema = z.object({
  code: z.literal('EMERGENCY_RATE_LIMIT'),
  retryAfterSeconds: z.number().int(),
  accountRestricted: z.boolean(), // Admin'e flag dustu mu
});
export type EmergencyRateLimitError = z.infer<typeof EmergencyRateLimitErrorSchema>;

export const EmergencyAlertsListResponseSchema = z.object({
  alerts: z.array(EmergencyAlertDtoSchema),
});
