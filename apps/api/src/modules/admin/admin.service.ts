// Spec 5.4 - Admin Paneli servisi
// - Rapor kuyrugu (list + review)
// - Kullanici moderasyonu (ban, shadow-ban, role atama)
// - Audit log filtreleme
// - Dashboard snapshot metrikleri
// Her mutasyon AuditLog tablosuna yazilir (kim, ne yapti, ne zaman).
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCodes,
  type AdminDashboardSnapshotDto,
  type AdminReportDto,
  type AdminUserDto,
  type AuditLogDto,
  type BanUserDto,
  type ListAdminUsersQueryDto,
  type ListAuditLogsQueryDto,
  type ListReportsQueryDto,
  type ReviewReportDto,
  type SetUserRoleDto,
} from '@motogram/shared';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ========== REPORTS (Spec 5.4 + 7.2.2) ==========

  async listReports(query: ListReportsQueryDto): Promise<AdminReportDto[]> {
    const where: Prisma.ReportWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.targetType) where.targetType = query.targetType;
    if (query.reporterId) where.reporterId = query.reporterId;

    const reports = await this.prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      include: {
        reporter: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    return reports.map((r) => ({
      id: r.id,
      reporterId: r.reporterId,
      reporter: r.reporter
        ? {
            id: r.reporter.id,
            username: r.reporter.username,
            avatarUrl: r.reporter.avatarUrl,
          }
        : undefined,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      description: r.description,
      status: r.status,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async reviewReport(
    reportId: string,
    actorId: string,
    dto: ReviewReportDto,
  ): Promise<AdminReportDto> {
    const existing = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!existing) {
      throw new NotFoundException({ error: 'report_not_found', code: ErrorCodes.NOT_FOUND });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id: reportId },
        data: {
          status: dto.status,
          reviewedBy: actorId,
          reviewedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: `report.${dto.status.toLowerCase()}`,
          targetType: 'report',
          targetId: reportId,
          metadata: dto.resolutionNote ? { note: dto.resolutionNote } : undefined,
        },
      });
      return report;
    });
    return {
      id: updated.id,
      reporterId: updated.reporterId,
      targetType: updated.targetType,
      targetId: updated.targetId,
      reason: updated.reason,
      description: updated.description,
      status: updated.status,
      reviewedBy: updated.reviewedBy,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  // ========== USER MODERATION (Spec 5.4 + 7.2.2) ==========

  async listUsers(query: ListAdminUsersQueryDto): Promise<AdminUserDto[]> {
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.isBanned !== undefined) where.isBanned = query.isBanned;
    if (query.shadowBanned !== undefined) where.shadowBanned = query.shadowBanned;
    if (query.search) {
      where.OR = [
        { username: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isBanned: true,
        shadowBanned: true,
        isVerified: true,
        deletedAt: true,
        xp: true,
        level: true,
        followersCount: true,
        postsCount: true,
        createdAt: true,
        lastSeenAt: true,
      },
    });

    return users.map((u) => ({
      ...u,
      deletedAt: u.deletedAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
    }));
  }

  async banUser(userId: string, actorId: string, dto: BanUserDto): Promise<AdminUserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ error: 'user_not_found', code: ErrorCodes.NOT_FOUND });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: dto.shadowOnly
          ? { shadowBanned: true }
          : { isBanned: true, shadowBanned: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: dto.shadowOnly ? 'user.shadow_banned' : 'user.banned',
          targetType: 'user',
          targetId: userId,
          metadata: { reason: dto.reason },
        },
      });
      return {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        role: updated.role,
        isBanned: updated.isBanned,
        shadowBanned: updated.shadowBanned,
        isVerified: updated.isVerified,
        deletedAt: updated.deletedAt?.toISOString() ?? null,
        xp: updated.xp,
        level: updated.level,
        followersCount: updated.followersCount,
        postsCount: updated.postsCount,
        createdAt: updated.createdAt.toISOString(),
        lastSeenAt: updated.lastSeenAt?.toISOString() ?? null,
      };
    });
  }

  async unbanUser(userId: string, actorId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ error: 'user_not_found', code: ErrorCodes.NOT_FOUND });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isBanned: false, shadowBanned: false },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'user.unbanned',
          targetType: 'user',
          targetId: userId,
        },
      });
    });
  }

  async setUserRole(
    userId: string,
    actorId: string,
    dto: SetUserRoleDto,
  ): Promise<AdminUserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ error: 'user_not_found', code: ErrorCodes.NOT_FOUND });
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { role: dto.role },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'user.role_changed',
          targetType: 'user',
          targetId: userId,
          metadata: { from: user.role, to: dto.role },
        },
      });
      return {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        role: updated.role,
        isBanned: updated.isBanned,
        shadowBanned: updated.shadowBanned,
        isVerified: updated.isVerified,
        deletedAt: updated.deletedAt?.toISOString() ?? null,
        xp: updated.xp,
        level: updated.level,
        followersCount: updated.followersCount,
        postsCount: updated.postsCount,
        createdAt: updated.createdAt.toISOString(),
        lastSeenAt: updated.lastSeenAt?.toISOString() ?? null,
      };
    });
  }

  // ========== AUDIT LOG (Spec 5.4) ==========

  async listAuditLogs(query: ListAuditLogsQueryDto): Promise<AuditLogDto[]> {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = query.action;
    if (query.actorUserId) where.actorUserId = query.actorUserId;
    if (query.targetType) where.targetType = query.targetType;
    if (query.targetId) where.targetId = query.targetId;
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
      if (query.toDate) where.createdAt.lte = new Date(query.toDate);
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });

    return logs.map((log) => ({
      id: log.id,
      actorUserId: log.actorUserId,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  // ========== DASHBOARD (Spec 5.4) ==========

  async dashboardSnapshot(): Promise<AdminDashboardSnapshotDto> {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers24h,
      bannedUsers,
      pendingDeletion,
      postsLast24h,
      storiesLast24h,
      messagesLast24h,
      openReports,
      openEmergencies,
      activeParties,
      activeRideSessions,
      mediaProcessing,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { lastSeenAt: { gte: since24h } } }),
      this.prisma.user.count({ where: { isBanned: true } }),
      this.prisma.accountDeletion.count({
        where: { executedAt: null, cancelledAt: null },
      }),
      this.prisma.post.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.story.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.message.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.emergencyAlert.count({ where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } } }),
      this.prisma.party.count({ where: { status: { in: ['WAITING', 'RIDING', 'PAUSED'] } } }),
      this.prisma.liveLocationSession.count({ where: { isActive: true } }),
      this.prisma.mediaAsset.count({ where: { status: 'PROCESSING' } }),
    ]);

    return {
      timestamp: now.toISOString(),
      users: {
        total: totalUsers,
        active24h: activeUsers24h,
        banned: bannedUsers,
        pendingDeletion,
      },
      content: {
        postsLast24h,
        storiesLast24h,
        messagesLast24h,
      },
      safety: {
        openReports,
        emergencyAlertsOpen: openEmergencies,
        rateLimitedSos24h: 0, // Redis counter'dan Faz 7'de beslenir
      },
      infra: {
        activeParties,
        activeRideSessions,
        mediaAssetsProcessing: mediaProcessing,
      },
    };
  }
}
