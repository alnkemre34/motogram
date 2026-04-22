import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ExpoPushDispatcher } from './expo-push.dispatcher';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [PrismaModule],
  controllers: [PushController],
  providers: [PushService, ExpoPushDispatcher],
  exports: [PushService],
})
export class PushModule {}
