import type {
  AppleSignInDto,
  AuthResult,
  ChangeEmailRequestDto,
  ChangeEmailVerifyDto,
  ChangePasswordDto,
  GoogleSignInDto,
  LoginDto,
  OtpRequestDto,
  OtpVerifyDto,
  RefreshTokenDto,
  RegisterDto,
} from '@motogram/shared';
import {
  AuthCapabilitiesSchema,
  AuthResultSchema,
  ChangeEmailResponseSchema,
  ChangeEmailVerifyResponseSchema,
  ChangePasswordResponseSchema,
  OtpRequestResponseSchema,
  OtpVerifyResponseSchema,
  TokenPairSchema,
} from '@motogram/shared';

import { authPaths } from './auth-paths';
import { apiRequest } from '../lib/api-client';

export type { AuthResult };

/** GET /auth/capabilities — pre-login auth yüzeyleri (OTP bayrağı). */
export function fetchAuthCapabilities() {
  return apiRequest(authPaths.capabilities, AuthCapabilitiesSchema, {
    method: 'GET',
    skipAuth: true,
  });
}

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

/** POST /auth/otp/request — B-16. */
export function requestOtp(dto: OtpRequestDto) {
  return apiRequest('/auth/otp/request', OtpRequestResponseSchema, {
    method: 'POST',
    body: dto,
    skipAuth: true,
  });
}

/** POST /auth/otp/verify — B-16. */
export function verifyOtp(dto: OtpVerifyDto) {
  return apiRequest('/auth/otp/verify', OtpVerifyResponseSchema, {
    method: 'POST',
    body: dto,
    skipAuth: true,
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

