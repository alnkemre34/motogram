import { z } from 'zod';

/** Nest/Compose often pass booleans as strings; Boolean("false") === true — avoid that. */
function parseEnvBool(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const s = String(value).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return defaultValue;
}

const postgresUrl = z
  .string()
  .min(1)
  .refine(
    (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
    'DATABASE_URL must start with postgresql:// or postgres://',
  );

const redisUrl = z
  .string()
  .min(1)
  .refine(
    (v) => v.startsWith('redis://') || v.startsWith('rediss://'),
    'REDIS_URL must start with redis:// or rediss://',
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  API_PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: postgresUrl,
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  REDIS_URL: redisUrl,
  REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(2_000),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1).default('motogram-media'),
  MINIO_USE_SSL: z.boolean().default(false),

  SENTRY_DSN: z
    .preprocess((v) => (v === '' || v === undefined ? undefined : v), z.string().url().optional()),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  SERVER_HOSTNAME: z.string().min(1).default('api-local'),
  INTERNAL_API_SHARED_SECRET: z
    .string()
    .min(32, 'INTERNAL_API_SHARED_SECRET must be at least 32 characters'),

  ZOD_RESPONSE_STRICT: z.boolean().default(false),
  CORS_ALLOWED_ORIGINS: z.string().min(1).default('http://localhost:3000'),

  DISABLE_BULLMQ_WORKER: z.boolean().default(false),
  DISABLE_WS_ADAPTER: z.string().optional(),

  /** Sign in with Apple — boş string (Docker `.env` / Compose) yok sayılır. */
  APPLE_CLIENT_ID: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.string().min(1).optional(),
  ),
  /** Google Sign-In — boş string yok sayılır. */
  GOOGLE_CLIENT_IDS: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.string().optional(),
  ),

  /** Optional: Prometheus base URL for scripts/check-slo.sh (e.g. http://prometheus:9090) */
  PROMETHEUS_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Normalize process.env for Zod (PORT fallback, booleans from strings). */
export function normalizeProcessEnv(e: NodeJS.ProcessEnv): Record<string, unknown> {
  return {
    ...e,
    NODE_ENV: e.NODE_ENV ?? 'development',
    API_PORT: e.API_PORT ?? e.PORT ?? '3000',
    MINIO_USE_SSL: parseEnvBool(e.MINIO_USE_SSL, false),
    ZOD_RESPONSE_STRICT: parseEnvBool(e.ZOD_RESPONSE_STRICT, false),
    DISABLE_BULLMQ_WORKER: parseEnvBool(e.DISABLE_BULLMQ_WORKER, false),
    SENTRY_TRACES_SAMPLE_RATE: e.SENTRY_TRACES_SAMPLE_RATE ?? '0.1',
    DATABASE_POOL_MIN: e.DATABASE_POOL_MIN ?? '2',
    DATABASE_POOL_MAX: e.DATABASE_POOL_MAX ?? '10',
    DATABASE_STATEMENT_TIMEOUT_MS: e.DATABASE_STATEMENT_TIMEOUT_MS ?? '10000',
    REDIS_COMMAND_TIMEOUT_MS: e.REDIS_COMMAND_TIMEOUT_MS ?? '2000',
    JWT_ACCESS_TTL: e.JWT_ACCESS_TTL ?? '15m',
    JWT_REFRESH_TTL: e.JWT_REFRESH_TTL ?? '7d',
    MINIO_PORT: e.MINIO_PORT ?? '9000',
    MINIO_BUCKET: e.MINIO_BUCKET ?? 'motogram-media',
    SERVER_HOSTNAME: e.SERVER_HOSTNAME ?? 'api-local',
    CORS_ALLOWED_ORIGINS: e.CORS_ALLOWED_ORIGINS ?? 'http://localhost:3000',
  };
}

/**
 * Fail-fast: call before NestFactory.create. Exits process on invalid env.
 */
export function loadEnv(): Env {
  const parsed = envSchema.safeParse(normalizeProcessEnv(process.env));
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('[env] Invalid environment:', parsed.error.flatten().fieldErrors);
    // eslint-disable-next-line no-console
    console.error('[env] Issues:', parsed.error.issues);
    process.exit(1);
  }
  return parsed.data;
}
