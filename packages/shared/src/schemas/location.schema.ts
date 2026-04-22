import { z } from 'zod';

import { LocationSharingModeEnum, SessionSourceEnum, ThermalStateEnum } from '../enums';
import { DateLikeSchema } from '../lib/api-response';

// Spec 3.3.2 - Konum guncelleme akisi
// Client -> POST /v1/map/update-location (REST) veya WS emit('location:update')
// Rate limit: 1/sn (Spec 7.3.5) - server-side enforce.

export const LatitudeSchema = z.number().min(-90).max(90);
export const LongitudeSchema = z.number().min(-180).max(180);

export const UpdateLocationSchema = z.object({
  lat: LatitudeSchema,
  lng: LongitudeSchema,
  heading: z.number().min(0).max(360).optional(), // derece (0-360)
  speed: z.number().min(0).max(300).optional(),   // m/s (motosiklet > 300 olmaz)
  accuracy: z.number().positive().optional(),     // metre
  batteryLevel: z.number().min(0).max(1).optional(),
  thermalState: ThermalStateEnum.optional(),       // Spec 7.1.2 - frekans kararinin sunucuya bilgilendirilmesi
  city: z.string().min(1).max(100).optional(),     // Spec 8.3 - shard anahtari
  source: SessionSourceEnum.optional(),            // PARTY/EMERGENCY icin context
  partyId: z.string().uuid().optional(),
  clientTimestamp: z.number().int().positive(),    // millis - replay ve clock drift kontrolu
});
export type UpdateLocationDto = z.infer<typeof UpdateLocationSchema>;

// Spec 3.3.3 - Yakindaki sorgular (REST)
// GET /v1/map/nearby?lat=&lng=&radius=&filter=
export const NearbyQuerySchema = z.object({
  lat: LatitudeSchema,
  lng: LongitudeSchema,
  radius: z.number().positive().max(50000).default(5000), // metre (max 50km)
  filter: z.enum(['NEARBY', 'FRIENDS', 'PARTIES', 'EVENTS']).default('NEARBY'),
  limit: z.number().int().positive().max(100).default(50),
  city: z.string().min(1).max(100).optional(),
});
export type NearbyQueryDto = z.infer<typeof NearbyQuerySchema>;

// Spec 2.3.1 - Panel icin viewport bbox sorgusu (opsiyonel, cluster icin)
export const BoundingBoxQuerySchema = z.object({
  swLat: LatitudeSchema,
  swLng: LongitudeSchema,
  neLat: LatitudeSchema,
  neLng: LongitudeSchema,
  filter: z.enum(['NEARBY', 'FRIENDS', 'PARTIES', 'EVENTS']).default('NEARBY'),
  city: z.string().min(1).max(100).optional(),
});
export type BoundingBoxQueryDto = z.infer<typeof BoundingBoxQuerySchema>;

export const NearbyRiderSchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
  lat: LatitudeSchema,
  lng: LongitudeSchema,
  distance: z.number().nonnegative(),   // metre
  inParty: z.boolean().default(false),
  partyId: z.string().uuid().nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  lastPingAt: z.number().int().positive(), // millis
});
export type NearbyRider = z.infer<typeof NearbyRiderSchema>;

export const NearbyRidersResponseSchema = z.object({
  riders: z.array(NearbyRiderSchema),
  shard: z.string(),
  queryDurationMs: z.number().nonnegative(), // Spec 5.3 - observability
});
export type NearbyRidersResponse = z.infer<typeof NearbyRidersResponseSchema>;

// Spec 5.1 - Konum gizliligi modu degistirme (user settings altinda)
export const UpdateLocationSharingSchema = z.object({
  mode: LocationSharingModeEnum,
});
export type UpdateLocationSharingDto = z.infer<typeof UpdateLocationSharingSchema>;

// Spec 3.3.2 - Live session start/stop (client bildirir)
export const StartLiveSessionSchema = z.object({
  source: SessionSourceEnum.default('GLOBAL_VISIBILITY'),
  sourceId: z.string().uuid().optional(),
  visibility: LocationSharingModeEnum.default('FOLLOWERS_ONLY'),
  expiresInMinutes: z.number().int().positive().max(480).default(120), // max 8 saat
});
export type StartLiveSessionDto = z.infer<typeof StartLiveSessionSchema>;

/** /location/update cevabi */
export const UpdateLocationHttpResponseSchema = z.object({
  accepted: z.boolean(),
  shard: z.string(),
  durationMs: z.number(),
  skipped: z.enum(['rate_limited', 'sharing_disabled']).optional(),
});

/** Prisma LiveLocationSession */
export const LiveLocationSessionResponseSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    sourceType: SessionSourceEnum,
    sourceId: z.string().uuid().nullable(),
    visibilityMode: LocationSharingModeEnum,
    startedAt: DateLikeSchema,
    expiresAt: DateLikeSchema,
    isActive: z.boolean(),
  })
  .passthrough();

export const LocationSharingUserResponseSchema = z.object({
  id: z.string().uuid(),
  locationSharing: LocationSharingModeEnum,
});

export const StopLiveSessionSchema = z.object({
  sessionId: z.string().uuid().optional(), // opsiyonel (kullanici tek aktif session'a sahip - userId unique)
});
export type StopLiveSessionDto = z.infer<typeof StopLiveSessionSchema>;
