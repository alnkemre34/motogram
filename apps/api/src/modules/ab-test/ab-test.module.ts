import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AbTestController } from './ab-test.controller';
import { AbTestService } from './ab-test.service';

@Module({
  imports: [AuthModule],
  controllers: [AbTestController],
  providers: [AbTestService],
  exports: [AbTestService],
})
export class AbTestModule {}
