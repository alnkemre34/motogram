import type {
  CreateEmergencyAlertDto,
  RespondEmergencyAlertDto,
  ResolveEmergencyAlertDto,
} from '@motogram/shared';
import {
  EmergencyAlertDtoSchema,
  EmergencyAlertsListResponseSchema,
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
