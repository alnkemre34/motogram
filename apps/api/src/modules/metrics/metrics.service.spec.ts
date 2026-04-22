// Spec 8.10.2 - MetricsService testleri.
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let svc: MetricsService;

  beforeEach(() => {
    svc = new MetricsService();
    svc.onModuleInit();
  });

  it('registers core metrics', async () => {
    svc.httpRequests.inc({ method: 'GET', route: '/v1/users', status_code: '200' }, 1);
    svc.wsConnectionsActive.set({ namespace: 'default' }, 5);
    svc.emergencyAlertsCreated.inc({ severity: 'HIGH' }, 1);
    const out = await svc.render();
    expect(out).toContain('http_requests_total');
    expect(out).toContain('websocket_connections_active');
    expect(out).toContain('emergency_alerts_created_total');
    expect(out).toContain('process_cpu_seconds_total');
  });

  it('contentType returns Prometheus text format', () => {
    expect(svc.contentType()).toContain('text/plain');
  });

  it('http_request_duration_seconds histogram exists and records', async () => {
    const end = svc.httpDuration.startTimer({ method: 'POST', route: '/v1/auth/login' });
    end({ status_code: '200' });
    const out = await svc.render();
    expect(out).toContain('http_request_duration_seconds_bucket');
  });

  it('bullmq failure counter has queue + reason label', async () => {
    svc.bullmqJobsFailed.inc({ queue: 'media-pipeline', reason: 'sharp_error' }, 1);
    const out = await svc.render();
    expect(out).toMatch(/bullmq_jobs_failed_total\{[^}]*queue="media-pipeline"/);
    expect(out).toMatch(/bullmq_jobs_failed_total\{[^}]*reason="sharp_error"/);
  });
});
