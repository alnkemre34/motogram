# Motogram — Production-Ready Backend Formülü (v2.0)

**Amaç:** Mevcut `apps/api` yapısını, `motogram-spec.md`, `PROJECT_BOARD.md`, `phase-*.md` ve `ZOD_FULL_INTEGRATION_ROADMAP.md` belgelerindeki kazanımları koruyarak; **hedef 10.000 eş zamanlı kullanıcı profili** için tam gözlemlenebilir, veri tutarlılığı garantili, graceful shutdown yapabilen, güvenli bir üretim arka ucu hâline getirmek.

> **Not:** "Mükemmel" veya "sıfır sürpriz" yerine **"production-ready"** tabirini kullanıyoruz. 10k hedefi, k6 yük testi ve kapasite planlaması ile doğrulanmadan **garanti değildir**; plan edilen profildir. Gerçek kapasite, Bölüm 12'deki ölçüm metodolojisiyle doğrulanmalıdır.

---

## 1. Değişmez Anayasa (Non-Negotiable Principles)

| Prensip | Uygulama Kuralı |
|---|---|
| **Tek Gerçek Kaynak (SSOT)** | Tüm veri şekilleri (DTO, Event, Queue Job, WS mesajı) yalnızca `packages/shared` içindeki Zod şemalarından türetilir. Backend içinde yeni bir yerde `z.object()` yazılmadan önce shared'a taşınabilir mi diye sorulur. |
| **Runtime Tip Güvenliği** | `any` kullanımı ESLint `@typescript-eslint/no-explicit-any` ile engellenir. Tüm dış sınırlar (HTTP, WS, Queue, Event) Zod ile doğrulanır. |
| **Fail-Fast Startup** | Geçersiz env veya şema uyumsuzluğu → **process exit 1**. `NestFactory.create` çağrılmadan önce env doğrulanır. |
| **Asla Sessiz Kalma** | Runtime'da şema uyumsuzluğu tespit edilirse: metrik artır + Sentry'ye gönder + log at; kullanıcıyı kırma (production). Development/staging'de ise kır. |
| **Gözlemlenebilirlik** | Her kritik işlem Prometheus metriği üretir, hatalar Sentry'ye düşer, yapılandırılmış log'lar Loki'ye akar. SLO'lar Bölüm 8'de tanımlı. |
| **Yatay Ölçeklenebilirlik** | Stateless API: durum Redis + PostgreSQL'de. WS bağlantıları sticky session; sunucular arası iletişim imzalı iç HTTP çağrıları ile. |
| **İdempotent İşlemler** | Tekrar eden istekler veri bozmaz (`clientId` ile mesaj tekilleştirme, `ON CONFLICT`, BullMQ `jobId`). |
| **Graceful Shutdown** | `SIGTERM` → yeni bağlantıları reddet, aktif istekleri bitir, WS client'larını temiz kapat, BullMQ worker'ları `close()`, DB/Redis bağlantılarını kapat. 30 sn içinde bitmezse `SIGKILL`. |

---

## 2. Teknoloji Yığını — Kesin Liste

| Bileşen | Seçim | Gerekçe |
|---|---|---|
| Çalışma Zamanı | Node.js 20 LTS | Kararlılık, uzun süreli destek. |
| Framework | NestJS 10 (mevcut) | Modüler, DI, yerleşik WS/microservice. **v11'e geçiş ayrı bir RFC konusudur, bu dokümanın kapsamı dışındadır.** |
| Dil | TypeScript 5+ | `strict: true`, `noUncheckedIndexedAccess: true`. |
| Veritabanı | PostgreSQL 15 + PostGIS | Kalıcı veri, coğrafi sorgular. |
| DB Proxy | PgBouncer (transaction mode) | Connection pooling; Bölüm 6.3. |
| Cache / GEO / Kuyruk | Redis 7.2+ | GEO komutları, BullMQ backend, oturum. |
| İş Kuyruğu | BullMQ | Güvenilir gecikmeli işler, DLQ, exponential backoff, `jobId` ile idempotency. |
| WebSocket | **Socket.IO 4.x** | ACK, room, namespace, auto-reconnect, binary fallback zaten mevcut. `ws`'e geçiş gereksiz; bu mevcut 10k hedefi için Socket.IO yeterlidir. |
| Nesne Depolama | **MinIO (prod & dev)** → İsteğe bağlı R2 migrasyonu (Bölüm 11) | Bugün çalışan çözümdür. R2 migrasyonu **ayrı bir proje** olarak, "önce kur, sonra key bazlı geçir, MinIO read-only yap, sonra kapat" stratejisi ile yapılır; asla Buffer dual-write değil. |
| Medya İşleme | Sharp | WebP dönüşümü, resize. BullMQ içinde worker olarak çalışır. |
| Doğrulama | Zod + özel pipe/interceptor | SSOT şemaları, global pipe ve (safe) interceptor. |
| Gözlemlenebilirlik | Prometheus, Grafana, Loki, Sentry, OpenTelemetry (opsiyonel) | Metrik, log, hata, trace. |
| Secret Yönetimi | Docker secrets + `.env.prod` (chmod 600) + Vault (orta vade) | Bölüm 10. |
| Paket Yöneticisi | pnpm | Monorepo için hızlı, disk dostu. |

