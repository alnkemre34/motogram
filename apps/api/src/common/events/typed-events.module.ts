import { Global, Module } from '@nestjs/common';

import { MetricsModule } from '../../modules/metrics/metrics.module';

import { ZodEventBus } from './zod-event-bus.service';

@Global()
@Module({
  imports: [MetricsModule],
  providers: [ZodEventBus],
  exports: [ZodEventBus],
})
export class TypedEventsModule {}
