import type { z } from 'zod';

import {
  AdminDashboardSnapshotSchema,
  AdminReportsListResponseSchema,
  AdminReportDtoSchema,
  AdminUsersListResponseSchema,
  AdminUserDtoSchema,
  AuthResultSchema,
  MotorcycleListResponseSchema,
  PostApiResponseSchema,
  PostFeedPageSchema,
  UserMeResponseSchema,
} from '../index';

/**
 * IMPORTANT:
 * - Response types must come from Zod (SSOT), NOT from OpenAPI generated types.
 * - This file is intentionally a small, curated barrel. We can expand it over time
 *   (or generate it) as frontend adopts typed endpoints.
 */

export type AuthResultResponse = z.infer<typeof AuthResultSchema>;
export type UserMeResponseBody = z.infer<typeof UserMeResponseSchema>;
export type MotorcycleListResponseBody = z.infer<typeof MotorcycleListResponseSchema>;
export type PostApiResponseBody = z.infer<typeof PostApiResponseSchema>;
export type PostFeedPageBody = z.infer<typeof PostFeedPageSchema>;

// Admin examples (used in web-admin)
export type AdminDashboardSnapshotBody = z.infer<typeof AdminDashboardSnapshotSchema>;
export type AdminReportsListResponseBody = z.infer<typeof AdminReportsListResponseSchema>;
export type AdminReportDtoBody = z.infer<typeof AdminReportDtoSchema>;
export type AdminUsersListResponseBody = z.infer<typeof AdminUsersListResponseSchema>;
export type AdminUserDtoBody = z.infer<typeof AdminUserDtoSchema>;

