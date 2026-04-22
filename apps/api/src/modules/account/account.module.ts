import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { DeletionQueue } from './deletion.queue';
import { RetentionWorker } from './retention.worker';

// Spec 5.2 + 7.2.1 + 8.11.4 - Hesap silme + 30 gun retention worker +
// BullMQ DELETE_USER_DATA kuyrugu (delayed job, login-reset).

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AccountController],
  providers: [AccountService, DeletionQueue, RetentionWorker],
  exports: [AccountService, DeletionQueue],
})
export class AccountModule {}
