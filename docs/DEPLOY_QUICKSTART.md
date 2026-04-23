# Production deploy — hızlı rehber

Bu dosya `docker-compose.prod.yml` + `scripts/deploy.sh` ile **sorunsuz tek hat** deploy içindir. Ayrıntı: [DEPLOY_RUNBOOK.md](./DEPLOY_RUNBOOK.md).

## `DATABASE_URL` kim üretir?

| Ortam | Kim / nasıl |
|--------|-------------|
| **Docker Compose prod (`api` konteyneri)** | **Sen yazmazsın.** `docker-compose.prod.yml` içinde `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` ile otomatik oluşturulur (host: `postgres`, port `5432`, doğrudan Postgres). |
| **Host’tan `scripts/bootstrap-prod-db.sh`** | **Sen export edersin.** Script `DATABASE_URL` zorunlu tutar; genelde doğrudan Postgres URL’i (PgBouncer değil). |
| **Tek seferlik migrate konteyneri (`api-migrate`)** | **Sen yazmazsın.** Compose, `api` ile aynı `DATABASE_URL`’ü verir; `deploy.sh` bunu çalıştırır. |

Özet: `.env.prod` içinde **`POSTGRES_PASSWORD`** (ve isteğe bağlı `POSTGRES_USER` / `POSTGRES_DB`) yeterlidir; API için **`DATABASE_URL` satırı eklemen gerekmez** (Compose halleder).

## Sunucuda ilk / tekrar deploy (önerilen)

1. Repoyu klonla veya güncelle: `git pull origin main`
2. Kök dizinde `.env.prod` oluştur: kök `.env.example` ile karşılaştır; en azından compose üst yorumundaki sırlar + `INTERNAL_API_SHARED_SECRET`, JWT sırları, `REDIS_PASSWORD`, MinIO, `CORS_ALLOWED_ORIGINS` vb.
3. **OAuth (isteğe bağlı):** `APPLE_CLIENT_ID`, `GOOGLE_CLIENT_IDS` — boş bırakılırsa OAuth uçları 503 döner (bilinçli).
4. Çalıştır:

```bash
chmod 600 .env.prod
export ENV_FILE="$PWD/.env.prod"   # isteğe bağlı; varsayılan zaten .env.prod
SKIP_SLO_CHECK=1 bash scripts/deploy.sh   # Prometheus yoksa SLO adımını atla
```

`deploy.sh` sırası: **API imajını build** → **`api-migrate` ile `prisma migrate deploy`** → **stack `up -d`** → **içeriden `livez` smoke**.

5. Dışarıdan: `curl -fsS https://<host>/v1/livez` ve `.../v1/readyz`

## Deploy sonrası — “her şey olması gerektiği gibi” mi?

Tek script (repo kökü, sunucuda):

```bash
cd /opt/motogram
bash scripts/verify-vps-health.sh
```

Dış dünyadan API host ile doğrulamak için:

```bash
VERIFY_BASE_URL=https://api.senin-domainin.app bash scripts/verify-vps-health.sh
```

Script şunları kontrol eder:

- `docker compose ps` çıktısı (genel tablo)
- **`/v1/livez`** ve **`/v1/readyz`** — nginx üzerinden (`VERIFY_BASE_URL`, varsayılan `http://127.0.0.1`)
- **API içinden** `http://127.0.0.1:3000/v1/readyz` (nginx’i bypass; Prisma + Redis ping)
- **`/v1/metrics`** ilk satırlar (nginx engelliyse uyarı, kritik blokaj değil)
- **Kritik konteynerler** `running`: `postgres`, `redis`, `minio`, `api`, `nginx`

Manuel ek kontroller (isteğe bağlı):

- `docker compose ... logs api --tail 100` — boot sırasında env / Prisma hatası yok mu
- Public domain üzerinden bir kez `POST /v1/auth/register` veya mevcut mobil/web akışı

## Sadece migration (stack zaten ayakta)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod build api
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile tooling run --rm api-migrate
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d api
```

## Sorun giderme

- **Migrate hata veriyor:** Postgres ayakta mı, `POSTGRES_PASSWORD` `.env.prod` ile aynı mı, volume ilk kurulumda mı?
- **OAuth 503:** `.env.prod` içine `APPLE_CLIENT_ID` / `GOOGLE_CLIENT_IDS` ekleyip API konteynerini yeniden başlat.
- Tam operasyon listesi: [DEPLOY_RUNBOOK.md](./DEPLOY_RUNBOOK.md).
