import type {
  CommunityDetail,
  CreateCommunityDto,
  JoinCommunityDto,
  NearbyCommunitiesResponse,
  RespondCommunityJoinDto,
  UpdateCommunityDto,
  UpdateCommunityMemberRoleDto,
} from '@motogram/shared';
import {
  CommunitiesMineResponseSchema,
  CommunityDetailSchema,
  CommunityJoinHttpResponseSchema,
  CommunityMembersResponseSchema,
  CommunityPendingRequestsResponseSchema,
  CommunityRespondJoinHttpResponseSchema,
  NearbyCommunitiesResponseSchema,
  OkTrueSchema,
} from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

// Spec 2.4 - Topluluk Yonetimi REST

export async function createCommunity(dto: CreateCommunityDto): Promise<CommunityDetail> {
  return apiRequest('/communities', CommunityDetailSchema, { method: 'POST', body: dto });
}

export async function updateCommunity(
  id: string,
  dto: UpdateCommunityDto,
): Promise<CommunityDetail> {
  return apiRequest(`/communities/${id}`, CommunityDetailSchema, { method: 'PUT', body: dto });
}

export async function getCommunity(id: string): Promise<CommunityDetail> {
  return apiRequest(`/communities/${id}`, CommunityDetailSchema);
}

export async function listMyCommunities() {
  return apiRequest('/communities/me', CommunitiesMineResponseSchema);
}

export async function listNearbyCommunities(params: {
  lat: number;
  lng: number;
  radius?: number;
  limit?: number;
}): Promise<NearbyCommunitiesResponse> {
  const q = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
  });
  if (params.radius) q.set('radius', String(params.radius));
  if (params.limit) q.set('limit', String(params.limit));
  return apiRequest(`/communities/nearby?${q.toString()}`, NearbyCommunitiesResponseSchema);
}

export async function listCommunityMembers(id: string) {
  return apiRequest(`/communities/${id}/members`, CommunityMembersResponseSchema);
}

export async function joinCommunity(id: string, dto: Omit<JoinCommunityDto, 'communityId'> = {}) {
  return apiRequest(`/communities/${id}/join`, CommunityJoinHttpResponseSchema, {
    method: 'POST',
    body: dto,
  });
}

export async function leaveCommunity(id: string): Promise<void> {
  await apiRequest<void>(`/communities/${id}/leave`, { method: 'DELETE' });
}

export async function respondCommunityJoin(
  id: string,
  dto: Omit<RespondCommunityJoinDto, 'communityId'>,
) {
  return apiRequest(`/communities/${id}/respond-join`, CommunityRespondJoinHttpResponseSchema, {
    method: 'POST',
    body: dto,
  });
}

export async function updateCommunityMemberRole(
  id: string,
  dto: Omit<UpdateCommunityMemberRoleDto, 'communityId'>,
) {
  return apiRequest(`/communities/${id}/members/role`, OkTrueSchema, { method: 'POST', body: dto });
}

export async function listCommunityPendingRequests(id: string) {
  return apiRequest(`/communities/${id}/pending`, CommunityPendingRequestsResponseSchema);
}
