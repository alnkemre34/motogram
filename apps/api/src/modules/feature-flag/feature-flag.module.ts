import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { FeatureFlagController } from './feature-flag.controller';
import { FeatureFlagService } from './feature-flag.service';

@Module({
  imports: [AuthModule],
  controllers: [FeatureFlagController],
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
