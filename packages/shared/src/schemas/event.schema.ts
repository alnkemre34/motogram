import { z } from 'zod';

import { EventVisibilityEnum, RsvpStatusEnum } from '../enums';

// Spec 2.4.3 / 3.2 / 8.1 - Etkinlikler (Community'ye bagli veya bagimsiz).
// PostGIS meeting_point_geo (geography Point 4326) + GIST index -> ST_DWithin.

export const CreateEventSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().max(5000).optional(),
  communityId: z.string().uuid().optional(),
  coHostIds: z.array(z.string().uuid()).max(10).default([]),
  routeId: z.string().uuid().optional(),
  meetingPointLat: z.number().min(-90).max(90),
  meetingPointLng: z.number().min(-180).max(180),
  meetingPointName: z.string().trim().min(2).max(200),
  startTime: z.coerce.date(),
  endTime: z.coerce.date().optional(),
  visibility: EventVisibilityEnum.default('PUBLIC'),
  difficulty: z.string().max(30).optional(),
  distance: z.number().nonnegative().optional(),
  category: z.string().max(30).optional(),
  maxParticipants: z.number().int().positive().max(10_000).optional(),
  rules: z.string().max(5000).optional(),
});
export type CreateEventDto = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = CreateEventSchema.partial();
export type UpdateEventDto = z.infer<typeof UpdateEventSchema>;

// Spec 3.2 - RSVP akisi (GOING / INTERESTED / NOT_GOING / WAITLIST)
export const RsvpEventSchema = z.object({
  eventId: z.string().uuid(),
  status: RsvpStatusEnum,
});
export type RsvpEventDto = z.infer<typeof RsvpEventSchema>;

export const EventParticipantSchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
  rsvpStatus: RsvpStatusEnum,
  checkedIn: z.boolean(),
  joinedAt: z.string(),
});
export type EventParticipantDto = z.infer<typeof EventParticipantSchema>;

export const EventSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  organizerId: z.string().uuid(),
  communityId: z.string().uuid().nullable().optional(),
  meetingPointLat: z.number(),
  meetingPointLng: z.number(),
  meetingPointName: z.string(),
  startTime: z.string(),
  endTime: z.string().nullable().optional(),
  visibility: EventVisibilityEnum,
  difficulty: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  maxParticipants: z.number().int().nullable().optional(),
  participantsCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type EventSummary = z.infer<typeof EventSummarySchema>;

export const EventDetailSchema = EventSummarySchema.extend({
  rules: z.string().nullable().optional(),
  routeId: z.string().uuid().nullable().optional(),
  coHostIds: z.array(z.string().uuid()),
  viewerRsvp: RsvpStatusEnum.nullable().optional(),
});
export type EventDetail = z.infer<typeof EventDetailSchema>;

// Spec 8.1 - Yakindaki Etkinlikler: PostGIS ST_DWithin
export const NearbyEventsQuerySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().positive().max(200_000).default(50_000),
  limit: z.number().int().positive().max(50).default(20),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type NearbyEventsQueryDto = z.infer<typeof NearbyEventsQuerySchema>;

export const NearbyEventsResponseSchema = z.object({
  events: z.array(
    EventSummarySchema.extend({ distance: z.number().nonnegative().nullable() }),
  ),
});
export type NearbyEventsResponse = z.infer<typeof NearbyEventsResponseSchema>;

export const EventsMineResponseSchema = z.object({
  events: z.array(EventSummarySchema),
});

export const EventParticipantsResponseSchema = z.object({
  participants: z.array(EventParticipantSchema),
});

export const EventRsvpResponseSchema = z.object({
  rsvpStatus: RsvpStatusEnum,
  promotedFromWaitlist: z.array(z.string().uuid()).optional(),
});
