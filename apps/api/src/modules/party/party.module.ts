import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LocationModule } from '../location/location.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { LeaderElectionService } from './leader-election.service';
import { LocationGateway } from './location.gateway';
import { PartyCleanupService } from './party-cleanup.service';
import { PartyController } from './party.controller';
import { PartyService } from './party.service';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, NotificationsModule, LocationModule],
  controllers: [PartyController],
  providers: [PartyService, LeaderElectionService, LocationGateway, PartyCleanupService],
  exports: [PartyService, LeaderElectionService, LocationGateway],
})
export class PartyModule {}