---

## 3. Klasör Yapısı (`apps/api`)

```text
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/                     # Forward-only
│   ├── sql/                            # PostGIS fonksiyonları (idempotent)
│   └── seed.ts                         # Derlenmiş JS ile çalışır
├── src/
│   ├── common/
│   │   ├── config/
│   │   │   ├── env.schema.ts           # Zod env doğrulama
│   │   │   └── server-identity.ts      # SERVER_HOSTNAME + INTERNAL_SECRET
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── internal-token.guard.ts # /internal/* endpoint'leri için HMAC
│   │   ├── interceptors/
│   │   │   ├── zod-serializer.interceptor.ts  # Prod'da safeParse + metrik
│   │   │   └── metrics.interceptor.ts
│   │   ├── pipes/
│   │   │   └── zod-validation.pipe.ts
│   │   ├── queue/
│   │   │   ├── typed-queue.factory.ts  # Şemayla birleşik queue factory
│   │   │   └── graceful-worker.ts      # Shutdown hook entegre worker
│   │   ├── events/
│   │   │   └── zod-event-bus.service.ts
│   │   ├── fanout/
│   │   │   └── fanout.service.ts       # HMAC-imzalı iç HTTP çağrıları
│   │   ├── health/
│   │   │   └── health.controller.ts    # /livez, /readyz (ayrı!)
│   │   └── metrics/
│   │       └── metrics.module.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── posts/
│   │   ├── map/
│   │   ├── location/
│   │   │   └── queue/location-sync.queue.ts
│   │   ├── party/
│   │   │   ├── location.gateway.ts
│   │   │   └── leader-election.service.ts
│   │   ├── messaging/
│   │   │   └── messaging.gateway.ts
│   │   ├── media/
│   │   │   └── queue/media.queue.ts
│   │   ├── emergency/
│   │   ├── gamification/
│   │   ├── community/
│   │   ├── event/
│   │   ├── push/
│   │   ├── feature-flag/
│   │   └── admin/
│   ├── app.module.ts
│   └── main.ts
├── Dockerfile                           # Multi-stage, non-root, HEALTHCHECK
├── tsconfig.json
└── tsconfig.seed.json
```

---

## 4. Kritik Değişiklikler (Öncelik Sırasına Göre)

### 4.1 Env Fail-Fast — **P0, hemen**

`apps/api/src/common/config/env.schema.ts`:

```typescript
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  API_PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url().refine(
    v => v.startsWith('postgresql://') || v.startsWith('postgres://'),
    'DATABASE_URL postgresql:// ile başlamalı',
  ),
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  REDIS_URL: z.string().url().refine(v => v.startsWith('redis://') || v.startsWith('rediss://')),
  REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(2_000),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET en az 32 karakter'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1).default('motogram-media'),
  MINIO_USE_SSL: z.coerce.boolean().default(false),

  SENTRY_DSN: z.string().url().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  // Horizontal scaling
  SERVER_HOSTNAME: z.string().min(1).default('api-local'),
  INTERNAL_API_SHARED_SECRET: z.string().min(32, 'Iç API HMAC secret en az 32 karakter'),

  // Response validation davranışı
  ZOD_RESPONSE_STRICT: z.coerce.boolean().default(false), // prod: false, dev/test: true

  DISABLE_BULLMQ_WORKER: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('[env] Geçersiz ortam değişkenleri:', parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
}
```

