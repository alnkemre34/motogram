import type {
  CreateEmergencyAlertDto,
  CreateEmergencyContactDto,
  RespondEmergencyAlertDto,
  ResolveEmergencyAlertDto,
} from '@motogram/shared';
import {
  EmergencyAlertDtoSchema,
  EmergencyAlertsListResponseSchema,
  EmergencyContactRowSchema,
  EmergencyContactsListResponseSchema,
  EmergencyResponderDtoSchema,
} from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

// Spec 2.3.2 + 4.4 - Acil Durum / SOS.

export async function createEmergencyAlert(dto: CreateEmergencyAlertDto) {
  return apiRequest('/emergency/alerts', EmergencyAlertDtoSchema, { method: 'POST', body: dto });
}

export async function listMyEmergencyAlerts() {
  return apiRequest('/emergency/alerts', EmergencyAlertsListResponseSchema);
}

export async function getEmergencyAlert(id: string) {
  return apiRequest(`/emergency/alerts/${id}`, EmergencyAlertDtoSchema);
}

export async function respondEmergencyAlert(
  id: string,
  dto: RespondEmergencyAlertDto,
) {
  return apiRequest(`/emergency/alerts/${id}/respond`, EmergencyResponderDtoSchema, {
    method: 'POST',
    body: dto,
  });
}

export async function resolveEmergencyAlert(id: string, dto: ResolveEmergencyAlertDto) {
  return apiRequest(`/emergency/alerts/${id}/resolve`, EmergencyAlertDtoSchema, {
    method: 'POST',
    body: dto,
  });
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
