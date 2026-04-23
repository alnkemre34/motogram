import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DiscoveryModule } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

import { envSchema, normalizeProcessEnv } from './common/config/env.schema';
import { TypedEventsModule } from './common/events/typed-events.module';
import { FanoutModule } from './common/fanout/fanout.module';
import { HealthController } from './common/health/health.controller';
import { ReadinessService } from './common/health/readiness.service';
import { AbTestModule } from './modules/ab-test/ab-test.module';
import { AccountModule } from './modules/account/account.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BlocksModule } from './modules/blocks/blocks.module';
import { CommentsModule } from './modules/comments/comments.module';
import { CommunityModule } from './modules/community/community.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { EventModule } from './modules/event/event.module';
import { FeatureFlagModule } from './modules/feature-flag/feature-flag.module';
import { FollowsModule } from './modules/follows/follows.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { LikesModule } from './modules/likes/likes.module';
import { LocationModule } from './modules/location/location.module';
import { MapModule } from './modules/map/map.module';
import { MediaModule } from './modules/media/media.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { MotorcyclesModule } from './modules/motorcycles/motorcycles.module';
import { PartyModule } from './modules/party/party.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PostsModule } from './modules/posts/posts.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { PrismaService } from './modules/prisma/prisma.service';
import { PushModule } from './modules/push/push.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RedisModule } from './modules/redis/redis.module';
import { REDIS_CLIENT } from './modules/redis/redis.service';
import { StoriesModule } from './modules/stories/stories.module';
import { UsersModule } from './modules/users/users.module';

class OpenApiPrismaService extends PrismaClient {
  // Build-time OpenAPI generation should not connect to DB.
}

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (raw) => {
        // Build-time OpenAPI generation should not require full env.
        if (process.env.OPENAPI_GENERATE === '1') {
          return { ...process.env, ...raw } as Record<string, unknown>;
        }
        return envSchema.parse(
          normalizeProcessEnv({ ...process.env, ...raw } as NodeJS.ProcessEnv),
        ) as Record<string, unknown>;
      },
    }),
    // Spec 8.7.1 - global rate limit tabani (varsayilan: 60 req/dk)
    // Modul basina ozel limitler @Throttle dekorasyonu ile override edilir.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
    ]),
    // Spec 5.2 + 7.3.3 - Cron altyapisi (zombi temizligi, ping purge, retention worker)
    ScheduleModule.forRoot(),
    // Spec 3.6 - Gamification event bus (POST_CREATED, FOLLOW_GAINED, ...)
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
    }),
    TypedEventsModule,
    // Metrics once erken: Redis factory + Prisma query $on icin MetricsService DI
    MetricsModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    MotorcyclesModule,
    FollowsModule,
    BlocksModule,
    PostsModule,
    StoriesModule,
    CommentsModule,
    LikesModule,
    NotificationsModule,
    // Faz 2 - Harita ve Redis Konum Motoru
    LocationModule,
    MapModule,
    // Faz 3 - Surus Partisi (Spec 3.5 + 4.1 + 8.2 + 8.4)
    PartyModule,
    FanoutModule,
    // Faz 4 - Topluluklar, Etkinlikler, Mesajlasma, Push
    CommunityModule,
    EventModule,
    MessagingModule,
    PushModule,
    ReportsModule,
    // Faz 5 - Acil Durum, Gamification, Medya, Hesap Silme (Spec 2.3.2, 3.4, 3.6, 4.4, 5.2)
    EmergencyModule,
    GamificationModule,
    MediaModule,
    AccountModule,
    // Faz 6 - Admin Paneli, Feature Flag, A/B Test, Prometheus (Spec 5.4, 8.10, 8.11)
    FeatureFlagModule,
    AbTestModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    ReadinessService,
  ],
})
export class AppModule {
  /**
   * Build-time module variant for OpenAPI generation.
   *
   * - Keeps controller/module graph intact for DiscoveryService scanning.
   * - Prevents external connections (DB/Redis) during application-context boot.
   */
  static forOpenApi(): DynamicModule {
    return {
      module: AppModule,
      imports: [DiscoveryModule],
      providers: [
        // Ensure DiscoveryService is available.
        // Override DB + Redis external connections for OPENAPI_GENERATE=1.
        { provide: PrismaService, useClass: OpenApiPrismaService },
        {
          provide: REDIS_CLIENT,
          useFactory: () => {
            const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
            return new Redis(url, {
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
              lazyConnect: true,
            });
          },
        },
      ],
    };
  }
}
