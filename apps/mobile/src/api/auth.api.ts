import type {
  AppleSignInDto,
  AuthResult,
  ChangeEmailRequestDto,
  ChangeEmailVerifyDto,
  ChangePasswordDto,
  GoogleSignInDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
} from '@motogram/shared';
import {
  AuthResultSchema,
  ChangeEmailResponseSchema,
  ChangeEmailVerifyResponseSchema,
  ChangePasswordResponseSchema,
  TokenPairSchema,
} from '@motogram/shared';

import { authPaths } from './auth-paths';
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

export function appleSignInRequest(dto: AppleSignInDto): Promise<AuthResult> {
  return apiRequest(authPaths.oauthApple, AuthResultSchema, {
    method: 'POST',
    body: dto,
    skipAuth: true,
  });
}

export function googleSignInRequest(dto: GoogleSignInDto): Promise<AuthResult> {
  return apiRequest(authPaths.oauthGoogle, AuthResultSchema, {
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

/** POST /auth/password/change — B-04. */
export function changePasswordRequest(dto: ChangePasswordDto) {
  return apiRequest('/auth/password/change', ChangePasswordResponseSchema, {
    method: 'POST',
    body: dto,
  });
}

export function requestEmailChange(dto: ChangeEmailRequestDto) {
  return apiRequest('/auth/email/change', ChangeEmailResponseSchema, { method: 'POST', body: dto });
}

export function verifyEmailChange(dto: ChangeEmailVerifyDto) {
  return apiRequest('/auth/email/verify', ChangeEmailVerifyResponseSchema, {
    method: 'POST',
    body: dto,
    skipAuth: true,
  });
}
