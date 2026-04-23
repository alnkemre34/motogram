import type {
  ApiMethod,
  ApiPath,
  ApiPathParams,
  ApiQueryParams,
  ApiRequestBody,
} from './api-contract';

/**
 * IMPORTANT:
 * - This file must contain TYPES ONLY (no runtime code).
 * - Runtime apiRequest implementations live in apps (mobile/web-admin).
 * - OpenAPI types are used ONLY for path/method/params/query/body typing.
 * - Response typing comes from Zod SSOT exports in response-types.ts.
 */

export type ApiRequestArgs<P extends ApiPath, M extends ApiMethod<P>> = {
  path: P;
  method: M;
  params?: ApiPathParams<P, M>;
  query?: ApiQueryParams<P, M>;
  body?: ApiRequestBody<P, M>;
};

/**
 * Response typing will be provided via `response-types.ts` (Zod SSOT).
 * We intentionally do NOT export OpenAPI-generated response types here.
 */
export type ApiResponse<P extends ApiPath, _M extends ApiMethod<P>> = unknown;

