// Facade over generated OpenAPI types.
//
// IMPORTANT: Do not re-export response types from OpenAPI. Response types come from Zod (see response-types.ts).

import type { paths } from './api-types.generated';

export type ApiPaths = paths;

export type ApiPath = keyof ApiPaths & string;

export type ApiMethod<P extends ApiPath> = keyof ApiPaths[P] & string;

type Op<P extends ApiPath, M extends ApiMethod<P>> = ApiPaths[P][M];

export type ApiPathParams<P extends ApiPath, M extends ApiMethod<P>> =
  Op<P, M> extends { parameters: { path: infer X } } ? X : never;

export type ApiQueryParams<P extends ApiPath, M extends ApiMethod<P>> =
  Op<P, M> extends { parameters: { query?: infer X } } ? X : never;

export type ApiHeaderParams<P extends ApiPath, M extends ApiMethod<P>> =
  Op<P, M> extends { parameters: { header?: infer X } } ? X : never;

export type ApiRequestBody<P extends ApiPath, M extends ApiMethod<P>> =
  Op<P, M> extends { requestBody?: { content: { 'application/json': infer X } } }
    ? X
    : never;

