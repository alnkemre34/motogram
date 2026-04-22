import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LocationModule } from '../location/location.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { RedisModule } from '../redis/redis.module';
import { EmergencyController } from './emergency.controller';
import { EmergencyGateway } from './emergency.gateway';
import { EmergencyService } from './emergency.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    LocationModule,
    PushModule,
    NotificationsModule,
    AuthModule,
  ],
  controllers: [EmergencyController],
  providers: [EmergencyService, EmergencyGateway],
  exports: [EmergencyService],
})
export class EmergencyModule {}
