import { DiscoveryService, Reflector } from '@nestjs/core';
import { PATH_METADATA, METHOD_METADATA, ROUTE_ARGS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { RequestMethod, type INestApplicationContext } from '@nestjs/common';
import * as Shared from '@motogram/shared';
import { z, type ZodSchema, type ZodTypeAny } from 'zod';

import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ZOD_RESPONSE_KEY } from '../common/interceptors/zod-serializer.interceptor';

export interface RouteRecord {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  requestBodySchema?: string;
  responseSchema?: string;
  responseStatus?: number;
  auth?: boolean;
  roles?: string[];
}

type HttpMethod = RouteRecord['method'];

function normalizePath(p: unknown): string {
  if (Array.isArray(p)) return normalizePath(p[0]);
  const s = String(p ?? '').trim();
  if (!s) return '';
  if (s === '/' || s === '') return '';
  return s.startsWith('/') ? s : `/${s}`;
}

function joinPaths(a: string, b: string): string {
  const left = normalizePath(a);
  const right = normalizePath(b);
  const out = `${left}${right}`.replace(/\/{2,}/g, '/');
  return out || '/';
}

function requestMethodToHttp(method: unknown): HttpMethod | undefined {
  if (typeof method !== 'number') return undefined;
  switch (method) {
    case RequestMethod.GET:
      return 'GET';
    case RequestMethod.POST:
      return 'POST';
    case RequestMethod.PUT:
      return 'PUT';
    case RequestMethod.DELETE:
      return 'DELETE';
    case RequestMethod.PATCH:
      return 'PATCH';
    default:
      return undefined;
  }
}

function buildSchemaNameMap(): Map<ZodTypeAny, string> {
  const out = new Map<ZodTypeAny, string>();
  for (const [key, value] of Object.entries(Shared)) {
    if (!value) continue;
    // zod instances carry `_def`; safest cheap predicate:
    const maybe = value as unknown as { _def?: unknown };
    if (!maybe._def) continue;
    if (value instanceof z.ZodType) {
      out.set(value, key);
    }
  }
  return out;
}

function getZodBodySchemaName(
  controllerClass: new (...args: any[]) => any,
  methodName: string,
  schemaNameByRef: Map<ZodTypeAny, string>,
): string | undefined {
  // Nest 11 + TS: @Body() arg metadata çoğu projede `controllerClass` üzerinde;
  // yalnızca `prototype` okumak requestBodySchema'yı boş bırakıyordu (API_Contract + OpenAPI).
  const routeArgs: Record<string, { pipes?: unknown[] }> | undefined =
    (Reflect.getMetadata(ROUTE_ARGS_METADATA, controllerClass.prototype, methodName) as
      | Record<string, { pipes?: unknown[] }>
      | undefined) ??
    (Reflect.getMetadata(ROUTE_ARGS_METADATA, controllerClass, methodName) as
      | Record<string, { pipes?: unknown[] }>
      | undefined);

  if (!routeArgs) return undefined;

  for (const arg of Object.values(routeArgs)) {
    const pipes = arg.pipes ?? [];
    for (const p of pipes) {
      if (!p || typeof p !== 'object') continue;
      // `instanceof ZodBody` bazen çift modül yüklemesinde false döner; şema örnek
      // eşleşmesi SSOT haritada varsa request body adını üret (API_Contract + OpenAPI).
      const schema = (p as { schema?: unknown }).schema;
      if (schema instanceof z.ZodType) {
        const name = schemaNameByRef.get(schema as ZodTypeAny);
        if (name) return name;
      }
    }
  }
  return undefined;
}

export function collectRouteRecords(ctx: INestApplicationContext): RouteRecord[] {
  const discovery = ctx.get(DiscoveryService, { strict: false });
  const reflector = ctx.get(Reflector, { strict: false });
  const schemaNameByRef = buildSchemaNameMap();

  const records: RouteRecord[] = [];
  for (const wrapper of discovery.getControllers()) {
    const instance = wrapper.instance as object | undefined;
    const metatype = wrapper.metatype as (new (...args: any[]) => any) | undefined;
    if (!instance || !metatype) continue;

    const controllerPath = normalizePath(Reflect.getMetadata(PATH_METADATA, metatype));

    const controllerIsPublic = Boolean(
      reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [metatype]),
    );
    const controllerRoles =
      reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [metatype]) ?? undefined;

    const proto = metatype.prototype as object;
    const methodNames = Object.getOwnPropertyNames(proto).filter(
      (n) => n !== 'constructor' && typeof (proto as any)[n] === 'function',
    );

    for (const methodName of methodNames) {
      const handler = (instance as any)[methodName] as Function | undefined;
      if (!handler) continue;

      const reqMethod = requestMethodToHttp(Reflect.getMetadata(METHOD_METADATA, handler));
      if (!reqMethod) continue; // skip non-route methods

      const methodPath = normalizePath(Reflect.getMetadata(PATH_METADATA, handler));
      const fullPath = joinPaths(controllerPath, methodPath);

      const isPublic =
        Boolean(
          reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, metatype]),
        ) || controllerIsPublic;

      const roles =
        reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [handler, metatype]) ??
        controllerRoles;

      const responseSchema = reflector.get<ZodSchema | undefined>(ZOD_RESPONSE_KEY, handler);
      const responseSchemaName = responseSchema
        ? schemaNameByRef.get(responseSchema as ZodTypeAny)
        : undefined;

      const responseStatus =
        (Reflect.getMetadata(HTTP_CODE_METADATA, handler) as number | undefined) ?? 200;

      const requestBodySchemaName = getZodBodySchemaName(metatype, methodName, schemaNameByRef);

      records.push({
        method: reqMethod,
        path: fullPath,
        requestBodySchema: requestBodySchemaName,
        responseSchema: responseSchemaName,
        responseStatus,
        auth: !isPublic,
        roles: roles?.length ? roles : undefined,
      });
    }
  }

  records.sort((a, b) => {
    const p = a.path.localeCompare(b.path);
    if (p !== 0) return p;
    return a.method.localeCompare(b.method);
  });

  return records;
}

