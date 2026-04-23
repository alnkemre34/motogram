import { ConflictException, Injectable } from '@nestjs/common';
import { ReportTargetType } from '@prisma/client';
import { ErrorCodes, type CreateReportDto } from '@motogram/shared';

import { PrismaService } from '../prisma/prisma.service';

const REPORT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(reporterId: string, dto: CreateReportDto) {
    const since = new Date(Date.now() - REPORT_DEDUPE_WINDOW_MS);
    const duplicate = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType: dto.targetType as ReportTargetType,
        targetId: dto.targetId,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({
        error: 'report_duplicate',
        code: ErrorCodes.CONFLICT,
      });
    }

    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType as ReportTargetType,
        targetId: dto.targetId,
        reason: dto.reason,
        description: dto.description ?? null,
      },
      select: {
        id: true,
        reporterId: true,
        targetType: true,
        targetId: true,
        reason: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });
  }
}
