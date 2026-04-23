import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateEmergencyContactSchema,
  EmergencyContactRowSchema,
  EmergencyContactsListResponseSchema,
  type CreateEmergencyContactDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { EmergencyContactsService } from './emergency-contacts.service';

/** B-15 — Kullanıcı acil kişi listesi (max 5). */
@Controller('emergency/contacts')
@UseGuards(JwtAuthGuard)
export class EmergencyContactsController {
  constructor(private readonly service: EmergencyContactsService) {}

  @Get()
  @ZodResponse(EmergencyContactsListResponseSchema)
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user.userId);
  }

  @Post()
  @HttpCode(201)
  @ZodResponse(EmergencyContactRowSchema)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(CreateEmergencyContactSchema)) dto: CreateEmergencyContactDto,
  ) {
    return this.service.create(user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.service.remove(user.userId, id);
  }
}
