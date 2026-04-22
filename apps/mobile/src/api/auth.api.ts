import type {
  AuthResult,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
} from '@motogram/shared';
import { AuthResultSchema, TokenPairSchema } from '@motogram/shared';

import { apiRequest } from '../lib/api-client';

export type { AuthResult };

export function registerRequest(dto: RegisterDto): Promise<AuthResult> {
  return apiRequest('/auth/register', AuthResultSchema, {
    method: 'POST',
    body: dto,
    skipAuth: true,
  });
}

export function loginRequest(dto: LoginDto): Promise<AuthResult> {
  return apiRequest('/auth/login', AuthResultSchema, {
    method: 'POST',
    body: dto,
    skipAuth: true,
  });
}

export function refreshRequest(dto: RefreshTokenDto) {
  return apiRequest('/auth/refresh', TokenPairSchema, {
    method: 'POST',
    body: dto,
    skipAuth: true,
  });
}

export function logoutRequest(allDevices = false): Promise<void> {
  return apiRequest<void>('/auth/logout', {
    method: 'POST',
    body: { allDevices },
  });
}
