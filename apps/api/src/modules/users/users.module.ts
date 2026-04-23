import { Module } from '@nestjs/common';

import { FollowsModule } from '../follows/follows.module';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [FollowsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
