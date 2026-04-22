// Spec 5.4 - Admin paneli backend API istemcisi.
// Yanitlar @motogram/shared Zod semalariyla runtime dogrulanir (warn-only;
// NEXT_PUBLIC_STRICT_SCHEMA=true iken parse hatasi throw).
import type {
  AbTestConfigDto,
  AbTestVariantDto,
  AdminReportDto,
  AdminUserDto,
  AuditLogDto,
  BanUserDto,
  FeatureFlagDto,
  FeatureFlagStrategy,
  FeatureFlagValueDto,
  ListAdminUsersQueryDto,
  ListAuditLogsQueryDto,
  ListReportsQueryDto,
  ReviewReportDto,
  SetUserRoleDto,
  UpsertAbTestDto,
  UpsertFeatureFlagDto,
} from '@motogram/shared';
import {
  AbTestConfigSchema,
  AbTestDeleteResponseSchema,
  AbTestListResponseSchema,
  AdminAuditLogsListResponseSchema,
  AdminDashboardSnapshotSchema,
  AdminReportDtoSchema,
  AdminReportsListResponseSchema,
  AdminUnbanUserResponseSchema,
  AdminUserDtoSchema,
  AdminUsersListResponseSchema,
  FeatureFlagDtoSchema,
  FeatureFlagsListResponseSchema,
  KeyRemovedResponseSchema,
} from '@motogram/shared';
import type { ZodTypeAny } from 'zod';
import type { z } from 'zod';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1';
const strictSchema = process.env.NEXT_PUBLIC_STRICT_SCHEMA === 'true';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API ${status}: ${JSON.stringify(body)}`);
  }
}

function parseWithSchema<S extends ZodTypeAny>(data: unknown, schema: S): z.infer<S> {
  if (strictSchema) {
    return schema.parse(data);
  }
  const r = schema.safeParse(data);
  if (!r.success) {
    // eslint-disable-next-line no-console
    console.warn('[web-admin/api-client] response schema drift', r.error.flatten());
    return data as z.infer<S>;
  }
  return r.data;
}

async function request<T>(
  path: string,
  options?: RequestInit & { accessToken?: string },
): Promise<T>;
async function request<S extends ZodTypeAny>(
  path: string,
  schema: S,
  options?: RequestInit & { accessToken?: string },
): Promise<z.infer<S>>;
async function request<T, S extends ZodTypeAny>(
  path: string,
  schemaOrOptions?: (RequestInit & { accessToken?: string }) | S,
  maybeOptions?: RequestInit & { accessToken?: string },
): Promise<T | z.infer<S>> {
  const schema =
    schemaOrOptions && typeof schemaOrOptions === 'object' && 'safeParse' in schemaOrOptions
      ? (schemaOrOptions as S)
      : undefined;
  const options: RequestInit & { accessToken?: string } =
    schema !== undefined ? (maybeOptions ?? {}) : ((schemaOrOptions as RequestInit) ?? {});
  const { accessToken, ...rest } = options;
  const headers = new Headers(rest.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers, cache: 'no-store' });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  const json: unknown = await res.json();
  if (schema) {
    return parseWithSchema(json, schema);
  }
  return json as T;
}

export interface WithAuth {
  accessToken?: string;
}

export type AdminReport = AdminReportDto;
export type AdminUser = AdminUserDto;
export type AuditLog = AuditLogDto;
export type FeatureFlag = FeatureFlagDto;
export type FeatureFlagValue = FeatureFlagValueDto & { key: string };
export type AbTestConfig = AbTestConfigDto;
export type AbTestVariant = AbTestVariantDto;
export type { FeatureFlagStrategy };

function qs(params: Record<string, unknown>): string {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : '';
}

export const adminApi = {
  dashboard: (opts: WithAuth = {}) =>
    request('/admin/dashboard/snapshot', AdminDashboardSnapshotSchema, { method: 'GET', ...opts }),

  listReports: (query: Partial<ListReportsQueryDto> = {}, opts: WithAuth = {}) =>
    request(`/admin/reports${qs(query)}`, AdminReportsListResponseSchema, { method: 'GET', ...opts }),
  reviewReport: (id: string, dto: ReviewReportDto, opts: WithAuth = {}) =>
    request(`/admin/reports/${id}`, AdminReportDtoSchema, {
      method: 'PATCH',
      body: JSON.stringify(dto),
      ...opts,
    }),

  listUsers: (query: Partial<ListAdminUsersQueryDto> = {}, opts: WithAuth = {}) =>
    request(`/admin/users${qs(query)}`, AdminUsersListResponseSchema, { method: 'GET', ...opts }),
  banUser: (id: string, dto: BanUserDto, opts: WithAuth = {}) =>
    request(`/admin/users/${id}/ban`, AdminUserDtoSchema, {
      method: 'POST',
      body: JSON.stringify(dto),
      ...opts,
    }),
  unbanUser: (id: string, opts: WithAuth = {}) =>
    request(`/admin/users/${id}/ban`, AdminUnbanUserResponseSchema, {
      method: 'DELETE',
      ...opts,
    }),
  setUserRole: (id: string, dto: SetUserRoleDto, opts: WithAuth = {}) =>
    request(`/admin/users/${id}/role`, AdminUserDtoSchema, {
      method: 'PATCH',
      body: JSON.stringify(dto),
      ...opts,
    }),

  listAuditLogs: (query: Partial<ListAuditLogsQueryDto> = {}, opts: WithAuth = {}) =>
    request(`/admin/audit-logs${qs(query)}`, AdminAuditLogsListResponseSchema, {
      method: 'GET',
      ...opts,
    }),

  listFeatureFlags: (opts: WithAuth = {}) =>
    request('/feature-flags', FeatureFlagsListResponseSchema, { method: 'GET', ...opts }),
  upsertFeatureFlag: (dto: UpsertFeatureFlagDto, opts: WithAuth = {}) =>
    request('/feature-flags', FeatureFlagDtoSchema, {
      method: 'POST',
      body: JSON.stringify(dto),
      ...opts,
    }),
  deleteFeatureFlag: (key: string, opts: WithAuth = {}) =>
    request(`/feature-flags/${encodeURIComponent(key)}`, KeyRemovedResponseSchema, {
      method: 'DELETE',
      ...opts,
    }),

  listAbTests: (opts: WithAuth = {}) =>
    request('/ab-tests', AbTestListResponseSchema, { method: 'GET', ...opts }),
  upsertAbTest: (dto: UpsertAbTestDto, opts: WithAuth = {}) =>
    request('/ab-tests', AbTestConfigSchema, {
      method: 'POST',
      body: JSON.stringify(dto),
      ...opts,
    }),
  deleteAbTest: (key: string, opts: WithAuth = {}) =>
    request(`/ab-tests/${encodeURIComponent(key)}`, AbTestDeleteResponseSchema, {
      method: 'DELETE',
      ...opts,
    }),
};
