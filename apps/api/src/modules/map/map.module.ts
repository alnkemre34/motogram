import { Module } from '@nestjs/common';

import { LocationModule } from '../location/location.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MapController } from './map.controller';
import { MapService } from './map.service';

@Module({
  imports: [LocationModule, PrismaModule, RedisModule],
  controllers: [MapController],
  providers: [MapService],
  exports: [MapService],
})
export class MapModule {}
