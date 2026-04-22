// Spec 8.10.2 - Prometheus metrik toplama ve izleme
// prom-client kullanarak /metrics endpoint'ini doldurur.
// Grafana ve Alertmanager bu metrikleri scrape eder (Spec 8.10.3).
//
// Metrikler (Spec 8.10.2):
// - http_requests_total              (endpoint bazli)
// - http_request_duration_seconds    (histogram)
// - websocket_connections_active     (gauge)
// - redis_georadius_duration_seconds (histogram)
// - bullmq_jobs_completed_total      (kuyruk + durum label)
// - bullmq_jobs_failed_total         (DLQ uyarisi icin)
// - emergency_alerts_created_total
// - feature_flag_evaluations_total
// - ab_test_assignments_total
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { METRIC_NAMES } from '@motogram/shared';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

import type { Queue } from 'bullmq';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  readonly registry: Registry;

  readonly httpRequests: Counter<string>;
  readonly httpDuration: Histogram<string>;
  readonly wsConnectionsActive: Gauge<string>;
  readonly redisGeoradiusDuration: Histogram<string>;
  readonly bullmqJobsCompleted: Counter<string>;
  readonly bullmqJobsFailed: Counter<string>;
  readonly emergencyAlertsCreated: Counter<string>;
  readonly featureFlagEvaluations: Counter<string>;
  readonly abTestAssignments: Counter<string>;
  readonly zodResponseMismatch: Counter<string>;
  readonly zodInboundValidationErrors: Counter<string>;
  readonly bullmqJobsWaiting: Gauge<string>;
  readonly bullmqJobsActive: Gauge<string>;
  readonly bullmqDlqSize: Gauge<string>;
  readonly bullmqJobDuration: Histogram<string>;
  readonly wsMessageLatency: Histogram<string>;
  readonly wsDisconnections: Counter<string>;
  readonly redisCommandErrors: Counter<string>;
  readonly dbPoolConnectionsActive: Gauge<string>;
  readonly dbPoolConnectionsMax: Gauge<string>;
  readonly dbQueryDuration: Histogram<string>;

  private bullQueues: Queue[] = [];
  private bullRefreshTimer?: NodeJS.Timeout;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ app: 'motogram-api' });

    this.httpRequests = new Counter({
      name: METRIC_NAMES.HTTP_REQUESTS_TOTAL,
      help: 'Toplam HTTP istegi sayisi (method + route + status_code bazli).',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpDuration = new Histogram({
      name: METRIC_NAMES.HTTP_REQUEST_DURATION_SECONDS,
      help: 'HTTP istegi suresi (saniye).',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.wsConnectionsActive = new Gauge({
      name: METRIC_NAMES.WEBSOCKET_CONNECTIONS_ACTIVE,
      help: 'Aktif WebSocket baglanti sayisi (namespace bazli).',
      labelNames: ['namespace'],
      registers: [this.registry],
    });

    this.redisGeoradiusDuration = new Histogram({
      name: METRIC_NAMES.REDIS_GEORADIUS_DURATION_SECONDS,
      help: 'Redis GEOSEARCH/GEORADIUS sorgu suresi.',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    });

    this.bullmqJobsCompleted = new Counter({
      name: METRIC_NAMES.BULLMQ_JOBS_COMPLETED_TOTAL,
      help: 'Tamamlanan BullMQ is sayisi (queue bazli).',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.bullmqJobsFailed = new Counter({
      name: METRIC_NAMES.BULLMQ_JOBS_FAILED_TOTAL,
      help: 'Basarisiz BullMQ is sayisi (DLQ uyarisi icin).',
      labelNames: ['queue', 'reason'],
      registers: [this.registry],
    });

    this.emergencyAlertsCreated = new Counter({
      name: METRIC_NAMES.EMERGENCY_ALERTS_CREATED_TOTAL,
      help: 'Olusturulan SOS acil durum cagrilarinin toplam sayisi.',
      labelNames: ['severity'],
      registers: [this.registry],
    });

    this.featureFlagEvaluations = new Counter({
      name: METRIC_NAMES.FEATURE_FLAG_EVALUATIONS_TOTAL,
      help: 'Feature flag evaluate cagrilari (key + result bazli).',
      labelNames: ['key', 'result'],
      registers: [this.registry],
    });

    this.abTestAssignments = new Counter({
      name: METRIC_NAMES.AB_TEST_ASSIGNMENTS_TOTAL,
      help: 'A/B test variant atamalari (key + variant bazli).',
      labelNames: ['key', 'variant'],
      registers: [this.registry],
    });

    this.zodResponseMismatch = new Counter({
      name: METRIC_NAMES.ZOD_RESPONSE_MISMATCH_TOTAL,
      help: 'HTTP response Zod semasiyla uyusmedi (safeParse fail).',
      labelNames: ['route'],
      registers: [this.registry],
    });

    this.zodInboundValidationErrors = new Counter({
      name: METRIC_NAMES.ZOD_INBOUND_VALIDATION_ERRORS_TOTAL,
      help: 'Kuyruk veya event emit Zod dogrulama hatasi.',
      labelNames: ['source', 'schema'],
      registers: [this.registry],
    });

    this.bullmqJobsWaiting = new Gauge({
      name: METRIC_NAMES.BULLMQ_JOBS_WAITING,
      help: 'BullMQ bekleyen is sayisi.',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.bullmqJobsActive = new Gauge({
      name: METRIC_NAMES.BULLMQ_JOBS_ACTIVE,
      help: 'BullMQ aktif is sayisi.',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.bullmqDlqSize = new Gauge({
      name: METRIC_NAMES.BULLMQ_DLQ_SIZE,
      help: 'BullMQ DLQ derinligi.',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.bullmqJobDuration = new Histogram({
      name: METRIC_NAMES.BULLMQ_JOB_DURATION_SECONDS,
      help: 'BullMQ is suresi (saniye).',
      labelNames: ['queue', 'job_name'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 30, 120],
      registers: [this.registry],
    });

    this.wsMessageLatency = new Histogram({
      name: METRIC_NAMES.WEBSOCKET_MESSAGE_LATENCY_SECONDS,
      help: 'WebSocket mesaj gecikmesi (server tarafinda olculen).',
      labelNames: ['event'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    });

    this.wsDisconnections = new Counter({
      name: METRIC_NAMES.WEBSOCKET_DISCONNECTIONS_TOTAL,
      help: 'WebSocket baglanti kopmalari.',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.redisCommandErrors = new Counter({
      name: METRIC_NAMES.REDIS_COMMAND_ERRORS_TOTAL,
      help: 'Redis komut hatalari.',
      labelNames: ['command'],
      registers: [this.registry],
    });

    this.dbPoolConnectionsActive = new Gauge({
      name: METRIC_NAMES.DB_POOL_CONNECTIONS_ACTIVE,
      help: 'Prisma/DB pool aktif baglanti (tahmini).',
      labelNames: ['pool'],
      registers: [this.registry],
    });

    this.dbPoolConnectionsMax = new Gauge({
      name: METRIC_NAMES.DB_POOL_CONNECTIONS_MAX,
      help: 'DB pool maksimum baglanti.',
      labelNames: ['pool'],
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: METRIC_NAMES.DB_QUERY_DURATION_SECONDS,
      help: 'Prisma sorgu suresi.',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
  }

  /** BullMQ kuyruklarini metrik yenileme icin kaydet (Faz 4+). */
  registerBullQueues(queues: Queue[]): void {
    this.bullQueues.push(...queues);
    if (!this.bullRefreshTimer) {
      this.bullRefreshTimer = setInterval(() => void this.refreshBullQueueGauges(), 15_000);
      this.bullRefreshTimer.unref();
    }
  }

  private async refreshBullQueueGauges(): Promise<void> {
    for (const q of this.bullQueues) {
      try {
        const [waiting, active, failed] = await Promise.all([
          q.getWaitingCount(),
          q.getActiveCount(),
          q.getFailedCount(),
        ]);
        this.bullmqJobsWaiting.set({ queue: q.name }, waiting);
        this.bullmqJobsActive.set({ queue: q.name }, active);
        this.bullmqDlqSize.set({ queue: q.name }, failed);
      } catch {
        /* ignore scrape errors */
      }
    }
  }

  onModuleInit(): void {
    // Spec 8.10.2 - Node.js default metrikleri (process_cpu_seconds_total,
    // process_resident_memory_bytes, nodejs_eventloop_lag_seconds, vs.)
    collectDefaultMetrics({ register: this.registry });
    this.logger.log('Prometheus metrics initialized');
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