`apps/api/src/main.ts` — **`NestFactory.create`'den önce** doğrula:

```typescript
import { loadEnv } from './common/config/env.schema';

const env = loadEnv(); // Fail fast: buradan sonrası garantilidir

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useGlobalInterceptors(/* ... */);
  app.enableShutdownHooks(); // onModuleDestroy çalışsın
  await app.listen(env.API_PORT);
}
bootstrap();
```

> NestJS'in `ConfigModule.validate`'ı tek başına yeterli **değildir**; çünkü `process.env`'i doğrudan okuyan kodları yakalamaz. Yukarıdaki yaklaşım fail-fast'i gerçekten sağlar.

---

### 4.2 Prisma Migration Baseline (Idempotent Script)

Sabit timestamp yerine idempotent bir script yazın:

`scripts/bootstrap-prod-db.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

MIGRATION_NAME="${1:?migration adı gerekli, örn: 20260421000000_init}"

cd /opt/motogram

APPLIED=$(docker compose -f docker-compose.prod.yml --env-file .env.prod \
  --profile tooling run --rm api-migrate \
  npx prisma migrate status --schema=prisma/schema.prisma 2>&1 || true)

if echo "$APPLIED" | grep -q "$MIGRATION_NAME"; then
  echo "[ok] $MIGRATION_NAME zaten işaretli, atlanıyor."
  exit 0
fi

docker compose -f docker-compose.prod.yml --env-file .env.prod \
  --profile tooling run --rm api-migrate \
  npx prisma migrate resolve --applied "$MIGRATION_NAME" \
  --schema=prisma/schema.prisma
```

Bu script yanlışlıkla iki kez çalıştırılsa da zarar vermez.

---

### 4.3 Typed Queue Factory — **P0**

Her `add` çağrısında `queue` + `schema`'yı ayrı ayrı geçirmek yerine, tek sorumluluklu sarmalayıcı:

`apps/api/src/common/queue/typed-queue.factory.ts`:

```typescript
import { Logger } from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import type { ZodSchema, z } from 'zod';

export class TypedQueue<S extends ZodSchema> {
  private readonly logger: Logger;

  constructor(
    private readonly queue: Queue,
    private readonly schema: S,
  ) {
    this.logger = new Logger(`TypedQueue:${queue.name}`);
  }

  async add(jobName: string, data: z.infer<S>, opts?: JobsOptions) {
    const parsed = this.schema.safeParse(data);
    if (!parsed.success) {
      this.logger.error(
        `Invalid payload for ${this.queue.name}.${jobName}`,
        parsed.error.issues,
      );
      throw new Error(`Invalid payload for job ${jobName}`);
    }
    return this.queue.add(jobName, parsed.data, opts);
  }

  get raw(): Queue { return this.queue; }
}
```

Kullanım:

```typescript
import { LocationSyncJobSchema } from '@motogram/shared';

@Injectable()
export class LocationSyncQueue {
  private readonly typed: TypedQueue<typeof LocationSyncJobSchema>;

  constructor(@InjectQueue('location-sync') queue: Queue) {
    this.typed = new TypedQueue(queue, LocationSyncJobSchema);
  }

  async enqueuePing(data: z.infer<typeof LocationSyncJobSchema>) {
    // jobId ile idempotency
    await this.typed.add('ping', data, {
      jobId: `ping:${data.userId}:${data.timestamp}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { age: 3_600, count: 1_000 },
      removeOnFail:     { age: 24 * 3_600 },
    });
  }
}
```

---

### 4.4 Zod Response Validation — **Production-Safe**

Global `parse` kullanıcıyı kırabilir. Production'da **`safeParse` + metrik + Sentry**; dev/test/staging'de **strict** davranış:

`apps/api/src/common/interceptors/zod-serializer.interceptor.ts`:

```typescript
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map } from 'rxjs/operators';
import { ZodSchema } from 'zod';
import * as Sentry from '@sentry/node';
import { Counter } from 'prom-client';

