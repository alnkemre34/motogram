import { z } from 'zod';

import { MediaTypeEnum } from '../enums';
import { DateLikeSchema, paginated } from '../lib/api-response';

// Spec 3.2 - Post modeli, 7.3.6 (ornek Post Zod semasi tanimli)

export const PostSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  caption: z.string().nullable(),
  mediaUrls: z.array(z.string().url()),
  mediaType: MediaTypeEnum,
  routeId: z.string().uuid().nullable(),
  eventId: z.string().uuid().nullable(),
  groupId: z.string().uuid().nullable(),
  likesCount: z.number().int().nonnegative(),
  commentsCount: z.number().int().nonnegative(),
  sharesCount: z.number().int().nonnegative(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  locationName: z.string().nullable(),
  hashtags: z.array(z.string()),
  mentionedUserIds: z.array(z.string().uuid()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Post = z.infer<typeof PostSchema>;

/** API response (Prisma Date -> string) */
export const PostApiResponseSchema = PostSchema.extend({
  createdAt: DateLikeSchema,
  updatedAt: DateLikeSchema,
}).passthrough();
export type PostApiResponse = z.infer<typeof PostApiResponseSchema>;

export const PostFeedResponseSchema = paginated(PostApiResponseSchema);
export type PostFeedResponse = z.infer<typeof PostFeedResponseSchema>;

/** Feed / user posts — API uses `items` + `nextCursor` (mobile `FeedPage`). */
export const PostAuthorSnippetSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  avatarUrl: z.string().nullable().optional(),
  isVerified: z.boolean(),
});

export const PostFeedItemSchema = PostApiResponseSchema.extend({
  user: PostAuthorSnippetSchema.optional(),
}).passthrough();

export const PostFeedPageSchema = z
  .object({
    items: z.array(PostFeedItemSchema),
    nextCursor: z.string().uuid().nullable(),
  })
  .passthrough();

export const PostDeleteResponseSchema = z.object({ success: z.literal(true) });

// Spec 7.3.6 - ornek CreatePostSchema
export const CreatePostSchema = z.object({
  caption: z.string().max(2200).optional(),
  mediaUrls: z
    .array(z.string().url())
    .min(1, 'media_required')
    .max(10, 'media_too_many'),
  mediaType: MediaTypeEnum,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationName: z.string().max(120).optional(),
  hashtags: z.array(z.string().max(50)).max(30).default([]),
  mentionedUserIds: z.array(z.string().uuid()).max(50).default([]),
  routeId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
});
export type CreatePostDto = z.infer<typeof CreatePostSchema>;

export const UpdatePostSchema = z
  .object({
    caption: z.string().max(2200).optional(),
    hashtags: z.array(z.string().max(50)).max(30).optional(),
  })
  .strict();
export type UpdatePostDto = z.infer<typeof UpdatePostSchema>;

export const PostFeedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PostFeedQueryDto = z.infer<typeof PostFeedQuerySchema>;
