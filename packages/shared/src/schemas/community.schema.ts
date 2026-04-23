import { z } from 'zod';

import {
  CommunityRoleEnum,
  CommunityVisibilityEnum,
  MemberStatusEnum,
} from '../enums';

// Spec 2.4.2 / 2.4.3 / 3.2 - Topluluklar (kalici gruplar). Partiden farkli
// olarak kalicidir; PostGIS geography(Point) ile radius sorgulari yapilir (8.1).

export const CreateCommunitySchema = z.object({
  name: z.string().trim().min(3).max(60),
  description: z.string().max(2000).optional(),
  avatarUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  visibility: CommunityVisibilityEnum.default('PUBLIC'),
  region: z.string().max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  rules: z.string().max(5000).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
export type CreateCommunityDto = z.infer<typeof CreateCommunitySchema>;

export const UpdateCommunitySchema = CreateCommunitySchema.partial();
export type UpdateCommunityDto = z.infer<typeof UpdateCommunitySchema>;

// Spec 2.4.2 - Public: instant ACTIVE. Private: PENDING onay akisi.
export const JoinCommunitySchema = z.object({
  communityId: z.string().uuid(),
  message: z.string().max(500).optional(),
});
export type JoinCommunityDto = z.infer<typeof JoinCommunitySchema>;

export const RespondCommunityJoinSchema = z.object({
  communityId: z.string().uuid(),
  userId: z.string().uuid(),
  accept: z.boolean(),
});
export type RespondCommunityJoinDto = z.infer<typeof RespondCommunityJoinSchema>;

export const UpdateCommunityMemberRoleSchema = z.object({
  communityId: z.string().uuid(),
  userId: z.string().uuid(),
  role: CommunityRoleEnum,
});
export type UpdateCommunityMemberRoleDto = z.infer<
  typeof UpdateCommunityMemberRoleSchema
>;

export const CommunityMemberSchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
  role: CommunityRoleEnum,
  status: MemberStatusEnum,
  joinedAt: z.string(),
});
export type CommunityMemberDto = z.infer<typeof CommunityMemberSchema>;

export const CommunitySummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  visibility: CommunityVisibilityEnum,
  region: z.string().nullable().optional(),
  tags: z.array(z.string()),
  ownerId: z.string().uuid(),
  membersCount: z.number().int().nonnegative(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  createdAt: z.string(),
});
export type CommunitySummary = z.infer<typeof CommunitySummarySchema>;

export const CommunityDetailSchema = CommunitySummarySchema.extend({
  rules: z.string().nullable().optional(),
  viewerRole: CommunityRoleEnum.nullable().optional(),
  viewerStatus: MemberStatusEnum.nullable().optional(),
});
export type CommunityDetail = z.infer<typeof CommunityDetailSchema>;

// Spec 2.4.2 - Yakindaki Onerilen Topluluklar (PostGIS ST_DWithin)
export const NearbyCommunitiesQuerySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().positive().max(200_000).default(50_000),
  limit: z.number().int().positive().max(50).default(20),
});
export type NearbyCommunitiesQueryDto = z.infer<
  typeof NearbyCommunitiesQuerySchema
>;

export const NearbyCommunitiesResponseSchema = z.object({
  communities: z.array(
    CommunitySummarySchema.extend({
      distance: z.number().nonnegative().nullable(),
    }),
  ),
});
export type NearbyCommunitiesResponse = z.infer<
  typeof NearbyCommunitiesResponseSchema
>;

/** B-12 — İsim / açıklama metni; `PUBLIC` + `PRIVATE` (HIDDEN hariç); `id` ile sayfalama. */
export const CommunitySearchQuerySchema = z.object({
  q: z.string().min(2).max(50),
  limit: z.coerce.number().int().min(1).max(30).default(10),
  cursor: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.string().uuid().optional(),
  ),
});
export type CommunitySearchQueryDto = z.infer<typeof CommunitySearchQuerySchema>;

export const CommunitiesSearchResponseSchema = z.object({
  items: z.array(CommunitySummarySchema),
  nextCursor: z.string().uuid().nullable(),
});
export type CommunitiesSearchResponseDto = z.infer<typeof CommunitiesSearchResponseSchema>;

export const CommunitiesMineResponseSchema = z.object({
  communities: z.array(CommunitySummarySchema),
});

export const CommunityJoinHttpResponseSchema = z.object({
  community: CommunityDetailSchema,
  status: MemberStatusEnum,
});

export const CommunityRespondJoinHttpResponseSchema = z.object({
  status: z.enum(['ACTIVE', 'REJECTED']),
});

export const CommunityMembersResponseSchema = z.object({
  members: z.array(
    z.object({
      userId: z.string().uuid(),
      username: z.string(),
      avatarUrl: z.string().nullable(),
      role: CommunityRoleEnum,
      status: MemberStatusEnum,
      joinedAt: z.string(),
    }),
  ),
});

export const CommunityPendingRequestsResponseSchema = z.object({
  requests: z.array(
    z.object({
      userId: z.string().uuid(),
      username: z.string(),
      avatarUrl: z.string().nullable(),
      requestedAt: z.string(),
    }),
  ),
});
