import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { LocationCleanupService } from './location-cleanup.service';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { LocationSyncQueue } from './queue/location-sync.queue';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [LocationController],
  providers: [LocationService, LocationCleanupService, LocationSyncQueue],
  exports: [LocationService, LocationSyncQueue],
})
export class LocationModule {}
