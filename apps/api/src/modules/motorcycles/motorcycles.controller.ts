import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  CreateMotorcycleSchema,
  MotorcycleApiResponseSchema,
  MotorcycleListResponseSchema,
  SuccessTrueSchema,
  UpdateMotorcycleSchema,
  type CreateMotorcycleDto,
  type UpdateMotorcycleDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';

import { MotorcyclesService } from './motorcycles.service';

@Controller('motorcycles')
export class MotorcyclesController {
  constructor(private readonly motorcycles: MotorcyclesService) {}

  @Get('me')
  @ZodResponse(MotorcycleListResponseSchema)
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.motorcycles.listForUser(user.userId);
  }

  @Post()
  @ZodResponse(MotorcycleApiResponseSchema)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(CreateMotorcycleSchema)) dto: CreateMotorcycleDto,
  ) {
    return this.motorcycles.create(user.userId, dto);
  }

  @Patch(':id')
  @ZodResponse(MotorcycleApiResponseSchema)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodBody(UpdateMotorcycleSchema)) dto: UpdateMotorcycleDto,
  ) {
    return this.motorcycles.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ZodResponse(SuccessTrueSchema)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.motorcycles.remove(user.userId, id);
    return { success: true };
  }
}
