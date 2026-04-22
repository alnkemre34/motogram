import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MetricsService } from '../metrics/metrics.service';

import { REDIS_CLIENT, RedisService, createRedisClient } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService, MetricsService],
      useFactory: (config: ConfigService, metrics: MetricsService) => createRedisClient(config, metrics),
    },
    RedisService,
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule {}