export const ZOD_RESPONSE_KEY = 'zod:response';
export const ZodResponse = (schema: ZodSchema) =>
  Reflect.metadata(ZOD_RESPONSE_KEY, schema);

const mismatchCounter = new Counter({
  name: 'zod_response_mismatch_total',
  help: 'Controller response Zod şemasıyla uyuşmadı',
  labelNames: ['route'],
});

@Injectable()
export class ZodSerializerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ZodSerializerInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly strict: boolean, // env.ZOD_RESPONSE_STRICT
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const schema = this.reflector.get<ZodSchema>(ZOD_RESPONSE_KEY, ctx.getHandler());
    if (!schema) return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const route = `${req.method} ${req.route?.path ?? req.url}`;

    return next.handle().pipe(
      map((data) => {
        const result = schema.safeParse(data);
        if (result.success) return result.data;

        mismatchCounter.inc({ route });
        this.logger.warn(`[zod-response-mismatch] ${route}`, result.error.issues);
        Sentry.captureException(new Error(`Response schema mismatch: ${route}`), {
          extra: { issues: result.error.issues },
        });

        if (this.strict) throw result.error; // dev/test/staging kır
        return data; // prod: orijinali döndür ama görünür yap
      }),
    );
  }
}
```

`main.ts`:

```typescript
app.useGlobalInterceptors(
  new ZodSerializerInterceptor(app.get(Reflector), env.ZOD_RESPONSE_STRICT),
);
```

Controller örneği:

```typescript
@Controller('auth')
export class AuthController {
  @Post('login')
  @ZodResponse(AuthResultSchema)
  login(@Body() dto: LoginDto) { return this.authService.login(dto); }
}
```

---

### 4.5 Yatay Ölçekleme — `serverHostname` + İmzalı Fanout

**Adım 1:** `SERVER_HOSTNAME` env'den gelir (kubernetes pod adı, docker service adı vb. DNS-çözülebilir bir isim):

```typescript
// apps/api/src/common/config/server-identity.ts
export const SERVER_HOSTNAME = process.env.SERVER_HOSTNAME!;
export const INTERNAL_SECRET = process.env.INTERNAL_API_SHARED_SECRET!;
```

**Adım 2:** `PartyMember.serverHostname` alanı (önceki `serverId` hex'i yerine):

```prisma
model PartyMember {
  // ... mevcut alanlar
  serverHostname String?   // Üyenin bağlı olduğu WS sunucusunun DNS adı
}
```

**Adım 3:** Gateway kayıt:

```typescript
@SubscribeMessage('party:join')
async handleJoin(client: Socket, payload: JoinPartyDto) {
  await this.partyService.addMember(payload.partyId, client.data.userId, SERVER_HOSTNAME);
}
```

**Adım 4:** HMAC-imzalı iç HTTP çağrısı:

```typescript
// apps/api/src/common/fanout/fanout.service.ts
import { createHmac, randomUUID } from 'crypto';

@Injectable()
export class FanoutService {
  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
    private readonly gateway: LocationGateway,
  ) {}

  async sendToUser(userId: string, event: string, data: unknown) {
    const member = await this.prisma.partyMember.findFirst({
      where: { userId, leftAt: null },
      select: { serverHostname: true },
    });
    if (!member?.serverHostname) return;

    if (member.serverHostname === SERVER_HOSTNAME) {
      this.gateway.emitToUser(userId, event, data);
      return;
    }

    const body = JSON.stringify({ userId, event, data });
    const nonce = randomUUID();
    const ts = Date.now().toString();
    const sig = createHmac('sha256', INTERNAL_SECRET)
      .update(`${ts}.${nonce}.${body}`)
      .digest('hex');

    await this.http.axiosRef.post(
      `http://${member.serverHostname}:3000/internal/fanout`,
      body,
      {
        headers: {
          'content-type': 'application/json',
          'x-internal-ts': ts,
          'x-internal-nonce': nonce,
          'x-internal-sig': sig,
        },
        timeout: 2_000,
      },
    );
  }
}
```

`/internal/fanout` endpoint'i `InternalTokenGuard` ile korunur:

- HMAC doğrula
- `ts` 30 sn içinde mi?
- `nonce` Redis'te 60 sn TTL ile (`SET NX`) → replay koruması

---

### 4.6 Graceful Shutdown — **P0**

`main.ts`:

```typescript
const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();

