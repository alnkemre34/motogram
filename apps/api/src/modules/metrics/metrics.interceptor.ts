// Spec 8.10.2 - HTTP request metric otomatik toplanir.
// Her controller isteginde method + route + status_code label'lariyla
// http_requests_total ve http_request_duration_seconds gunceller.
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // Route path (ornegin /v1/users/:id) - cardinality'yi dusurmek icin raw
    // URL yerine route pattern kullanilir. Dekorator cozumu yoksa, "unknown".
    const route = (req.route?.path as string | undefined) ?? req.path ?? 'unknown';
    const method = req.method;

    const endTimer = this.metrics.httpDuration.startTimer();
    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = String(res.statusCode);
          this.metrics.httpRequests.inc({ method, route, status_code: statusCode });
          endTimer({ method, route, status_code: statusCode });
        },
        error: (err: { status?: number }) => {
          const statusCode = String(err?.status ?? 500);
          this.metrics.httpRequests.inc({ method, route, status_code: statusCode });
          endTimer({ method, route, status_code: statusCode });
        },
      }),
    );
  }
}
