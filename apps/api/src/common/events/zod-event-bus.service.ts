import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ZodSchema } from 'zod';

import { MetricsService } from '../../modules/metrics/metrics.service';

/**
 * EventEmitter2 emit'lerini Zod ile sarar; validation fail -> log + metrik, login akisi kirilmaz.
 */
@Injectable()
export class ZodEventBus {
  private readonly logger = new Logger(ZodEventBus.name);

  constructor(
    private readonly bus: EventEmitter2,
    private readonly metrics: MetricsService,
  ) {}

  emit(event: string, schema: ZodSchema, payload: unknown): boolean {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      this.logger.error(`event_payload_invalid event=${event}`, parsed.error.flatten());
      this.metrics.zodInboundValidationErrors.inc({
        source: 'event_emit',
        schema: event,
      });
      return false;
    }
    return this.bus.emit(event, parsed.data);
  }
}