const server = await app.listen(env.API_PORT);
server.keepAliveTimeout = 65_000; // ALB/Nginx 60sn'den büyük olmalı
server.headersTimeout  = 70_000;
```

Her BullMQ worker `OnModuleDestroy` uygular:

```typescript
@Injectable()
export class LocationSyncWorker implements OnModuleDestroy {
  constructor(@InjectQueue('location-sync') private readonly queue: Queue) {}
  private worker?: Worker;

  async onModuleDestroy() {
    await this.worker?.close();           // Aktif jobu bitir, yenisini alma
    await this.queue.close();
  }
}
```

WS gateway `OnModuleDestroy`:

```typescript
async onModuleDestroy() {
  this.server.emit('server:shutdown');    // Client'lar reconnect planlasın
  await new Promise(r => setTimeout(r, 1_000));
  this.server.close();
}
```

Docker Compose / Kubernetes `terminationGracePeriodSeconds: 45`.

---

## 5. Veritabanı

### 5.1 Kritik İndeksler

```sql
-- Konum ping'leri
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_pings_user_timestamp
  ON location_pings (user_id, timestamp DESC);

-- Mesajlar
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at DESC);

-- Aktif parti üyeleri (partial index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_party_members_party_left
  ON party_members (party_id, left_at) WHERE left_at IS NULL;

-- Feed sorguları
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_author_created
  ON posts (author_id, created_at DESC);
```

### 5.2 PostGIS Fonksiyonları

`find_events_within`, `find_communities_within` vb. fonksiyonlar **idempotent** (`CREATE OR REPLACE FUNCTION ...`). Kaynak: `prisma/sql/phase4_postgis.sql`. Deploy zinciri bu dosyayı her zaman uygular.

### 5.3 Connection Pooling (PgBouncer)

10k kullanıcı için API başına doğrudan Postgres bağlantısı **anti-pattern**. PgBouncer transaction-mode:

```ini
[pgbouncer]
pool_mode = transaction
max_client_conn = 2000
default_pool_size = 25
reserve_pool_size = 5
server_idle_timeout = 600
```

Prisma tarafında:
```
DATABASE_URL="postgresql://user:pass@pgbouncer:6432/db?pgbouncer=true&connection_limit=20"
```

> Dikkat: Transaction-mode'da prepared statement yok. `?pgbouncer=true` bunu işaretler.

### 5.4 Statement Timeout

Her bağlantıda:

```sql
SET statement_timeout = '10s';
SET idle_in_transaction_session_timeout = '30s';
```

Prisma middleware veya `POSTGRES_INIT_SQL` ile.

---

## 6. Gözlemlenebilirlik

### 6.1 Prometheus Metrikleri

```typescript
// HTTP
http_request_duration_seconds{method,route,status_code}        // Histogram

// WebSocket
websocket_connections_active                                    // Gauge
websocket_message_latency_seconds{event}                        // Histogram

// Redis
redis_georadius_duration_seconds{radius_km}                     // Histogram
redis_command_errors_total{command}                             // Counter

// BullMQ
bullmq_jobs_waiting{queue}                                      // Gauge
bullmq_jobs_active{queue}                                       // Gauge
bullmq_jobs_failed_total{queue}                                 // Counter
bullmq_job_duration_seconds{queue,job_name}                     // Histogram
bullmq_dlq_size{queue}                                          // Gauge

// Database
db_pool_connections_active{pool}                                // Gauge
db_query_duration_seconds{operation}                            // Histogram

// Business
emergency_alerts_created_total{type}                            // Counter
location_pings_accepted_total                                   // Counter
location_pings_rejected_total{reason}                           // Counter

// Schema uyumsuzlukları
zod_response_mismatch_total{route}                              // Counter
zod_inbound_validation_errors_total{source,schema}              // Counter
```

### 6.2 SLO'lar

| Servis | SLO | Ölçüm penceresi |
|---|---|---|
| HTTP genel | p95 < 300 ms, p99 < 1 s, hata < %1 | 30 gün |
| `/v1/location/update` | p95 < 50 ms | 7 gün |
| WS message latency (same server) | p95 < 100 ms | 7 gün |
| BullMQ job completion | p95 < 30 s | 7 gün |
| DLQ size | < 10 | hedef |

### 6.3 Kritik Alert Kuralları

```yaml
groups:
  - name: motogram-critical
    rules:
      - alert: High5xxRate
        expr: |
          sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[5m]))
          / sum(rate(http_request_duration_seconds_count[5m])) > 0.01
        for: 5m
        annotations:
          summary: "5xx oranı %1'i aştı"

      - alert: RedisGeoQuerySlow
        expr: histogram_quantile(0.95, sum by (le) (rate(redis_georadius_duration_seconds_bucket[5m]))) > 0.015
        for: 10m

      - alert: DLQGrowing
        expr: max(bullmq_dlq_size) > 100
        for: 5m

      - alert: DbPoolExhaustion
        expr: db_pool_connections_active / on(pool) db_pool_connections_max > 0.9
        for: 2m

      - alert: WsDisconnectSpike
        expr: rate(websocket_disconnections_total[5m]) > 20
        for: 3m

      - alert: ZodResponseMismatch
        expr: increase(zod_response_mismatch_total[10m]) > 5
        annotations:
          summary: "Backend response şemayla uyuşmuyor — client kırılabilir"
