import type {
  NearbyRidersResponse,
  StartLiveSessionDto,
  UpdateLocationDto,
  UpdateLocationSharingDto,
} from '@motogram/shared';
import type { z } from 'zod';
import {
  LiveLocationSessionResponseSchema,
  LocationSharingUserResponseSchema,
  NearbyRidersResponseSchema,
  UpdateLocationHttpResponseSchema,
} from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

export async function fetchNearbyRiders(params: {
  lat: number;
  lng: number;
  radius: number;
  filter: 'NEARBY' | 'FRIENDS' | 'PARTIES' | 'EVENTS';
  city?: string;
}): Promise<NearbyRidersResponse> {
  const search = new URLSearchParams();
  search.set('lat', String(params.lat));
  search.set('lng', String(params.lng));
  search.set('radius', String(params.radius));
  search.set('filter', params.filter);
  if (params.city) search.set('city', params.city);
  return apiRequest(`/map/nearby?${search.toString()}`, NearbyRidersResponseSchema);
}

export async function sendLocationUpdate(
  dto: UpdateLocationDto,
): Promise<z.infer<typeof UpdateLocationHttpResponseSchema>> {
  return apiRequest('/location/update', UpdateLocationHttpResponseSchema, { method: 'PUT', body: dto });
}

export async function startLiveLocationSession(dto: StartLiveSessionDto) {
  return apiRequest('/location/session/start', LiveLocationSessionResponseSchema, {
    method: 'POST',
    body: dto,
  });
}

export async function stopLiveLocationSession() {
  return apiRequest<void>('/location/session/stop', { method: 'POST', body: {} });
}

export async function updateLocationSharing(dto: UpdateLocationSharingDto) {
  return apiRequest('/location/sharing', LocationSharingUserResponseSchema, { method: 'PUT', body: dto });
}
