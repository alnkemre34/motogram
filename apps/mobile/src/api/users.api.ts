import {
  type ChangeUsernameDto,
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

/** `GET /users/:username` — büyük/küçük harf API’de case-insensitive eşleşir; path segment encode. */
export async function getUserByUsername(username: string) {
  const path = encodeURIComponent(username.trim());
  return apiRequest(`/users/${path}`, UserPublicApiResponseSchema);
}

export async function changeUsername(dto: ChangeUsernameDto) {
  return apiRequest('/users/me/username', UserPublicApiResponseSchema, { method: 'PATCH', body: dto });
}

export type MeResponse = z.infer<typeof UserMeResponseSchema>;
export type PublicUserResponse = z.infer<typeof UserPublicApiResponseSchema>;
