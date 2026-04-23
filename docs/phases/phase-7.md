# Faz 7: Enterprise Prod Hardening (Migrations, TLS, Backup, Observability, CI/CD, EAS)

> Kapsam: v1.0.0 PRODUCTION RELEASE'in ardindan urunun "enterprise"
> seviyesine cikarilmasi. Kodun is mantigi degismez; bu faz **operasyon,
> guvenlik, felaket kurtarma, gozlemlenebilirlik ve surekli teslimat**
> tarafini sertlestirir.
> Tahmini Sure: 1-2 hafta. Durum: PLAN.
> Bu dosya Kural 4 geregi PLAN belgesidir; kullanici "Plan onaylandi,
> kodlamaya basla" diyene kadar kod uretilmez.

## 1. Baslangic Kontrolu (Pre-Flight Check) - SIHIRLI ADIM

- [x] `.cursorrules` dosyasi bastan sona yeniden okundu. (2026-04-21)
- [x] `motogram-spec.md` icindeki asagidaki bolumler Faz 7 icin yeniden
  analiz edildi:
  - [x] 3.1 Teknoloji Yigini (Pazarliksiz)
  - [x] 3.4 Self-Hosted Medya Depolama ve Optimizasyon
  - [x] 5.2 Veri Saklama ve Imha Politikasi (GDPR)
  - [x] 5.3 Performans Butcesi ve Metrikler
  - [x] 8.1 Redis + PostgreSQL Veri Tutarliligi (DLQ)
  - [x] 8.4 Socket.IO Yatay Olcekleme (Redis Adapter, sticky session)
  - [x] 8.5 CDN Katmani (Nginx cache + opsiyonel Cloudflare)
  - [x] 8.6 Refresh Token Flow
  - [x] 8.7 Rate Limiting
  - [x] 8.10 DevOps ve Observability (TUM ALT BASLIKLAR)
  - [x] 8.11 Ek Muhendislik Iyilestirmeleri (Feature Flag, A/B, API
    surumlendirme, Soft Delete, Migration Stratejisi)
  - [x] 9.2 Kimlik Dogrulama (OTP prod config, Apple SignIn)
  - [x] 9.3 Push Notifications (FCM + APNs prod sertifikalari)
  - [x] 9.5 Cevresel Degiskenler ve Guvenlik
  - [x] 9.7 Altyapi: Sentry DSN prod
- [x] `docs/RUNBOOK.md` ve `docs/PROJECT_BOARD.md` mevcut durumu okundu.
- [x] Faz 1-6 tamamlandi, `v1.0.0 PRODUCTION RELEASE` durumu dogrulandi.

