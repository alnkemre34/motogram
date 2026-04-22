import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map } from 'rxjs/operators';
import type { ZodSchema } from 'zod';
import { z } from 'zod';

import { MetricsService } from '../../modules/metrics/metrics.service';

export const ZOD_RESPONSE_KEY = 'zod:response';

export const ZodResponse = (schema: ZodSchema): ReturnType<typeof SetMetadata> =>
  SetMetadata(ZOD_RESPONSE_KEY, schema);

@Injectable()
export class ZodSerializerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ZodSerializerInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly strict: boolean,
    private readonly metrics: MetricsService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const explicit = this.reflector.get<ZodSchema | undefined>(ZOD_RESPONSE_KEY, ctx.getHandler());
    const schema: ZodSchema = explicit ?? z.unknown();

    const req = ctx.switchToHttp().getRequest<{ method?: string; route?: { path?: string }; url?: string }>();
    const route = `${req.method ?? 'GET'} ${req.route?.path ?? req.url ?? 'unknown'}`;

    return next.handle().pipe(
      map((data) => {
        const result = schema.safeParse(data);
        if (result.success) return result.data;

        this.metrics.zodResponseMismatch.inc({ route });
        this.logger.warn(`[zod-response-mismatch] ${route}`, result.error.flatten());

        if (this.strict) throw result.error;
        return data;
      }),
    );
  }
}
