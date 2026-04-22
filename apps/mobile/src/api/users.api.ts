import { UserMeResponseSchema } from '@motogram/shared';
import type { z } from 'zod';

import { apiRequest } from '../lib/api-client';

/** `GET /users/me` — shared şema; backend `UsersController` ile aynı. */
export async function getCurrentUser() {
  return apiRequest('/users/me', UserMeResponseSchema);
}

export type MeResponse = z.infer<typeof UserMeResponseSchema>;
