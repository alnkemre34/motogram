import type {
  CreateEventDto,
  EventDetail,
  NearbyEventsResponse,
  RsvpEventDto,
  UpdateEventDto,
} from '@motogram/shared';
import {
  EventDetailSchema,
  EventParticipantsResponseSchema,
  EventRsvpResponseSchema,
  EventsMineResponseSchema,
  NearbyEventsResponseSchema,
} from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

// Spec 2.4.3 / 3.2 / 8.1 - Etkinlik REST

export async function createEvent(dto: CreateEventDto): Promise<EventDetail> {
  return apiRequest('/events', EventDetailSchema, { method: 'POST', body: dto });
}

export async function updateEvent(id: string, dto: UpdateEventDto): Promise<EventDetail> {
  return apiRequest(`/events/${id}`, EventDetailSchema, { method: 'PUT', body: dto });
}

export async function getEvent(id: string): Promise<EventDetail> {
  return apiRequest(`/events/${id}`, EventDetailSchema);
}

export async function listMyEvents() {
  return apiRequest('/events/me', EventsMineResponseSchema);
}

export async function listNearbyEvents(params: {
  lat: number;
  lng: number;
  radius?: number;
  limit?: number;
  from?: string;
  to?: string;
}): Promise<NearbyEventsResponse> {
  const q = new URLSearchParams({ lat: String(params.lat), lng: String(params.lng) });
  if (params.radius) q.set('radius', String(params.radius));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  return apiRequest(`/events/nearby?${q.toString()}`, NearbyEventsResponseSchema);
}

export async function listEventParticipants(id: string) {
  return apiRequest(`/events/${id}/participants`, EventParticipantsResponseSchema);
}

export async function rsvpEvent(id: string, dto: Omit<RsvpEventDto, 'eventId'>) {
  return apiRequest(`/events/${id}/rsvp`, EventRsvpResponseSchema, { method: 'POST', body: dto });
}

export async function deleteEvent(id: string): Promise<void> {
  await apiRequest<void>(`/events/${id}`, { method: 'DELETE' });
}
