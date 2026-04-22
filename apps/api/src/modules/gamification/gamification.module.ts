import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { GamificationController } from './gamification.controller';
import { GamificationGateway } from './gamification.gateway';
import { GamificationService } from './gamification.service';

// Spec 3.6 - Event-driven gamification modulu.
// Diger moduller (Posts, Follows, ...) EventEmitter2 uzerinden `gamification.trigger`
// emit ederek XP/Badge mantigini tetikler.

@Module({
  imports: [PrismaModule, NotificationsModule, PushModule, AuthModule],
  controllers: [GamificationController],
  providers: [GamificationService, GamificationGateway],
  exports: [GamificationService],
})
export class GamificationModule {}
