import { Body, Controller, HttpCode, NotFoundException, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ErrorCodes,
  LiveLocationSessionResponseSchema,
  LocationSharingUserResponseSchema,
  StartLiveSessionSchema,
  UpdateLocationHttpResponseSchema,
  UpdateLocationSchema,
  UpdateLocationSharingSchema,
  type StartLiveSessionDto,
  type UpdateLocationDto,
  type UpdateLocationSharingDto,
} from '@motogram/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { ZodBody } from '../../common/pipes/zod-body.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { LocationService } from './location.service';

// Spec 3.3.2 - REST fallback (Socket.IO asil kanal, REST dusuk frekansli cihazlar
// ve testler icin). Spec 7.3.5 - 1/sn kisiti service icinde.

@Controller('location')
export class LocationController {
  constructor(
    private readonly locationService: LocationService,
    private readonly prisma: PrismaService,
  ) {}

  @Put('update')
  @HttpCode(200)
  // Throttler yedegi: saniyede 1 ping (Spec 7.3.5). TTL ms.
  @Throttle({ default: { limit: 1, ttl: 1_000 } })
  @ZodResponse(UpdateLocationHttpResponseSchema)
  async updateLocation(
    @CurrentUser('id') userId: string,
    @Body(new ZodBody(UpdateLocationSchema)) dto: UpdateLocationDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { city: true, locationSharing: true, isBanned: true },
    });
    if (!user) {
      throw new NotFoundException({ error: 'user_not_found', code: ErrorCodes.NOT_FOUND });
    }
    return this.locationService.updateLocation(userId, dto, user);
  }

  @Post('session/start')
  @HttpCode(200)
  @ZodResponse(LiveLocationSessionResponseSchema)
  async startSession(
    @CurrentUser('id') userId: string,
    @Body(new ZodBody(StartLiveSessionSchema)) dto: StartLiveSessionDto,
  ) {
    return this.locationService.startLiveSession(userId, {
      sourceType: dto.source,
      sourceId: dto.sourceId,
      visibilityMode: dto.visibility,
      expiresInMinutes: dto.expiresInMinutes,
    });
  }

  @Post('session/stop')
  @HttpCode(204)
  async stopSession(@CurrentUser('id') userId: string) {
    await this.locationService.stopLiveSession(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { city: true },
    });
    await this.locationService.removeFromRedis(userId, user?.city ?? null);
  }

  @Put('sharing')
  @HttpCode(200)
  @ZodResponse(LocationSharingUserResponseSchema)
  async updateSharing(
    @CurrentUser('id') userId: string,
    @Body(new ZodBody(UpdateLocationSharingSchema)) dto: UpdateLocationSharingDto,
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { locationSharing: dto.mode },
      select: { id: true, locationSharing: true },
    });
    if (dto.mode === 'OFF') {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { city: true } });
      await this.locationService.removeFromRedis(userId, u?.city ?? null);
    }
    return user;
  }
}
