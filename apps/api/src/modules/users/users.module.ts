import { Module } from '@nestjs/common';

import { AccountModule } from '../account/account.module';
import { FollowsModule } from '../follows/follows.module';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [FollowsModule, AccountModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
