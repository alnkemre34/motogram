import type { OpenAPIObject, PathsObject } from 'openapi3-ts/oas31';
import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z, type ZodTypeAny } from 'zod';

import type { RouteRecord, SchemaMap } from './types';

function toOpenApiPath(path: string): string {
  // Nest style: /users/:id -> OpenAPI: /users/{id}
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function isPassthroughObject(schema: ZodTypeAny): boolean {
  const def = (schema as unknown as { _def?: { unknownKeys?: unknown } })._def;
  return def?.unknownKeys === 'passthrough';
}

function sortKeysRecursive<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => sortKeysRecursive(v)) as T;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort((a, b) => a.localeCompare(b))) {
      out[key] = sortKeysRecursive(obj[key]);
    }
    return out as T;
  }
  return value;
}

function applyPassthroughAdditionalProperties(doc: OpenAPIObject, schemas: SchemaMap): void {
  if (!doc.components?.schemas) return;
  for (const [name, zodSchema] of Object.entries(schemas)) {
    if (!isPassthroughObject(zodSchema as unknown as ZodTypeAny)) continue;
    const openapi = doc.components.schemas[name] as Record<string, unknown> | undefined;
    if (!openapi || typeof openapi !== 'object') continue;
    // Ensure additionalProperties: true is explicit for passthrough objects.
    if (openapi.additionalProperties === undefined) {
      openapi.additionalProperties = true;
    }
  }
}

export function generateOpenApi(schemas: SchemaMap, routes: RouteRecord[]): OpenAPIObject {
  // Required by zod-to-openapi v7: adds `.openapi()` to Zod schemas.
  extendZodWithOpenApi(z);
  const registry = new OpenAPIRegistry();

  // Register all schemas as components (so request/response uses $ref, not inline).
  for (const [name, schema] of Object.entries(schemas)) {
    registry.register(name, schema as unknown as ZodTypeAny);
  }

  for (const r of routes) {
    const path = toOpenApiPath(r.path);

    const requestBody =
      r.requestBodySchema && schemas[r.requestBodySchema]
        ? {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${r.requestBodySchema}` },
              },
            },
          }
        : undefined;

    const status = String(r.responseStatus ?? 200);
    const responses: Record<string, unknown> = {};

    if (r.responseSchema && schemas[r.responseSchema]) {
      responses[status] = {
        description: 'OK',
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${r.responseSchema}` },
          },
        },
      };
    } else {
      responses[status] = { description: 'OK' };
    }

    registry.registerPath({
      method: r.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch',
      path,
      description: r.roles?.length ? `roles: ${r.roles.join(',')}` : undefined,
      request: requestBody ? { body: requestBody } : undefined,
      responses: responses as any,
      security: r.auth ? [{ bearerAuth: [] }] : undefined,
    });
  }

  const generator = new OpenApiGeneratorV31(registry.definitions);
  const doc = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: '@motogram/api',
      version: '0.0.0',
    },
    servers: [{ url: '/v1' }],
  });

  doc.components ??= {};
  (doc.components as any).securitySchemes ??= {};
  (doc.components as any).securitySchemes.bearerAuth = { type: 'http', scheme: 'bearer' };

  // Ensure passthrough() is represented as additionalProperties: true
  applyPassthroughAdditionalProperties(doc, schemas);

  // Ensure deterministic ordering for components.schemas + paths etc.
  const sorted = sortKeysRecursive(doc);
  // PathsObject typing can be lost via recursive sorting; reassert.
  (sorted as OpenAPIObject).paths = (sorted.paths ?? {}) as PathsObject;
  return sorted as OpenAPIObject;
}

