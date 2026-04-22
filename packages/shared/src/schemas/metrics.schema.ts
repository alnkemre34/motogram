// Spec 8.10.2 - Prometheus metrik sabitleri.
// Backend'in /metrics endpoint'i tarafindan yayinlanir; admin paneli ve Grafana
// bu isimleri bilmek zorundadir. Yeni metrik eklendiginde buradan yonetilmelidir.

export const METRIC_NAMES = {
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  HTTP_REQUEST_DURATION_SECONDS: 'http_request_duration_seconds',
  WEBSOCKET_CONNECTIONS_ACTIVE: 'websocket_connections_active',
  REDIS_GEORADIUS_DURATION_SECONDS: 'redis_georadius_duration_seconds',
  BULLMQ_JOBS_COMPLETED_TOTAL: 'bullmq_jobs_completed_total',
  BULLMQ_JOBS_FAILED_TOTAL: 'bullmq_jobs_failed_total',
  EMERGENCY_ALERTS_CREATED_TOTAL: 'emergency_alerts_created_total',
  FEATURE_FLAG_EVALUATIONS_TOTAL: 'feature_flag_evaluations_total',
  AB_TEST_ASSIGNMENTS_TOTAL: 'ab_test_assignments_total',
  ZOD_RESPONSE_MISMATCH_TOTAL: 'zod_response_mismatch_total',
  ZOD_INBOUND_VALIDATION_ERRORS_TOTAL: 'zod_inbound_validation_errors_total',
  BULLMQ_JOBS_WAITING: 'bullmq_jobs_waiting',
  BULLMQ_JOBS_ACTIVE: 'bullmq_jobs_active',
  BULLMQ_DLQ_SIZE: 'bullmq_dlq_size',
  BULLMQ_JOB_DURATION_SECONDS: 'bullmq_job_duration_seconds',
  WEBSOCKET_MESSAGE_LATENCY_SECONDS: 'websocket_message_latency_seconds',
  WEBSOCKET_DISCONNECTIONS_TOTAL: 'websocket_disconnections_total',
  REDIS_COMMAND_ERRORS_TOTAL: 'redis_command_errors_total',
  DB_POOL_CONNECTIONS_ACTIVE: 'db_pool_connections_active',
  DB_POOL_CONNECTIONS_MAX: 'db_pool_connections_max',
  DB_QUERY_DURATION_SECONDS: 'db_query_duration_seconds',
} as const;

export type MetricName = (typeof METRIC_NAMES)[keyof typeof METRIC_NAMES];
