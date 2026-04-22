import { Module, forwardRef } from '@nestjs/common';

import { PartyModule } from '../../modules/party/party.module';
import { PrismaModule } from '../../modules/prisma/prisma.module';

import { FanoutService } from './fanout.service';
import { InternalFanoutController } from './internal-fanout.controller';

@Module({
  imports: [PrismaModule, forwardRef(() => PartyModule)],
  controllers: [InternalFanoutController],
  providers: [FanoutService],
  exports: [FanoutService],
})
export class FanoutModule {}
