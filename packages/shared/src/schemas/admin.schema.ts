// Spec 5.4 - Admin Paneli Ozellikleri
// Rapor kuyrugu, kullanici moderasyonu, audit log filtreleme, dashboard metrikleri.
import { z } from 'zod';

import { ReportStatusEnum, ReportTargetTypeEnum, UserRoleEnum } from '../enums';

// ========== REPORT ADMIN ==========

export const ListReportsQuerySchema = z.object({
  status: ReportStatusEnum.optional(),
  targetType: ReportTargetTypeEnum.optional(),
  reporterId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListReportsQueryDto = z.infer<typeof ListReportsQuerySchema>;

export const ReviewReportSchema = z.object({
  status: ReportStatusEnum.exclude(['PENDING']),
  resolutionNote: z.string().max(2000).optional(),
});
export type ReviewReportDto = z.infer<typeof ReviewReportSchema>;

export const AdminReportDtoSchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  reporter: z
    .object({
      id: z.string().uuid(),
      username: z.string(),
      avatarUrl: z.string().nullable().optional(),
    })
    .optional(),
  targetType: ReportTargetTypeEnum,
  targetId: z.string(),
  reason: z.string(),
  description: z.string().nullable().optional(),
  status: ReportStatusEnum,
  reviewedBy: z.string().uuid().nullable().optional(),
  reviewedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type AdminReportDto = z.infer<typeof AdminReportDtoSchema>;

// ========== USER ADMIN ==========

export const ListAdminUsersQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  role: UserRoleEnum.optional(),
  isBanned: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
  shadowBanned: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListAdminUsersQueryDto = z.infer<typeof ListAdminUsersQuerySchema>;

export const AdminUserDtoSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  role: UserRoleEnum,
  isBanned: z.boolean(),
  shadowBanned: z.boolean(),
  isVerified: z.boolean(),
  deletedAt: z.string().datetime().nullable(),
  xp: z.number().int(),
  level: z.number().int(),
  followersCount: z.number().int(),
  postsCount: z.number().int(),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime().nullable(),
});
export type AdminUserDto = z.infer<typeof AdminUserDtoSchema>;

export const BanUserSchema = z.object({
  reason: z.string().trim().min(2).max(500),
  shadowOnly: z.boolean().default(false),
});
export type BanUserDto = z.infer<typeof BanUserSchema>;

export const SetUserRoleSchema = z.object({
  role: UserRoleEnum,
});
export type SetUserRoleDto = z.infer<typeof SetUserRoleSchema>;

// ========== AUDIT LOG ==========

export const ListAuditLogsQuerySchema = z.object({
  action: z.string().trim().min(2).max(64).optional(),
  actorUserId: z.string().uuid().optional(),
  targetType: z.string().trim().max(64).optional(),
  targetId: z.string().max(256).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ListAuditLogsQueryDto = z.infer<typeof ListAuditLogsQuerySchema>;

export const AuditLogDtoSchema = z.object({
  id: z.string().uuid(),
  actorUserId: z.string().uuid().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string().datetime(),
});
export type AuditLogDto = z.infer<typeof AuditLogDtoSchema>;

// ========== DASHBOARD ==========

export const AdminDashboardSnapshotSchema = z.object({
  timestamp: z.string().datetime(),
  users: z.object({
    total: z.number().int(),
    active24h: z.number().int(),
    banned: z.number().int(),
    pendingDeletion: z.number().int(),
  }),
  content: z.object({
    postsLast24h: z.number().int(),
    storiesLast24h: z.number().int(),
    messagesLast24h: z.number().int(),
  }),
  safety: z.object({
    openReports: z.number().int(),
    emergencyAlertsOpen: z.number().int(),
    rateLimitedSos24h: z.number().int(),
  }),
  infra: z.object({
    activeParties: z.number().int(),
    activeRideSessions: z.number().int(),
    mediaAssetsProcessing: z.number().int(),
  }),
});
export type AdminDashboardSnapshotDto = z.infer<typeof AdminDashboardSnapshotSchema>;

/** HTTP list cevaplari (controller dogrudan dizi dondurur) */
export const AdminReportsListResponseSchema = z.array(AdminReportDtoSchema);
export const AdminUsersListResponseSchema = z.array(AdminUserDtoSchema);
export const AdminAuditLogsListResponseSchema = z.array(AuditLogDtoSchema);

export const AdminUnbanUserResponseSchema = z.object({
  id: z.string().uuid(),
  unbanned: z.literal(true),
});
