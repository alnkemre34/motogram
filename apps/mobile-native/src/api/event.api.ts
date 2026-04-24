import type { CreateEventDto, EventDetail, NearbyEventsResponse } from '@motogram/shared';
import { EventDetailSchema, NearbyEventsResponseSchema } from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

export async function createEvent(dto: CreateEventDto): Promise<EventDetail> {
  return apiRequest('/events', EventDetailSchema, { method: 'POST', body: dto });
}

export async function getEvent(id: string): Promise<EventDetail> {
  return apiRequest(`/events/${id}`, EventDetailSchema);
}

export async function listNearbyEvents(params: {
  lat: number;
  lng: number;
  radiusMeters?: number;
  limit?: number;
  from?: string;
  to?: string;
}): Promise<NearbyEventsResponse> {
  const q = new URLSearchParams({ lat: String(params.lat), lng: String(params.lng) });
  if (params.radiusMeters) q.set('radius', String(params.radiusMeters));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  return apiRequest(`/events/nearby?${q.toString()}`, NearbyEventsResponseSchema);
}

