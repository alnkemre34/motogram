import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ErrorCodes,
  MapShardStatsResponseSchema,
  NearbyQuerySchema,
  NearbyRidersResponseSchema,
  type NearbyQueryDto,
} from '@motogram/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodResponse } from '../../common/interceptors/zod-serializer.interceptor';
import { PrismaService } from '../prisma/prisma.service';
import { MapService } from './map.service';

@Controller('map')
export class MapController {
  constructor(
    private readonly mapService: MapService,
    private readonly prisma: PrismaService,
  ) {}

  // Spec 2.3.1 - Harita acildiginda sag panelin doldurulmasi
  @Get('nearby')
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // Dakikada 30 sorgu
  @ZodResponse(NearbyRidersResponseSchema)
  async nearby(
    @CurrentUser('id') viewerId: string,
    @Query() rawQuery: Record<string, string>,
  ) {
    const query: NearbyQueryDto = NearbyQuerySchema.parse({
      lat: Number(rawQuery.lat),
      lng: Number(rawQuery.lng),
      radius: rawQuery.radius !== undefined ? Number(rawQuery.radius) : undefined,
      filter: rawQuery.filter,
      limit: rawQuery.limit !== undefined ? Number(rawQuery.limit) : undefined,
      city: rawQuery.city,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { city: true },
    });
    if (!user) {
      throw new NotFoundException({ error: 'user_not_found', code: ErrorCodes.NOT_FOUND });
    }

    // Faz 2: viewer.partyId Faz 3'te PartyService ile doldurulur
    return this.mapService.getNearbyRiders(viewerId, query, {
      city: user.city,
      partyId: null,
    });
  }

  // Spec 8.3 - Admin/observability: shard dagilimi
  @Get('shards')
  @ZodResponse(MapShardStatsResponseSchema)
  async shardStats() {
    return this.mapService.getRiderCountPerShard();
  }
}
