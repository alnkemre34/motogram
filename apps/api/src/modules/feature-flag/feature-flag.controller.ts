// Spec 8.11.1 - Feature Flag REST API
// Admin endpoint'leri ADMIN rolu + JwtAuthGuard ile korunur. evaluate endpoint'i
// ise authenticated herkese aciktir (mobil SDK tarafindan tuketilir).
import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  EvaluateFeatureFlagSchema,
  FeatureFlagDtoSchema,
  FeatureFlagEvaluationSchema,
  FeatureFlagsListResponseSchema,
  KeyRemovedResponseSchema,
  UpsertFeatureFlagSchema,
  type EvaluateFeatureFlagDto,
  type UpsertFeatureFlagDto,
} from '@motogram/shared';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { FeatureFlagService } from './feature-flag.service';

@Controller('feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeatureFlagController {
  constructor(private readonly flags: FeatureFlagService) {}

  // Authenticated herkes - mobil SDK "enabled mi?" diye sorar.
  @Get('evaluate')
  @ZodResponse(FeatureFlagEvaluationSchema)
  async evaluate(@Query() query: unknown, @CurrentUser() actor: AuthenticatedUser) {
    const dto = EvaluateFeatureFlagSchema.parse(query) as EvaluateFeatureFlagDto;
    // userId parametresi verilmediyse, cagiran kullaniciyi kullan.
    return this.flags.evaluate(dto.key, dto.userId ?? actor.userId);
  }

  @Get()
  @Roles('ADMIN', 'MODERATOR')
  @ZodResponse(FeatureFlagsListResponseSchema)
  async list() {
    return this.flags.list();
  }

  @Post()
  @Roles('ADMIN')
  @UsePipes(new ZodValidationPipe())
  @ZodResponse(FeatureFlagDtoSchema)
  async upsert(@Body() dto: UpsertFeatureFlagDto, @CurrentUser() actor: AuthenticatedUser) {
    UpsertFeatureFlagSchema.parse(dto);
    return this.flags.upsert(dto, actor.userId);
  }

  @Delete(':key')
  @Roles('ADMIN')
  @ZodResponse(KeyRemovedResponseSchema)
  async delete(@Param('key') key: string) {
    const removed = await this.flags.delete(key);
    return { key, removed };
  }
}
