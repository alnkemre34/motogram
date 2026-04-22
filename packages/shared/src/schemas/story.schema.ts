import { z } from 'zod';

import { StoryMediaTypeEnum } from '../enums';
import { DateLikeSchema } from '../lib/api-response';

// Spec 2.2 - Hikayeler (24 saat), 3.2 - Story modeli

export const StorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  mediaUrl: z.string().url(),
  mediaType: StoryMediaTypeEnum,
  caption: z.string().nullable(),
  locationSticker: z.unknown().nullable(),
  garageSticker: z.unknown().nullable(),
  viewsCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});
export type Story = z.infer<typeof StorySchema>;

export const LocationStickerSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(80).optional(),
});
export type LocationSticker = z.infer<typeof LocationStickerSchema>;

export const GarageStickerSchema = z.object({
  motorcycleId: z.string().uuid(),
});
export type GarageSticker = z.infer<typeof GarageStickerSchema>;

export const CreateStorySchema = z.object({
  mediaUrl: z.string().url(),
  mediaType: StoryMediaTypeEnum,
  caption: z.string().max(200).optional(),
  locationSticker: LocationStickerSchema.optional(),
  garageSticker: GarageStickerSchema.optional(),
});
export type CreateStoryDto = z.infer<typeof CreateStorySchema>;

export const StoryRowResponseSchema = StorySchema.extend({
  createdAt: DateLikeSchema,
  expiresAt: DateLikeSchema,
}).passthrough();

export const StoryFeedItemResponseSchema = StoryRowResponseSchema.extend({
  user: z.object({
    id: z.string().uuid(),
    username: z.string(),
    avatarUrl: z.string().url().nullable().optional(),
  }),
});

export const StoryFeedResponseSchema = z.array(StoryFeedItemResponseSchema);
