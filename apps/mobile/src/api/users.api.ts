import {
  type UpdateProfileDto,
  UserMeResponseSchema,
  UserPublicApiResponseSchema,
} from '@motogram/shared';
import type { z } from 'zod';

import { apiRequest } from '../lib/api-client';

/** `GET /users/me` — shared şema; backend `UsersController` ile aynı. */
export async function getCurrentUser() {
  return apiRequest('/users/me', UserMeResponseSchema);
}

/** `PATCH /users/me` — yanıt public profil; ardından `['me']` invalidation önerilir. */
export async function updateCurrentUser(dto: UpdateProfileDto) {
  return apiRequest('/users/me', UserPublicApiResponseSchema, { method: 'PATCH', body: dto });
}

export type MeResponse = z.infer<typeof UserMeResponseSchema>;
