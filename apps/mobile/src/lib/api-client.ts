import { TokenPairSchema, type TokenPair } from '@motogram/shared';
import { type ZodTypeAny, type z } from 'zod';

import { env } from '../config/env';
import { StorageKeys, deleteKey, getString, setString } from './storage';

// Spec 8.6 - Access token expire oldugunda /auth/refresh ile yenile, 401'de
// kullaniciyi logout'a dusur. Tek bir in-flight refresh promise'i paylasilir
// (thundering herd onleme).

export interface ApiError {
  error: string;
  code: number;
  details?: unknown;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: ApiError | null,
  ) {
    super(message);
  }
}

let refreshInFlight: Promise<TokenPair | null> | null = null;

async function tryRefresh(): Promise<TokenPair | null> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = getString(StorageKeys.RefreshToken);
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${env.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const raw: unknown = await res.json();
      const pair = parseResponseWithSchema(raw, TokenPairSchema);
      setString(StorageKeys.RefreshToken, pair.refreshToken);
      return pair;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
}

/** Shared with tryRefresh — warn-only unless env.strictSchema */
export function parseResponseWithSchema<S extends ZodTypeAny>(data: unknown, schema: S): z.infer<S> {
  if (env.strictSchema) {
    return schema.parse(data);
  }
  const r = schema.safeParse(data);
  if (!r.success) {
    // eslint-disable-next-line no-console
    console.warn('[api-client] response schema drift', r.error.flatten());
    return data as z.infer<S>;
  }
  return r.data;
}

export async function apiRequest<T>(path: string, options?: RequestOptions): Promise<T>;
export async function apiRequest<S extends ZodTypeAny>(
  path: string,
  schema: S,
  options?: RequestOptions,
): Promise<z.infer<S>>;
export async function apiRequest<T, S extends ZodTypeAny>(
  path: string,
  schemaOrOptions?: RequestOptions | S,
  maybeOptions?: RequestOptions,
): Promise<T | z.infer<S>> {
  const schema =
    schemaOrOptions && typeof schemaOrOptions === 'object' && 'safeParse' in schemaOrOptions
      ? (schemaOrOptions as S)
      : undefined;
  const options: RequestOptions =
    schema !== undefined ? (maybeOptions ?? {}) : ((schemaOrOptions as RequestOptions) ?? {});
  const { body, skipAuth = false, headers: rawHeaders, ...rest } = options;

  const doRequest = async (): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(rawHeaders as Record<string, string> | undefined),
    };
    if (!skipAuth) {
      const token = getString(StorageKeys.AccessToken);
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${env.apiUrl}${path}`, {
      ...rest,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doRequest();

  if (res.status === 401 && !skipAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doRequest();
    } else {
      deleteKey(StorageKeys.AccessToken);
      deleteKey(StorageKeys.RefreshToken);
      deleteKey(StorageKeys.UserId);
    }
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    throw new ApiClientError(
      `API ${res.status} ${path}`,
      res.status,
      data as ApiError | null,
    );
  }

  if (schema) {
    return parseResponseWithSchema(data, schema);
  }

  return data as T;
}
