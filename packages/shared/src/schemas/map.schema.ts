import { z } from 'zod';

import { MapFilterEnum } from '../enums';
import { LatitudeSchema, LongitudeSchema } from './location.schema';

// Spec 2.3.1 - Keşif Modu filtreleri + harita markerlari (Sağ Panel Çekmecesi içerik)
// NOT: Party/Event tipli markerlar Faz 3/4'te aktif veri ile dolar; Faz 2'de
// placeholder donerek shape sabit kalir (Kural 5 - mock veri yasak,
// gercek sema UI'a yansiyor).

export const MapMarkerTypeEnum = z.enum(['RIDER', 'PARTY', 'EVENT']);
export type MapMarkerType = z.infer<typeof MapMarkerTypeEnum>;

export const MapMarkerSchema = z.object({
  id: z.string(),                         // userId / partyId / eventId
  type: MapMarkerTypeEnum,
  lat: LatitudeSchema,
  lng: LongitudeSchema,
  label: z.string().optional(),           // username / party name
  avatarUrl: z.string().url().nullable().optional(),
  distance: z.number().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type MapMarker = z.infer<typeof MapMarkerSchema>;

export const DiscoverFiltersSchema = z.object({
  filter: MapFilterEnum.default('NEARBY'),
  radiusMeters: z.number().positive().max(50000).default(5000),
  ridingStyle: z.array(z.string()).max(10).default([]),
});
export type DiscoverFilters = z.infer<typeof DiscoverFiltersSchema>;

// Spec 3.3.3 - WebSocket event payload'lari (Faz 3'te tam aktif, Faz 2'de iskelet)
/** GET /map/shards — shard rider counts */
export const MapShardStatsRowSchema = z.object({
  shard: z.string(),
  count: z.number().int().nonnegative(),
});
export const MapShardStatsResponseSchema = z.array(MapShardStatsRowSchema);

export const LocationBroadcastSchema = z.object({
  userId: z.string().uuid(),
  lat: LatitudeSchema,
  lng: LongitudeSchema,
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).max(300).optional(),
  timestamp: z.number().int().positive(),
  inParty: z.boolean().default(false),
});
export type LocationBroadcast = z.infer<typeof LocationBroadcastSchema>;
