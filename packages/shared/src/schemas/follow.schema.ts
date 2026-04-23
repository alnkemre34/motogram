import { z } from 'zod';

import { FollowStatusEnum } from '../enums';

import { UserPublicApiResponseSchema } from './user.schema';

// Spec 3.2 - Follow modeli

export const FollowSchema = z.object({
  id: z.string().uuid(),
  followerId: z.string().uuid(),
  followingId: z.string().uuid(),
  status: FollowStatusEnum,
  createdAt: z.string().datetime(),
});
export type Follow = z.infer<typeof FollowSchema>;

export const FollowActionSchema = z.object({
  targetUserId: z.string().uuid('user_id_invalid'),
});
export type FollowActionDto = z.infer<typeof FollowActionSchema>;

/** B-09 — Takipçi / takip listesi satırı: public profil + izleyicinin bu kullanıcıyı takip edip etmediği. */
export const FollowListUserSchema = UserPublicApiResponseSchema.extend({
  isFollowedByMe: z.boolean(),
});
export type FollowListUser = z.infer<typeof FollowListUserSchema>;

export const FollowListQuerySchema = z.object({
  cursor: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.string().uuid().optional(),
  ),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type FollowListQueryDto = z.infer<typeof FollowListQuerySchema>;

export const FollowListPageResponseSchema = z.object({
  items: z.array(FollowListUserSchema),
  nextCursor: z.string().uuid().nullable(),
});
export type FollowListPageDto = z.infer<typeof FollowListPageResponseSchema>;
