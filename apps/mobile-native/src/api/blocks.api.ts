import { BlockDtoSchema, BlocksListResponseSchema } from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

// B-10 + API_Contract — engellenenler listesi; UNBLOCK: DELETE 204.

export async function fetchBlocks() {
  return apiRequest('/blocks', BlocksListResponseSchema);
}

export async function blockUser(userId: string) {
  return apiRequest(`/blocks/${userId}`, BlockDtoSchema, { method: 'POST' });
}

export async function unblockUser(userId: string) {
  await apiRequest<void>(`/blocks/${userId}`, { method: 'DELETE' });
}