```

### 6.4 Ayrı `livez` / `readyz`

- `/livez` → sadece process yaşıyor mu? (her zaman 200; yükü artırmaz)
- `/readyz` → DB ping, Redis ping, migrations uygulanmış mı? Shutdown sırasında **503** döner (bu sayede load balancer yeni istek göndermez).

---

## 7. Güvenlik

### 7.1 Rate Limiting (İki Katman)

**Nginx** (`nginx.prod.conf`):

```nginx
limit_req_zone $binary_remote_addr zone=api_general:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=api_auth:10m    rate=5r/s;
limit_req_zone $binary_remote_addr zone=api_sos:10m     rate=1r/s;

location /v1/auth/      { limit_req zone=api_auth burst=3  nodelay; proxy_pass http://api:3000; }
location /v1/emergency/ { limit_req zone=api_sos  burst=1  nodelay; proxy_pass http://api:3000; }
location /v1/           { limit_req zone=api_general burst=20 nodelay; proxy_pass http://api:3000; }
```

**NestJS**:

```typescript
@Throttle({ default: { limit: 3, ttl: 600_000 } }) // SOS: 10 dk'da 3
@Post('alerts')
async createAlert() { /* ... */ }
```

### 7.2 HTTP Güvenlik Başlıkları

```typescript
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: false, // API için; web için ayrıca ayarlanır
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.enableCors({
  origin: env.CORS_ALLOWED_ORIGINS.split(','),
  credentials: true,
});
```

### 7.3 Secret Yönetimi

- **Kısa vade:** `.env.prod` `chmod 600`, root olmayan `motogram` kullanıcısına ait, git'te yok, backup'larda şifreli.
- **Orta vade:** Docker secrets / Kubernetes `Secret` + sealed-secrets.
- **Uzun vade:** HashiCorp Vault veya cloud KMS.
- Secret'lar log'da, Sentry breadcrumb'da, metrik label'ında **asla** görünmez (redaction middleware).
- JWT secret rotasyonu: access ≤ 15 dk TTL, refresh rotasyonu her kullanımda.

### 7.4 Dependency Güvenliği

CI'da zorunlu:
- `pnpm audit --audit-level=high` (high/critical varsa başarısız)
- Snyk veya GitHub Dependabot + weekly security PR

### 7.5 Input Güvenliği

- Tüm HTTP body → `ZodValidationPipe` (zaten var).
- Dosya yüklemelerinde MIME sniffing (`file-type`), boyut limiti, magic byte doğrulama.
- WS mesajları → `socket-events.schema.ts` ile doğrulama.

---

## 8. Test Stratejisi

### 8.1 Birim Testleri

Kapsanan: her service için ≥ %70 line coverage, kritik akışlar için branch coverage.

### 8.2 Zod Contract Testleri (CI'da Zorunlu)

```typescript
it('POST /v1/auth/login yanıtı AuthResultSchema ile uyumlu olmalı', async () => {
  const res = await request(app).post('/v1/auth/login').send(validBody);
  expect(res.status).toBe(200);
  expect(() => AuthResultSchema.parse(res.body)).not.toThrow();
});
```

CI, `zod_response_mismatch_total`'ın E2E suite sonunda **0** olmasını bekler.

### 8.3 Yük Testi (k6) — Üç Ayrı Senaryo

- **`k6/http-baseline.js`**: Karışık trafik, hedef 1000 RPS, p95 < 300 ms.
- **`k6/location-spike.js`**: Dakikada 10 bin ping, Redis GEO sağlığı.
- **`k6/ws-fanout.js`**: 5 bin aktif WS + saniyede 500 presence güncellemesi; cross-server fanout latency ölçümü.

Her senaryo için thresholds:
```js
thresholds: {
  http_req_duration: ['p(95)<300', 'p(99)<1000'],
  http_req_failed:   ['rate<0.01'],
}
```

### 8.4 Chaos Testleri (Aylık)

- Redis'i 30 sn düşür → API `readyz` 503 dönmeli, veri kaybı olmamalı.
- Bir API pod'unu öldür → WS client'lar ≤ 5 sn'de reconnect etmeli.
- DB failover simülasyonu (statement timeout test).

---

## 9. Deployment

### 9.1 CI/CD Akışı (TTY'siz, Otomatik)

```bash
#!/usr/bin/env bash
# scripts/deploy.sh
set -euo pipefail

VERSION="${GITHUB_SHA:?}"
ENV="${1:?staging|production}"

echo "[1/7] Sentry release oluşturuluyor…"
sentry-cli releases new "$VERSION"
sentry-cli releases set-commits "$VERSION" --auto

echo "[2/7] Docker image build & push…"
docker build -t motogram/api:"$VERSION" apps/api
docker push motogram/api:"$VERSION"

echo "[3/7] Prisma migration durumu kontrol…"
docker compose -f "docker-compose.$ENV.yml" run --rm api-migrate \
  npx prisma migrate status

echo "[4/7] $ENV deploy (rolling)…"
docker compose -f "docker-compose.$ENV.yml" up -d --build

echo "[5/7] Smoke test…"
for i in {1..30}; do
  curl -fs "https://api-$ENV.motogram.app/readyz" && break || sleep 2
done

echo "[6/7] Post-deploy SLO kontrol (60 sn)…"
./scripts/check-slo.sh "$ENV" 60

echo "[7/7] Sentry release finalize…"
sentry-cli releases finalize "$VERSION"
sentry-cli releases deploys "$VERSION" new -e "$ENV"
```

- **Onay:** Staging → production geçişi GitHub Environment protection rules ile (manuel onay UI'dan).
- **Rollback:** `check-slo.sh` SLO ihlali görürse, `docker compose rollout undo` veya önceki image tag'ine dönüş.

### 9.2 Rolling Deploy + Blue-Green Opsiyonu

İki API replica + Nginx upstream `max_fails=3 fail_timeout=10s`. Pod'lar sırayla yeniden başlatılır, `readyz` 200 dönene kadar trafik almaz.

---

## 10. Secret & Konfigürasyon Yaşam Döngüsü

| Tür | Depolama | Rotasyon |
|---|---|---|
| DB şifresi | Docker secret / Vault | 90 gün |
| Redis şifresi | aynı | 90 gün |
| JWT access secret | Vault | 180 gün, overlap dönemli |
| JWT refresh secret | Vault | 180 gün |
| INTERNAL_API_SHARED_SECRET | Vault | 90 gün |
| MinIO/R2 access key | Vault | 90 gün |
| Sentry DSN | Konfig (düşük gizlilik) | gerektikçe |

Rotasyon adımları her secret için runbook'ta dokümante edilir (`docs/RUNBOOK.md`).

---

## 11. Uzun Vadeli Geçiş Planları (Opsiyonel RFC'ler)

### 11.1 MinIO → Cloudflare R2 (Doğru Yaklaşım)

> **Önceki versiyondaki "Buffer dual-write" pattern'i yanlıştı; bu pattern'i kullanmayın.**

**Hedef:** Okuma trafiğini R2'ye taşımak; yazma trafiğini kademeli olarak geçirmek; MinIO'yu nihayetinde kapatmak.

**Adımlar:**

1. **R2 bucket + IAM** ayarla, S3 uyumlu client credential'ları al.
2. **Backfill migration:** `scripts/migrate-media-to-r2.ts`:
   - MinIO'dan key listesini (paginated) oku.
   - Her key için R2'de var mı kontrol et; yoksa **stream-to-stream** kopyala (Buffer'ı RAM'e hiç almadan).
   - İlerleme `media_migration` tablosunda kayıt altına alınır.
3. **Read-through:** `MediaService.getUrl(key)` önce R2, 404 ise MinIO fallback + arka planda R2'ye kopyala. Buffer kuyruğa atılmaz; **sadece key**.
4. **Write cutover:** Feature flag `media.writeTarget = 'r2'` açılır. Yeni yüklemeler R2'ye.
5. **MinIO read-only mode:** 2 hafta izle. Metrik: `minio_fallback_reads_total` → 0'a yakınsa.
6. **MinIO decommission:** Son backup sonrası kapat.

Her adım feature flag ile kontrollüdür ve **tek yönlü değildir** (rollback mümkün).

### 11.2 NestJS 11 Upgrade (Ayrı RFC)

Bu dokümanın kapsamı dışındadır. `docs/phases/phase-7.md` içinde detaylandırılsın.

### 11.3 OpenTelemetry Tracing

Prometheus + Sentry mevcut; distributed tracing eklemek için `@opentelemetry/sdk-node` + Tempo/Jaeger. 10k kullanıcı öncesi **iyi olur**, ama P1 değildir.

---

## 12. Kapasite & SLO Doğrulaması

10k kullanıcı iddiası için **asgari kanıt zinciri:**

1. **Baseline yük testi** (k6) → p95 SLO'ların ≥ 5000 RPS'de bile karşılandığını göster.
2. **WebSocket yük testi** → 10k eş zamanlı socket + sn başına 500 broadcast.
3. **DB connection pool** → PgBouncer + Prisma yapılandırması altında statement timeout ihlali yok.
4. **Redis memory profili** → `INFO memory` bir hafta boyunca < %70.
5. **BullMQ DLQ trendi** → haftalık raporda artış yok.

Bu 5 ölçüm **production'a tam yük almadan önce** geçerlidir. Geçmedikçe "10k hazır" denmez.

---

## 13. Backup & Disaster Recovery

| Varlık | Yöntem | RPO | RTO |
|---|---|---|---|
| PostgreSQL | `pgBackRest` full (gece) + WAL archiving (S3/R2) | 5 dk | 30 dk |
| Redis | AOF `everysec` + günlük RDB snapshot → off-site | 1 sn (AOF), 24 sa (snapshot) | 10 dk |
| MinIO/R2 | R2 versioning + cross-region replication | anlık | 30 dk |
| Kaynak kod + migration | GitHub + yedek remote | 0 | 5 dk |

**Restore drill'i çeyrekte bir**; `docs/RUNBOOK.md` içinde adım adım yazılır ve staging'de denenir. Denenmemiş backup = backup değildir.

---

## 14. Sonuç — 8 Altın Kural

1. **Zod her sınırda:** HTTP in/out, WS, Queue, Event, Env.
2. **Fail-fast startup, fail-soft runtime:** Env'i kır, ama response mismatch'te kullanıcıyı kırma; izle.
3. **Redis GEO'yu tek başına bırakma:** PostGIS yedekli, BullMQ ile kalıcı.
4. **Asla sessiz kalma:** Log + metrik + Sentry. "Görünmez hata" diye bir şey olmasın.
5. **Ölçeklenmeyi baştan planla:** Hostname + HMAC fanout, sticky session, PgBouncer, graceful shutdown.
6. **Secret'ı kod dışında tut:** Vault hedef; bu arada Docker secrets + disiplinli `.env.prod`.
7. **İddiayı ölçümle doğrula:** 10k kullanıcı k6 + SLO panosuyla ispatlanana kadar hedeftir, gerçek değil.
8. **Denenmemiş backup yoktur:** Çeyrekte bir restore drill.

Bu v2 formülü, önceki v1'deki pratik hataları (Buffer dual-write, TTY'li deploy, hex serverId, global strict response parse, eksik pool/shutdown/backup) düzelterek gerçek bir production arka ucu için uygulanabilir yol haritası sağlar.
