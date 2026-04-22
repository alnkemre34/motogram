import type { ShowcaseUserBadgeDto } from '@motogram/shared';
import {
  UserBadgeDtoSchema,
  UserBadgesListResponseSchema,
  UserQuestsListResponseSchema,
} from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

// Spec 2.6 + 3.6 - Rozet ve Gorev API.

export async function listMyBadges() {
  return apiRequest('/gamification/badges', UserBadgesListResponseSchema);
}

export async function listMyQuests() {
  return apiRequest('/gamification/quests', UserQuestsListResponseSchema);
}

export async function toggleBadgeShowcase(dto: ShowcaseUserBadgeDto) {
  return apiRequest('/gamification/badges/showcase', UserBadgeDtoSchema, { method: 'POST', body: dto });
}
