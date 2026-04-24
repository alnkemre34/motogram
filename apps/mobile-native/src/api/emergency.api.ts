import type { CreateEmergencyAlertDto, CreateEmergencyContactDto } from '@motogram/shared';
import {
  EmergencyAlertDtoSchema,
  EmergencyContactRowSchema,
  EmergencyContactsListResponseSchema,
} from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

export async function createEmergencyAlert(dto: CreateEmergencyAlertDto) {
  return apiRequest('/emergency/alerts', EmergencyAlertDtoSchema, { method: 'POST', body: dto });
}

// B-15 — acil kişi listesi (ayarlar ekranı).

export async function listEmergencyContacts() {
  return apiRequest('/emergency/contacts', EmergencyContactsListResponseSchema);
}

export async function createEmergencyContact(dto: CreateEmergencyContactDto) {
  return apiRequest('/emergency/contacts', EmergencyContactRowSchema, { method: 'POST', body: dto });
}

export async function deleteEmergencyContact(id: string) {
  await apiRequest<void>(`/emergency/contacts/${id}`, { method: 'DELETE' });
}

