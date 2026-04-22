# Motogram — Production deploy runbook

Bu doküman tam entegrasyon planı (Zod roadmap + production backend formülü) ile uyumludur. Staging yoksa her prod deploy sonrası **24 saat metrik bake** zorunludur.

## Ön deploy kontrol listesi

1. `diff .env.example .env.prod` — eksik anahtar yok.
2. VPS’te `.env.prod` için `chmod 600 .env.prod` ve owner `motogram` (root dışı).
3. `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `INTERNAL_API_SHARED_SECRET` ≥ 32 karakter.
4. BullMQ DLQ boş: `redis-cli LLEN bull:location-dead-letter:wait` (veya ilgili kuyruk).
5. Sentry release sekmesi açık; Grafana Prometheus erişilebilir.
6. **PgBouncer:** `docker-compose.prod.yml` içinde API `DATABASE_URL` varsayılan olarak
   `pgbouncer:6432` kullanır. İlk cutover önce `scripts/bootstrap-prod-db.sh` ile migrasyonu
   **doğrudan Postgres** portuna karşı çalıştırın; sonra API’yi PgBouncer URL ile ayağa kaldırın.

## Deploy sırası

1. `scripts/deploy.sh` veya manuel: `git pull`, `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build api`
2. Smoke: `curl -fsS https://<host>/v1/livez` → 200
3. Readiness: `curl -fsS https://<host>/v1/readyz` → 200 (DB + Redis)
4. Metrikler: `curl -fsS https://<host>/v1/metrics | head`
5. `scripts/check-slo.sh` (Prometheus URL ve eşikler `.env` veya argümanla)

## Rollback

- `docker compose ... up -d` önceki image tag ile.
- Veya `git revert <commit>` + yeniden build.

## 24 saat bake (staging yok)

Sonraki faza geçmeden önce şu metriklerde **anomali yok**:

- `zod_response_mismatch_total`
- `zod_inbound_validation_errors_total`
- `bullmq_dlq_size`
- HTTP 5xx oranı

## R12 — Zod strict kapanış (72 saat bake → üç katmanı aç)

Roadmap **R12**: uyarı-modundan (`warn-only`) üretimde **sıkı doğrulamaya** geçiş; tamamen **operasyonel**
bir karardır — bu bölüm **ne zaman** ve **nasıl** yapılacağını sabitler. Kod zaten bayrakları destekler:
API `ZOD_RESPONSE_STRICT`, mobil `extra.strictSchema`, web-admin `NEXT_PUBLIC_STRICT_SCHEMA`.

### Ön koşullar (hepsi evet olmadan strict açılmaz)

1. **R1–R11** kod/yol haritası kapıları üretimde yeşil (contract, SLO script, pgBackRest kalıpları vb.).
2. Prometheus / Grafana’da **ardışık 72 saat** boyunca §19.4 metrikleri **sıfır anomali**
   (`zod_response_mismatch`, inbound validation, DLQ, 5xx oranı hedef dışı değil).
3. Son deploy sonrası **en az bir tam iş günü** smoke (kritik kullanıcı akışları) sorunsuz.

### Sıra (önerilen — aynı bakım penceresinde)

| Katman | Ne yapılır | Not |
|---|---|---|
| **API** | `.env.prod` içinde `ZOD_RESPONSE_STRICT=true` | `docker compose … up -d --build api`; `ZodSerializerInterceptor` şema sapmasında hata döner. |
| **Web-admin** | Build ortamında `NEXT_PUBLIC_STRICT_SCHEMA=true` | **Build-time** env; image yeniden üretilir, admin yeniden deploy. |
| **Mobil** | `apps/mobile/app.json` → `expo.extra.strictSchema: true` | Yeni **native build** veya EAS profili; JS-only için `extra` değişmez — OTA ile `strictSchema` güvenilir şekilde taşınmaz, native derleme önerilir. |

### Strict açıldıktan sonra (24 saat sıkı izleme)

1. `zod_response_mismatch_total` ve `zod_inbound_validation_errors_total` — artış **0**.
2. Sentry’de API yanıt parse / validation hatalarında spike yok.
3. Sorun çıkarsa: önce **API bayrağını** `false` yapıp yeniden deploy (en hızlı geri alma), ardından kök neden.

### Geri alma

- API: `ZOD_RESPONSE_STRICT=false` + API container yeniden başlat.
- Web-admin: önceki image veya `NEXT_PUBLIC_STRICT_SCHEMA=false` ile yeniden build.
- Mobil: önceki `strictSchema` + store/OTA politikasına göre sürüm.

## İlgili dosyalar

- [docker-compose.prod.yml](../docker-compose.prod.yml)
- [scripts/deploy.sh](../scripts/deploy.sh)
- [scripts/check-slo.sh](../scripts/check-slo.sh)
- [docs/RUNBOOK.md](./RUNBOOK.md) — operasyonel olaylar ve restore
- [docs/ZOD_FULL_INTEGRATION_ROADMAP.md](./ZOD_FULL_INTEGRATION_ROADMAP.md) — **§18** kod/altyapı uygulama kaydı (Zod + entegrasyon özeti), **§19.4** metrik kapıları
- `apps/api` — `env.schema.ts` → `ZOD_RESPONSE_STRICT`
- `apps/mobile/app.json` → `expo.extra.strictSchema`
- `apps/web-admin` — `NEXT_PUBLIC_STRICT_SCHEMA` (`.env.example`)
