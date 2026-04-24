import type {
  CreatePartyDto,
  NearbyPartiesResponse,
  PartyDetail,
  RespondPartyInviteDto,
} from '@motogram/shared';
import {
  CreatePartySchema,
  InviteToPartySchema,
  JoinPartySchema,
  NearbyPartiesResponseSchema,
  PartyDetailSchema,
  PartyInviteBatchResponseSchema,
  PartyInvitesMineResponseSchema,
  PartyLeaveHttpResponseSchema,
  PartyRespondInviteHttpResponseSchema,
  PartySummarySchema,
  RespondPartyInviteSchema,
} from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

export async function createParty(dto: CreatePartyDto) {
  const body = CreatePartySchema.parse(dto);
  return apiRequest('/parties', PartySummarySchema, { method: 'POST', body });
}

export async function joinParty(partyId: string, inviteId?: string): Promise<PartyDetail> {
  JoinPartySchema.parse({ partyId, inviteId });
  const body: { inviteId?: string } = {};
  if (inviteId) body.inviteId = inviteId;
  return apiRequest(`/parties/${partyId}/join`, PartyDetailSchema, { method: 'POST', body });
}

export async function leaveParty(partyId: string) {
  return apiRequest(`/parties/${partyId}/leave`, PartyLeaveHttpResponseSchema, {
    method: 'POST',
    body: {},
  });
}

export async function getParty(partyId: string): Promise<PartyDetail> {
  return apiRequest(`/parties/${partyId}`, PartyDetailSchema);
}

export async function listNearbyParties(params: {
  lat: number;
  lng: number;
  radiusMeters?: number;
}): Promise<NearbyPartiesResponse> {
  const search = new URLSearchParams();
  search.set('lat', String(params.lat));
  search.set('lng', String(params.lng));
  if (params.radiusMeters) search.set('radius', String(params.radiusMeters));
  return apiRequest(`/parties?${search.toString()}`, NearbyPartiesResponseSchema);
}

export async function invitePartyMember(partyId: string, dto: { userIds: string[] }) {
  const body = InviteToPartySchema.parse({ partyId, userIds: dto.userIds });
  return apiRequest(`/parties/${partyId}/invite`, PartyInviteBatchResponseSchema, {
    method: 'POST',
    body: { userIds: body.userIds },
  });
}

export async function listMyInvites() {
  return apiRequest('/parties/invites/me', PartyInvitesMineResponseSchema);
}

export async function respondInvite(dto: RespondPartyInviteDto) {
  const body = RespondPartyInviteSchema.parse(dto);
  return apiRequest('/parties/invites/respond', PartyRespondInviteHttpResponseSchema, {
    method: 'POST',
    body,
  });
}
