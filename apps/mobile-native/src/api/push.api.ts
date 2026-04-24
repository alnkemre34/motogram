import type { RegisterDeviceTokenDto } from '@motogram/shared';
import { DeviceTokenDtoResponseSchema, DevicesListResponseSchema } from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

// Spec 9.3 - Push Notification device kayit

export async function registerDeviceToken(dto: RegisterDeviceTokenDto) {
  return apiRequest('/devices', DeviceTokenDtoResponseSchema, { method: 'POST', body: dto });
}

export async function listMyDevices() {
  return apiRequest('/devices', DevicesListResponseSchema);
}

export async function revokeDeviceToken(token: string): Promise<void> {
  await apiRequest<void>(`/devices/${encodeURIComponent(token)}`, { method: 'DELETE' });
}

