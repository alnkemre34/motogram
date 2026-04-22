import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { RedisModule } from '../redis/redis.module';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { MessagingController } from './messaging.controller';
import { MessagingGateway } from './messaging.gateway';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, PushModule],
  controllers: [MessagingController],
  providers: [ConversationService, MessageService, MessagingGateway],
  exports: [ConversationService, MessageService, MessagingGateway],
})
export class MessagingModule {}