> Not: Spec 8.11.5 "geri alinabilir migration" ifadesi ile ADR/RUNBOOK'taki
> "forward-only migration" karari arasindaki tansiyon Faz 7 Adim 1'de
> netlestirilecek. Uretim riski nedeniyle **forward-only** yaklasimi
> korunacak; geri donus **image tag rollback + PITR snapshot** ile
> yapilacak (zaten RUNBOOK Bolum 2'de tanimli).

## 2. Gelistirme Plani ve Adimlar

### Asama 0 - Saglamlik Temeli (DB + Seed + Bootstrap) - **TAMAMLANDI (2026-04-21)**

- [x] Adim 1: Prisma migration baseline olustur.
  - `pnpm exec prisma migrate diff --from-empty --to-schema-datamodel
    prisma/schema.prisma --script` ile 39,895 bayt baseline SQL uretildi.
  - `apps/api/prisma/migrations/20260421000000_init/migration.sql`
    (1077 satir, PostGIS CREATE EXTENSION + tum enum/table/index'ler).
  - `apps/api/prisma/migrations/migration_lock.toml` (provider=postgresql).
  - VPS prod DB'sinde tablolar zaten var; `prisma migrate resolve --applied
    20260421000000_init` ile baseline "uygulanmis" olarak isaretlenecek
    (bkz. RUNBOOK Bolum 8 sonunda).
  - Spec 8.11.5 forward-only + ADR-028 uyumlu. BOM'suz UTF-8 (Postgres
    uyumlu).
- [x] Adim 2: Seed'i production build'e dahil et.
  - `apps/api/tsconfig.seed.json` ayri config:
    `rootDir=./prisma`, `outDir=./dist-seed`, `include=["prisma/**/*.ts"]`.
  - `apps/api/package.json` yeni scripts:
    - `"build": "nest build && pnpm run build:seed"` (build zincirine dahil).
    - `"build:seed": "tsc -p tsconfig.seed.json"`.
    - `"db:seed:prod": "node dist-seed/seed.js"` (runtime'da pnpm/ts-node
      gerekmiyor).
    - `"prisma:migrate:deploy": "prisma migrate deploy"`.
  - Windows lokalde `pnpm run build:seed` -> 8,842 byte `seed.js` uretildi.
  - Dockerfile runtime stage'e `apps/api/dist-seed`, `tsconfig.json`,
    `tsconfig.seed.json` kopyalandi.
  - `.gitignore`'a `dist-seed/` eklendi.
- [x] Adim 3: `scripts/bootstrap.sh` (idempotent cold-start):
  - `set -euo pipefail` + 6 asama: data layer healthy -> migrate deploy
    -> seed -> api -> healthz 200 -> nginx/web-admin -> observability.
  - `wait_healthy` helper (docker inspect Health.Status polling).
  - `/v1/healthz` icin 30x5sn retry loop (exit kodu != 0 fail-fast).
  - ENV override: `COMPOSE_FILE`, `ENV_FILE`, `HEALTH_URL`,
    `HEALTH_RETRIES`, `HEALTH_INTERVAL`.
- [x] Adim 4: `docker-compose.prod.yml` "tooling" profili:
  - `api-migrate` servisi `profiles: ["tooling"]` altinda tanimli.
  - `docker compose up` ile OTOMATIK ayaga kalkmaz.
  - Kullanim: `docker compose --profile tooling run --rm api-migrate
    npx prisma migrate deploy`.
  - `api` servisi 3000 port publish'i **gecici** olarak durdu
    (aciklama ile isaretli); Faz 7 Asama 1 Adim 7'de nginx arkasina.

### Asama 1 - Guvenlik ve Erisim (KISMI - TLS ertelendi, 2026-04-21)

> **Not:** Kullanici "tamamen test amacli, TLS-siz devam" diyerek
> Adim 5 (Domain) ve Adim 6 (TLS) ertelendi. Ileride gercek domain
> alindiginda: `NGINX_CONF=nginx.prod.conf` + certbot + DNS yeterli.

- [-] Adim 5: Domain + DNS - **ERTELENDI**
  - Kullanici domain alinca: `api.motogram.app`, `admin.motogram.app`
    A kayitlari VPS IP'sine.
- [-] Adim 6: TLS (Let's Encrypt / certbot) - **ERTELENDI**
  - `infra/nginx/nginx.prod.conf` (mevcut) TLS'li; dongerine geri
    donulecegi gun kullanilir.
- [x] Adim 7: `3000:3000` publish'ini kapat - **TAMAMLANDI (2026-04-21)**
  - `docker-compose.prod.yml` `api` servisinden `ports: 3000:3000`
    kaldirildi. API yalnizca `motogram` Docker network'u icinde.
  - Disari erisim **sadece nginx** (port 80) uzerinden.
  - `infra/nginx/nginx.http.conf` TLS-siz variant olusturuldu.
  - `NGINX_CONF` env var ile config secilir
    (varsayilan `nginx.prod.conf`, HTTP-only icin `nginx.http.conf`).
- [ ] Adim 8: Firewall (UFW) sertlestirme - **PENDING (VPS uzerinde manuel)**
  - RUNBOOK Bolum 12'de komutlar. Kullanici bu komutlari VPS'te
    calistiracak.
- [ ] Adim 9: Secrets yonetimi - **KISMEN (`.env.prod` 0600)**
  - `.env.prod` git'te yok (dogrulandi, `.gitignore` kapsiyor).
  - `chmod 600 /opt/motogram/.env.prod` uygulanacak (RUNBOOK 18).
  - Mevcut JWT/Redis/MinIO secrets 32+ byte (onceki adimlar).
- [ ] Adim 10: Sentry prod DSN (Spec 9.7) - **BACKLOG**
  - Kullanici Sentry hesabi olusturunca `.env.prod`'a eklenecek.

### Asama 2 - Veri ve Depolama Sertlestirme

- [ ] Adim 11: Postgres prod ayarlari
  - `shared_buffers`, `effective_cache_size`, `max_connections` tune.
  - `postgresql.conf` override'i `infra/postgres/postgresql.conf`.
- [ ] Adim 12: Postgres yedek stratejisi
  - Gunluk `pg_dump` -> MinIO `motogram-backups/` (ayri bucket).
  - 7 gun gunluk + 4 hafta haftalik rotation.
  - Restore drill prosedurü RUNBOOK'a eklenir.
- [ ] Adim 13: Redis prod ayarlari
  - `appendonly yes` (var), `maxmemory` ve `maxmemory-policy allkeys-lfu`.
  - RDB + AOF karma; `redis_data` volume'un gunluk snapshot'i.
- [ ] Adim 14: MinIO prod sertlestirme
  - Bucket private (Spec 3.4.3 var), versioning ve lifecycle rule.
  - Ayri `motogram-backups` bucket'i backup hedefi.

### Asama 3 - Gozlemlenebilirlik ve Uyari

- [ ] Adim 15: Prometheus + Grafana + Loki prod calistir
  - `docker-compose.prod.yml` icinde tanimli; Faz 7'de aktif et.
- [ ] Adim 16: Grafana provisioning (dashboards)
  - Spec 5.3 metriklerini iceren paneller:
    - GEORADIUS p95, WS active, BullMQ completed/failed, emergency rate.
- [ ] Adim 17: Alertmanager kurallari (Spec 8.10.3)
  - CPU>%80 5dk, 5xx>%5 2dk, Redis err>0 1dk, DLQ>100 10dk, SOS>10 1dk.
  - Hedef: Discord/Slack webhook veya email.
- [ ] Adim 18: Healthcheck'ler
  - API `/v1/healthz` (eklendi, 200 dogrulandi).
  - Postgres/Redis/MinIO healthcheck compose'ta mevcut; Nginx statuspage.

### Asama 4 - Deploy ve Surekli Teslimat

- [ ] Adim 19: CI sertlestir (Spec 8.11 + Faz 6'dan miras)
  - PR'da: `lint + typecheck + jest` (postgres/redis service).
  - Ek olarak `docker build --target runtime` smoke ve `npm audit`.
- [ ] Adim 20: CD
  - `v*.*.*` tag'inde: GHCR image push + staging `prisma migrate deploy`
    + smoke (`/v1/healthz` + login happy path).
  - Manual approval sonrasi prod deploy (blue/green ya da rolling).
- [ ] Adim 21: Staging ortami
  - `docker-compose.staging.yml`; ayri domain (`staging.motogram.app`).
  - Seed dataset: 20 demo user + 50 post + 5 party.
- [ ] Adim 22: Zero-downtime deployment
  - API 2+ replika (Spec 8.4 Redis Adapter zaten hazir).
  - Nginx sticky session (ip_hash) WS icin (Spec 8.4).

### Asama 5 - Mobil Production

- [ ] Adim 23: EAS build profilleri
  - `production` (store), `preview` (QA), `internal` (dev).
  - Mapbox `RNMapboxMapsDownloadToken` EAS Secret.
  - Not (2026-04-21): `@alnkemre/motogram` EAS project link tamamlandi;
    Android worker icin `pnpm` 10.20.0 pinlendi; `@rnmapbox/maps` config
    plugin'i package root yerine explicit `@rnmapbox/maps/app.plugin.js` yolu
    ile calistirildi. `preview` APK build tetiklendi, kalan blocker Mapbox
    token secret'idir.
- [ ] Adim 24: Push prod sertifikalari
  - FCM (service account JSON) + APNs (.p8) EAS Secret + secrets volume.
  - `FCM_CREDENTIALS_PATH`, `APNS_AUTH_KEY_PATH` prod degerleri.
- [ ] Adim 25: OTA kanallari
  - `production` ve `staging` kanallari; mobile build config runtime
    version pin.
- [ ] Adim 26: Auth OTP prod config (Spec 9.2)
  - Firebase prod proje + SMS quota + EULA store metni.

### Asama 6 - Uyum, Guvenlik Taramasi, DR

- [ ] Adim 27: KVKK/GDPR kontrol (Spec 5.2 + 7.2.1)
  - 30 gun hesap silme E2E test (login iptal dahil).
  - Data export endpoint (kullaniciya kendi verisi) - plan notu.
- [ ] Adim 28: Image ve bagimlilik taramasi
  - CI'a `trivy image`, `npm audit --production`, `docker scout`.
  - Kritik/high seviye aciklar build'i kirar.
- [ ] Adim 29: Rate limit / abuse prod kalibrasyonu
  - Spec 8.7.1 degerleri ile prod trafik loglari karsilastirilir.
- [ ] Adim 30: Disaster Recovery tatbikatı
  - "Postgres volume yok" senaryosu: backup'tan restore -> smoke.
  - "VPS komple ucar" senaryosu: yeni host + `bootstrap.sh` + restore.

---

## 4. OpenAPI Zod Contract Pipeline (API Contract SSOT) — **AKTIF (2026-04-23)**

> Amac: Backend controller surface'ini Zod semalariyla esleyip `docs/openapi.json` ve
> `docs/API_Contract.md` otomatik uretmek; CI'da drift'i `git diff --exit-code` ile kirmak.
> Kurallar: `packages/shared` runtime/Nest import etmez; `routes.json` src disinda dosya olur.

### Durum

- [x] Adim 1: NestJS reflektor (`DiscoveryService` ile route metadata) — **tamam**
- [x] Adim 2: Route manifest (`packages/shared/openapi/routes.json`) — **tamam**
- [ ] Adim 3: Saf `generateOpenApi()` (zod-to-openapi + $ref-only + passthrough) — **sirada**
- [ ] Adim 4: `docs/openapi.json` + `docs/API_Contract.md` yazma script'i — pending
- [ ] Adim 5: Swagger UI (dev/staging only) — pending
- [ ] Adim 6-8: Frontend tip/facade + turbo/CI drift kapisi — pending
- [ ] Adim 9-10: WS kapsam disi notu + contract test es-referansi — pending

### Adim 4 Tamamlandiginda Beklenen Artefaktlar

- `packages/shared/openapi/routes.json` (manifest, src disinda)
- `docs/openapi.json` (OpenAPI 3.1 contract)
- `docs/API_Contract.md` (auto-generated dokumantasyon)

## 3. Kapanis ve Uyum Kontrolu (Post-Flight Check) - SIHIRLI ADIM

> Asama bazli isaretleme: Asama N tamamlaninca sadece o asamanin bagli
> maddeleri `[x]` isaretlenir. Tum asamalar bitince overall green olur.

### Asama 0 Post-Flight (2026-04-21)

- [x] Spec 8.11.5 forward-only migration + ADR-028 uyumlu (baseline
      SQL + migration_lock.toml git'te).
- [x] `nest build` zincirine `build:seed` eklendi; runtime image'da
      pnpm/ts-node bagimliligi olmadan `node dist-seed/seed.js` calisabilir.
- [x] `scripts/bootstrap.sh` idempotent; `set -euo pipefail` ile hatada
      duruyor; `/v1/healthz` 200 bekleme var.
- [x] Compose `tooling` profili ile migrate servis one-shot'a ayrildi
      (Spec 8.11 runtime tooling ayrimini karsilar).
- [x] Yasakli kutuphane / `any` / hardcoded string girisi YOK (yeni dosyalarda
      grep temiz).
- [x] 160/160 api test yesil, `typecheck` temiz, lint temiz.

### Asama 1-6 Post-Flight (ilgili asamalar bitince doldurulacak)

- [ ] TLS yenileme cron'u aktif mi (certbot --dry-run pass)?
- [ ] UFW + SSH hardening aktif mi?
- [ ] Backup + restore drill en az 1 kez uygulandi mi?
- [ ] CI'da lint+typecheck+jest+trivy+audit green mi?
- [ ] Grafana panelleri + Alertmanager kurallari canli mi?
- [ ] EAS production build + OTA kanali aktif mi?
- [ ] DR tatbikatı raporu (RTO/RPO) RUNBOOK Bolum 14'e eklendi mi?

## 4. Test Raporu ve Sonuclar

### Asama 0 Test Raporu (2026-04-21)

```
pnpm --filter @motogram/api test
Test Suites: 20 passed, 20 total
Tests:       160 passed, 160 total
Time:        12.329 s

pnpm --filter @motogram/api typecheck
tsc --noEmit -p tsconfig.json  (exit 0)

pnpm --filter @motogram/api run build:seed
-> apps/api/dist-seed/seed.js (8,842 bytes) - OK
```

Baseline migration kontrol:
- `apps/api/prisma/migrations/20260421000000_init/migration.sql` 39,895 bytes.
- BOM kontrol: `first 3 bytes = 2D 2D 20` (= "-- ") - Postgres uyumlu.
- `prisma validate` (dummy DATABASE_URL ile) - `schema is valid`.
- `prisma migrate diff --from-empty --to-schema-datamodel` - exit 0.

### Asama 1-6 Test Raporu (bekleniyor)

- [ ] CI ek jobs: `trivy`, `npm-audit`, `docker-scout` hepsi PASS.
- [ ] Staging uzerinde 1 deploy cycle: `bootstrap.sh` -> smoke PASS.
- [ ] DR tatbikatı raporu: RTO/RPO degerleri RUNBOOK Bolum 14'e eklendi.
- [ ] EAS production build (android + ios) yesil.

## 5. Hafiza Kaydi (Kritik Son Adim)

Plan onaylandiginda ve ilgili adimlar bittiginde:
- [ ] `docs/PROJECT_BOARD.md` guncellenir (Faz 7 log girdisi + ADR'ler).
- [ ] `docs/RUNBOOK.md` guncellenir (TLS, backup, DR, CI, scan bolumleri).
- [ ] ADR-029..034 eklenir:
  - ADR-029: Forward-only Prisma migration + image rollback + PITR.
  - ADR-030: TLS + Nginx reverse proxy + rate limit zones.
  - ADR-031: Postgres/Redis/MinIO backup + retention.
  - ADR-032: Alertmanager + Grafana Spec 5.3 panelleri.
  - ADR-033: EAS prod build + OTA kanallari.
  - ADR-034: CI guvenlik taramasi (trivy + npm audit + docker scout).
