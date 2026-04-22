import { Body, Controller, Delete, Get, Param, Post, UseGuards, UsePipes } from '@nestjs/common';
import {
  AbTestAssignmentClientResponseSchema,
  AbTestConfigSchema,
  AbTestDeleteResponseSchema,
  AbTestListResponseSchema,
  UpsertAbTestSchema,
  type UpsertAbTestDto,
} from '@motogram/shared';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { AbTestService } from './ab-test.service';

@Controller('ab-tests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AbTestController {
  constructor(private readonly abTests: AbTestService) {}

  @Get()
  @Roles('ADMIN', 'MODERATOR')
  @ZodResponse(AbTestListResponseSchema)
  async list() {
    return this.abTests.list();
  }

  @Post()
  @Roles('ADMIN')
  @UsePipes(new ZodValidationPipe())
  @ZodResponse(AbTestConfigSchema)
  async upsert(@Body() dto: UpsertAbTestDto, @CurrentUser() actor: AuthenticatedUser) {
    UpsertAbTestSchema.parse(dto);
    return this.abTests.upsert(dto, actor.userId);
  }

  @Delete(':key')
  @Roles('ADMIN')
  @ZodResponse(AbTestDeleteResponseSchema)
  async delete(@Param('key') key: string) {
    const removed = await this.abTests.delete(key);
    return { key, removed };
  }

  // Mobil SDK icin: mevcut kullanicinin bu teste atanacagi varianti dondurur.
  @Get(':key/assignment')
  @ZodResponse(AbTestAssignmentClientResponseSchema)
  async assignment(@Param('key') key: string, @CurrentUser() actor: AuthenticatedUser) {
    const variant = await this.abTests.assign(key, actor.userId);
    return { key, userId: actor.userId, variant };
  }
}
