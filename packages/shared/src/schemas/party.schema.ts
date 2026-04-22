import { z } from 'zod';

import {
  PartyInviteStatusEnum,
  PartyRoleEnum,
  PartyStatusEnum,
  RoutePrivacyEnum,
} from '../enums';
import { DateLikeSchema } from '../lib/api-response';

// Spec 3.2 - Party modelinin kullanici-yuz (REST + WS payload) kontrati.

export const PartyWaypointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(120).optional(),
});
export type PartyWaypoint = z.infer<typeof PartyWaypointSchema>;

export const RouteSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  distance: z.number().nonnegative(),
  estimatedDuration: z.number().int().nonnegative(),
  waypoints: z.array(PartyWaypointSchema),
  privacy: RoutePrivacyEnum,
});
export type RouteSummary = z.infer<typeof RouteSummarySchema>;

// Spec 2.4.1 / 2.4.2 - Parti olustur.
export const CreatePartySchema = z.object({
  name: z.string().trim().min(2).max(60),
  routeId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  isPrivate: z.boolean().default(false),
  maxMembers: z.number().int().min(2).max(50).default(20),
  // Spec 2.4.2 - Parti olustururken coLeaders en fazla 3 (urun karari)
  coLeaderIds: z.array(z.string().uuid()).max(3).default([]),
});
export type CreatePartyDto = z.infer<typeof CreatePartySchema>;

export const JoinPartySchema = z.object({
  partyId: z.string().uuid(),
  inviteId: z.string().uuid().optional(),
});
export type JoinPartyDto = z.infer<typeof JoinPartySchema>;

export const InviteToPartySchema = z.object({
  partyId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1).max(20),
});
export type InviteToPartyDto = z.infer<typeof InviteToPartySchema>;

export const RespondPartyInviteSchema = z.object({
  inviteId: z.string().uuid(),
  accept: z.boolean(),
});
export type RespondPartyInviteDto = z.infer<typeof RespondPartyInviteSchema>;

export const PartyMemberSchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
  role: PartyRoleEnum,
  isOnline: z.boolean(),
  joinedAt: z.string(), // ISO
});
export type PartyMemberDto = z.infer<typeof PartyMemberSchema>;

export const PartySummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  leaderId: z.string().uuid(),
  coLeaderIds: z.array(z.string().uuid()),
  status: PartyStatusEnum,
  routeId: z.string().uuid().nullable().optional(),
  route: RouteSummarySchema.nullable().optional(),
  memberCount: z.number().int().nonnegative(),
  isPrivate: z.boolean(),
  maxMembers: z.number().int().positive(),
  startedAt: z.string().nullable().optional(),
  endedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type PartySummary = z.infer<typeof PartySummarySchema>;

export const PartyDetailSchema = PartySummarySchema.extend({
  members: z.array(PartyMemberSchema),
});
export type PartyDetail = z.infer<typeof PartyDetailSchema>;

export const NearbyPartiesQuerySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().positive().max(50000).default(10000),
  limit: z.number().int().positive().max(50).default(20),
});
export type NearbyPartiesQueryDto = z.infer<typeof NearbyPartiesQuerySchema>;

export const NearbyPartiesResponseSchema = z.object({
  parties: z.array(
    PartySummarySchema.extend({
      distance: z.number().nonnegative().nullable(),
    }),
  ),
});
export type NearbyPartiesResponse = z.infer<typeof NearbyPartiesResponseSchema>;

export const PartyInviteSchema = z.object({
  id: z.string().uuid(),
  partyId: z.string().uuid(),
  inviterId: z.string().uuid(),
  inviteeId: z.string().uuid(),
  status: PartyInviteStatusEnum,
  createdAt: z.string(),
});
export type PartyInviteDto = z.infer<typeof PartyInviteSchema>;

export const PartyLeaveHttpResponseSchema = z.object({
  ended: z.boolean(),
  newLeaderId: z.string().uuid().nullable(),
});

export const PartyInviteBatchResponseSchema = z.object({
  created: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});

export const PartyRespondInviteHttpResponseSchema = z.object({
  joined: z.boolean(),
  partyId: z.string().uuid().nullable(),
});

/** /parties/invites/me — Prisma ham satir (party + inviter ic nested) */
export const PartyInviteMineRowSchema = z
  .object({
    id: z.string().uuid(),
    partyId: z.string().uuid(),
    inviterId: z.string().uuid(),
    inviteeId: z.string().uuid(),
    status: PartyInviteStatusEnum,
    createdAt: DateLikeSchema,
  })
  .passthrough();

export const PartyInvitesMineResponseSchema = z.array(PartyInviteMineRowSchema);
