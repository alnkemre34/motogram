import type { RequestAccountDeletionDto } from '@motogram/shared';
import { AccountDeletionStatusSchema } from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

// Spec 5.2 + 8.11.4 - Hesap silme API.

export async function getAccountDeletionStatus() {
  return apiRequest('/account/deletion', AccountDeletionStatusSchema);
}

export async function requestAccountDeletion(dto: RequestAccountDeletionDto) {
  return apiRequest('/account/deletion', AccountDeletionStatusSchema, { method: 'POST', body: dto });
}

export async function cancelAccountDeletion() {
  return apiRequest('/account/deletion', AccountDeletionStatusSchema, { method: 'DELETE' });
}
