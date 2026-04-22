import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CreateEmergencyAlertSchema,
  EmergencyAlertDtoSchema,
  EmergencyAlertsListResponseSchema,
  EmergencyResponderDtoSchema,
  RespondEmergencyAlertSchema,
  ResolveEmergencyAlertSchema,
  type CreateEmergencyAlertDto,
  type RespondEmergencyAlertDto,
  type ResolveEmergencyAlertDto,
} from '@motogram/shared';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { EmergencyService } from './emergency.service';

// Spec 2.3.2 + 8.7.1 - SOS REST endpointleri.

@Controller('emergency/alerts')
@UseGuards(JwtAuthGuard)
export class EmergencyController {
  constructor(
    private readonly service: EmergencyService,
    private readonly prisma: PrismaService,
  ) {}

  // Spec 8.7.1 + Faz 10 — 10 dk'da 3 cagri (Nginx api_sos ile hizali). Service ayrica Redis sayar.
  @Post()
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @ZodResponse(EmergencyAlertDtoSchema)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodBody(CreateEmergencyAlertSchema)) dto: CreateEmergencyAlertDto,
  ) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { username: true, city: true, isBanned: true },
    });
    if (!profile) throw new NotFoundException({ error: 'user_not_found' });
    return this.service.createAlert(user.userId, dto, profile);
  }

  @Get()
  @ZodResponse(EmergencyAlertsListResponseSchema)
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return {
      alerts: await this.service.listForUser(user.userId),
    };
  }

  @Get(':id')
  @ZodResponse(EmergencyAlertDtoSchema)
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.getAlert(user.userId, id);
  }

  @Post(':id/respond')
  @HttpCode(200)
  @ZodResponse(EmergencyResponderDtoSchema)
  async respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodBody(RespondEmergencyAlertSchema)) dto: RespondEmergencyAlertDto,
  ) {
    return this.service.respond(user.userId, id, dto);
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @ZodResponse(EmergencyAlertDtoSchema)
  async resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodBody(ResolveEmergencyAlertSchema)) dto: ResolveEmergencyAlertDto,
  ) {
    return this.service.resolve(user.userId, id, dto);
  }
}
