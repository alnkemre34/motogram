import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateReportSchema, ReportDtoSchema, type CreateReportDto } from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';

import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** B-11 — Aynı hedefe 24 saat içinde ikinci rapor 409; throttle 5/dk. */
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post()
  @HttpCode(201)
  @ZodResponse(ReportDtoSchema)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(CreateReportSchema)) dto: CreateReportDto,
  ) {
    return this.reports.create(user.userId, dto);
  }
}
