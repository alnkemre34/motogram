# Motogram Operational Runbook

> Spec 8.10 + 8.11 - Production deployment, observability ve operasyonel
> prosedurler.
> **Faz 7 itibariyla** enterprise prod hardening (TLS, backup, DR, CI scan,
> EAS prod) ile genisletildi. Bkz. `docs/phases/phase-7.md`.

## 1. Deployment Sirasi (Cold Start)

Sirayi bozmak veri kaybina yol acabilir. Her adimdan sonra healthcheck bekle.
**Faz 7 Asama 0 Adim 3** ile tum adimlar `scripts/bootstrap.sh` icinde
idempotent toplandi.

```bash
# Tek komutla cold-start (tavsiye edilen yol - Faz 7 sonrasi):
./scripts/bootstrap.sh
# Yapar: network up -> postgres/redis/minio healthy bekle ->
#        prisma migrate deploy -> seed (node dist/prisma/seed.js) ->
#        api up -> /v1/healthz 200 bekle -> nginx + web-admin ->
#        prometheus + grafana + loki
```

Manuel (debug) sirasi:

```bash
# 1. Altyapi (veri katmanlari)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d postgres
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d redis
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d minio

# 2. Migration + Seed (Faz 7 Asama 0 Adim 2: seed artik derlenmis JS)
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  --profile tooling run --rm api-migrate \
  sh -c 'npx prisma migrate deploy --schema=prisma/schema.prisma \
         && node dist/prisma/seed.js'

# 3. Backend
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d api
# healthcheck: curl -fsS http://127.0.0.1:3000/v1/healthz

# 4. Reverse proxy ve admin
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d nginx web-admin

# 5. Observability
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d prometheus grafana loki
```

## 2. Rollback / Downgrade

Prisma forward-only migration stratejisi uygulanir (Spec 8.11.5). `down`
migrasyonu DESTEKLENMEZ. Geri donus stratejisi:
1. Onceki Docker image tag'ine geri don: `docker compose pull && docker compose up -d`
2. Veri kaybi riski varsa PITR snapshot (Postgres / S3 backup) kullanilir.

## 3. Feature Flag Yonetimi (Spec 8.11.1)

```bash
# Ornek: panelden yapilamiyorsa Redis CLI
redis-cli -a "$REDIS_PASSWORD" HSET feature_flag:new_feed_v2 strategy PERCENTAGE percentage 10
```

Admin panelinden: `/feature-flags` - key, strategy (OFF/ON/PERCENTAGE/USER_LIST),
percentage, userIds girerek kademeli rollout.

## 4. A/B Test Yonetimi (Spec 8.11.2)

Admin panelinden `/ab-tests` uzerinde variant tanimla. Weight toplami 100 olmali.
Kullanici atamasi deterministik (sha1(testKey + userId) % 100).

## 5. Observability

- Prometheus: `http://prometheus:9090` (dahili). Scrape: `api:3000/v1/metrics` her 15sn.
- Grafana: `http://grafana:3000` (default `admin/changeme`, ENV'den override).
- Loki: `http://loki:3100`. NestJS + nginx stdout JSON log.

Kritik uyari kurallari (Spec 8.10.3):
- CPU > %80 5dk
- 5xx oranı > %5 2dk
- Redis connection hata > 0 1dk
- DLQ > 100 (bullmq_jobs_failed_total) 10dk
- Aktif SOS > 10 1dk

## 6. Hesap Silme (Spec 7.2.1)

- Kullanici `DELETE /v1/users/me` cagirinca `AccountService.requestDeletion`
  tetiklenir. `User.deletedAt` set edilir, `AccountDeletion` kaydi yaratilir,
  BullMQ `DELETE_USER_DATA` kuyruguna 30 gun delayed job eklenir (jobId saklanir).
- 30 gun icinde tekrar login olursa `AUTH_LOGIN_EVENT` listener
  `AccountService.onAuthLogin` -> `cancelDeletionOnLogin` calisir; BullMQ job'i
  iptal edilir, `deletedAt` nullanir.
- 30 gun dolarsa worker `executeSingleDeletion` ile tum PII hard-delete eder.
- Safety net: `RetentionWorker` gunluk cron olarak kacak kayitlari temizler.

## 7. Admin RBAC

- `User.role` JWT payload icinde `role` alani olarak tasinir.
- `RolesGuard` sadece `@Roles(['ADMIN', 'MODERATOR'])` ile isaretli route'larda
  kontrol eder.
- Admin panel NextAuth `authorize()` icinde USER role'u reddeder.

## 8. Migration (Spec 8.11.5 + ADR-028/029)

**Strateji:** Forward-only. `down` migration YOK. Geri donus icin:
image tag rollback + Postgres PITR snapshot.

```bash
# 8.1 Lokal - yeni migration uret
pnpm --filter @motogram/api exec prisma migrate dev --name <anlamli_isim>
git add apps/api/prisma/migrations/
git commit -m "chore(db): migration <anlamli_isim>"
git push origin main

# 8.2 Staging
export DATABASE_URL=postgres://.../motogram_staging
./scripts/migrate-staging.sh

# 8.3 Production (manual approval)
export DATABASE_URL=postgres://.../motogram_prod
./scripts/migrate-staging.sh 2>&1 | tee migration-$(date +%s).log

# 8.4 Tek komut (Faz 7 Asama 0 Adim 4 - compose tooling profili)
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  --profile tooling run --rm api-migrate npx prisma migrate deploy
```

Baseline migration tek seferlik (Faz 7 Asama 0 Adim 1 - 2026-04-21):
Prod DB bos degilse (tablolar `prisma db push` ile yaratilmis) baseline
migration'i "uygulanmis" olarak isaretle. SQL tekrar calistirilMAZ.

```bash
cd /opt/motogram && git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod build api

# Baseline'i resolve et
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  --profile tooling run --rm api-migrate \
  npx prisma migrate resolve --applied 20260421000000_init \
    --schema=prisma/schema.prisma

# Durum kontrolu (Database schema is up to date! beklenir)
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  --profile tooling run --rm api-migrate \
  npx prisma migrate status --schema=prisma/schema.prisma

# Seed'i derlenmis JS ile calistir (idempotent, pnpm/ts-node yok)
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  --profile tooling run --rm api-migrate node dist-seed/seed.js

# api servisini yeni image ile restart
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d api
```

Bu adim tek seferlik; gelecekte yeni migration'lar normal sekilde
`prisma migrate deploy` ile uygulanir (ya da `scripts/bootstrap.sh`
icinden).

## 9. Gizli Ortam Degiskenleri (`.env.prod`)

```
POSTGRES_USER=motogram
POSTGRES_PASSWORD=<generated>
POSTGRES_DB=motogram
REDIS_PASSWORD=<generated>
MINIO_ROOT_USER=<generated>
MINIO_ROOT_PASSWORD=<generated>
MINIO_BUCKET=motogram-media
JWT_ACCESS_SECRET=<32-char-random>
JWT_REFRESH_SECRET=<32-char-random>
NEXTAUTH_SECRET=<32-char-random>
NEXTAUTH_URL=https://admin.motogram.app
NEXT_PUBLIC_API_BASE_URL=https://api.motogram.app/v1
MAPBOX_TOKEN=pk.<mapbox_token>
FCM_CREDENTIALS_PATH=/secrets/fcm.json
APNS_AUTH_KEY_PATH=/secrets/apns.p8
SENTRY_DSN=https://...@sentry.io/...
GRAFANA_USER=admin
GRAFANA_PASSWORD=<generated>
```

## 10. Acil Durum Prosedurleri

1. API 5xx spike: `kubectl rollout restart deploy/api` veya
   `docker compose restart api`. Sentry breadcrumb incele.
2. Redis baglanti kaybi: API CircuitBreaker aktiflesir; Redis kontaineri
   restart + `APPENDONLY yes` dogrula.
3. DLQ > 100: `/admin/audit-logs` -> queue failure nedenleri; Sharp/MinIO/FCM
   hatalarini oncelikle kontrol et.
4. Aktif SOS > 10: `/live-map` uzerinden yayilmasini izle; moderator ekibe
   bildir.

---

## 11. Reverse Proxy ve TLS (Faz 7 Asama 1 - ADR-030)

**Iki mod var:**
1. **HTTP-only** (`NGINX_CONF=nginx.http.conf`) - test/geliistirme
2. **HTTPS/TLS** (`NGINX_CONF=nginx.prod.conf` - varsayilan) - production

Hangi mod aktif olursa olsun **API port 3000 disariya kapali**. Tum
trafik nginx (port 80 ve/veya 443) uzerinden gelir.

### 11.1 HTTP-Only Mode (Faz 7 Asama 1, TLS ertelendigi durum)

VPS'te test amacli, domain/TLS olmadan:

```bash
cd /opt/motogram

# 1. .env.prod icine ekle (varsa ustune yaz)
echo 'NGINX_CONF=nginx.http.conf' | sudo tee -a .env.prod
# Admin paneli icin NEXTAUTH_URL'i IP ile ayarla (https -> http!)
sudo sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL=http://85.235.74.203|' .env.prod
sudo sed -i 's|NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=http://85.235.74.203/v1|' .env.prod
sudo chmod 600 .env.prod

# 2. En son kodu cek ve yeniden kur
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod build api web-admin

# 3. API'yi yeniden baslat (port 3000 publish kalkacak)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d api

# 4. Nginx + web-admin'i baslat
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d nginx web-admin

# 5. Disaridan test (port yok, 80 default)
curl -i http://85.235.74.203/v1/healthz
curl -i http://85.235.74.203/         # admin panel
```

Mobil uygulama config:
- `EXPO_PUBLIC_API_URL=http://85.235.74.203` (port yok)
- `EXPO_PUBLIC_WS_URL=http://85.235.74.203` (socket.io ayni port)

### 11.2 HTTPS/TLS Mode (production gerekli oldugunda)

```bash
# 11.2.1 Certbot ile ilk sertifika (DNS dogrulandiktan sonra)
sudo apt install -y certbot
sudo certbot certonly --standalone \
  -d api.motogram.app -d admin.motogram.app \
  --email ops@motogram.app --agree-tos --non-interactive

# Sertifikalari compose'un gordugu klasore kopyala:
sudo mkdir -p /opt/motogram/infra/nginx/certs/{api,admin}
sudo cp /etc/letsencrypt/live/api.motogram.app/fullchain.pem \
        /opt/motogram/infra/nginx/certs/api/fullchain.pem
sudo cp /etc/letsencrypt/live/api.motogram.app/privkey.pem \
        /opt/motogram/infra/nginx/certs/api/privkey.pem
# admin.motogram.app icin ayni islemi tekrarla.

# 11.2.2 HTTPS moduna gec
sudo sed -i 's|^NGINX_CONF=.*|NGINX_CONF=nginx.prod.conf|' /opt/motogram/.env.prod
sudo sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL=https://admin.motogram.app|' /opt/motogram/.env.prod
sudo sed -i 's|NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=https://api.motogram.app/v1|' /opt/motogram/.env.prod

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d nginx web-admin

# 11.2.3 Yenileme cron (90 gun - ayin 1'inde 03:00 UTC)
sudo crontab -e
# 0 3 1 * * certbot renew --quiet --deploy-hook \
#   "docker compose -f /opt/motogram/docker-compose.prod.yml exec -T nginx nginx -s reload"

# 11.2.4 Dry-run yenileme testi
sudo certbot renew --dry-run
```

### 11.3 Mod Gecisleri (toggle)

`.env.prod` icindeki `NGINX_CONF` degiskenini degistir, `docker compose up
-d nginx` tekrar calistir. Container yeniden olusturulur, yeni config
yuklenir.

---

## 12. Firewall ve SSH Sertlestirme (Faz 7 Asama 1 Adim 8)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose

# /etc/ssh/sshd_config:
# PermitRootLogin no
# PasswordAuthentication no
# PubkeyAuthentication yes
sudo systemctl restart ssh
```

---

## 13. Backup ve Restore (Faz 7 Asama 2 - ADR-031)

**Hedefler:** RPO <= 24 saat, RTO <= 1 saat.

### 13.1 Postgres (gunluk `pg_dump`)

```bash
# /opt/motogram/scripts/backup-postgres.sh
#!/usr/bin/env bash
set -euo pipefail
TS=$(date -u +%Y%m%dT%H%M%SZ)
docker compose -f /opt/motogram/docker-compose.prod.yml \
  --env-file /opt/motogram/.env.prod exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > /tmp/pg-$TS.dump
mc alias set motogram http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc cp /tmp/pg-$TS.dump motogram/motogram-backups/postgres/
rm /tmp/pg-$TS.dump
# Retention: 7 gun gunluk + 4 hafta haftalik
```

Cron: `0 2 * * * /opt/motogram/scripts/backup-postgres.sh`

### 13.2 Redis

- `appendonly yes` + haftalik `redis-cli BGSAVE` -> `dump.rdb` MinIO'ya.
- Kritik kayit yok (feature flag + refresh token vb.); kritik veri zaten
  Postgres'te.

### 13.3 MinIO

- `motogram-media` bucket: versioning `ON`, 30 gunluk noncurrent cleanup.
- `motogram-backups` bucket: **ayri bucket** + lifecycle `30d -> Glacier`
  benzeri tier (self-host icin opsiyonel).

### 13.4 Restore (drill)

```bash
# Postgres restore
mc cp motogram/motogram-backups/postgres/pg-<TS>.dump /tmp/
docker compose exec -T postgres createdb -U $POSTGRES_USER motogram_restore
docker compose exec -T postgres pg_restore -U $POSTGRES_USER \
  -d motogram_restore /tmp/pg-<TS>.dump

# Smoke: `SELECT count(*) FROM "User";`
```

### 13.5 pgBackRest sidecar + WAL (R11 — repo dosyalari)

Tam PITR için Postgres’te **WAL arşivi** (`archive_mode`, `archive_command`) ve pgBackRest
**repo** (POSIX volume veya S3 uyumlu depo) birlikte kullanılır. Bu repoda:

| Dosya | Açıklama |
|---|---|
| `infra/pgbackrest/Dockerfile` | Debian + `pgbackrest` paketi; `sleep infinity` ile CLI exec. |
| `infra/pgbackrest/pgbackrest.docker.conf` | Compose içi POSIX repo (`/var/lib/pgbackrest/repo`). |
| `infra/pgbackrest/pgbackrest.conf.example` | MinIO/S3 repo yorum satırları ile üretim şablonu. |
| `docker-compose.prod.yml` → `pgbackrest` | **`profiles: [backup]`** — ana stackten ayrı; volume’lar `postgres_data` (ro), `pgbackrest_repo`. |
| `scripts/pgbackrest-exec.sh` | `docker compose … --profile backup exec … pgbackrest …` |

**Ön koşullar**

1. `.env.prod` (veya compose’un okuduğu env) içinde `POSTGRES_PASSWORD` tanımlı — `PGPASSWORD`
   pgbackrest konteynerine aktarılır.
2. **İlk stanza:** konteyner ayakta iken:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod --profile backup up -d pgbackrest
   ./scripts/pgbackrest-exec.sh --stanza=motogram stanza-create
   ```

3. **Tam yedek:**

   ```bash
   ./scripts/pgbackrest-exec.sh --stanza=motogram backup
   ```

4. **PITR / sürekli yedek:** Postgres `postgresql.conf` içinde `archive_mode = on` ve
   `archive_command` pgBackRest’e uygun şekilde ayarlanır (motogram kullanıcısı ile test;
   gerçek üretimde replication kullanıcısı önerilir). Bu adım görüntü tabanı imajından
   bağımsızdır; VPS’te `postgresql.auto.conf` veya init script ile yapılır.

**Restore drill (çeyreklik checklist)**

1. Yeni VM veya staging’de repo volume / S3’ten repo erişimi sağlı.
2. pgBackRest `restore` ile hedef Postgres veri dizinini doldur veya §13.4 `pg_restore` ile
   günlük dump doğrula (en az biri).
3. API stack’i kaldır: `curl -fsS http(s)://<host>/v1/readyz` → **HTTP 200** gövdesi `ok:true`.
4. Spot check: `SELECT count(*) FROM "User";` veya kritik iş tablosu beklenen sıra ile uyumlu.

---


## 14. Disaster Recovery Tatbikatı (Faz 7 Asama 6 Adim 30)

**Ceyreklik** (3 ayda bir) asagidaki tatbikat uygulanir, RTO/RPO olculur:

| Senaryo | Beklenen RTO | Beklenen RPO |
|---|---|---|
| Postgres volume kaybi | < 60 dk | <= 24 saat |
| Redis volume kaybi | < 15 dk | 0 (Postgres rebuild) |
| MinIO bucket kaybi | < 90 dk | <= 24 saat (versioning) |
| VPS komple kaybi | < 120 dk | <= 24 saat |

VPS komple kaybi playbook:
1. Yeni VPS provizyon, UFW + SSH hardening (Bolum 12).
2. `git clone` repo, `.env.prod` secure kanaldan tasinir (secrets manager).
3. `scripts/bootstrap.sh` calistirilir.
4. En son Postgres dump MinIO'dan cekilir ve Bolum 13.4 ile restore.
5. Mapbox/FCM/APNs secrets ayni noktadan geri yuklenir.
6. DNS TTL 300sn'den 5dk'ya alinmistir; A kaydi yeni IP'ye guncellenir.

---

## 15. CI/CD ve Guvenlik Taramasi (Faz 7 Asama 4 + 6 - ADR-034)

**Pull Request:**
- `lint` + `typecheck` + `jest` (postgres + redis service container).
- `trivy image ghcr.io/<org>/motogram-api:pr-<sha>` - HIGH/CRITICAL fail.
- `pnpm audit --prod` - HIGH/CRITICAL fail.

**Tag (`v*.*.*`):**
- GHCR build + push + sign (docker scout cve).
- Staging deploy -> `scripts/bootstrap.sh` -> smoke (`/v1/healthz` + login
  happy path + 1 post create/list).
- Manual approval -> Production deploy (rolling, 2+ api replika).
  Nginx `ip_hash` ile WS sticky session (Spec 8.4).

---

## 16. Staging Ortami (Faz 7 Asama 4 Adim 21)

- `docker-compose.staging.yml` (ayri network + ayri volume prefix).
- Domain: `staging.api.motogram.app`, `staging.admin.motogram.app`.
- Seed: 20 demo user + 50 post + 5 party (prod-like PII-free).
- Tum yeni migration'lar staging'e once uygulanir (Bolum 8.2).

---

## 17. EAS Mobil Prod Build (Faz 7 Asama 5 - ADR-033)

> **Not (2026-04-24+)**: Mobil istemci hedefi **`apps/mobile-native` (React Native CLI, Expo/EAS yok)**.
> Bu bölümdeki `apps/mobile` + EAS adımları **legacy** kabul edilir.

```bash
cd apps/mobile

# 17.1 Sertifika ve secrets
eas secret:create --name MAPBOX_DOWNLOAD_TOKEN --value "$MAPBOX_DL"
eas secret:create --name FCM_SERVICE_ACCOUNT --type file --value ./fcm.json
eas secret:create --name APNS_KEY_P8 --type file --value ./AuthKey_XXXX.p8

# 17.2 Profiles (eas.json): internal / preview / production
eas build --profile production --platform android
eas build --profile production --platform ios

# 17.3 Store submit
eas submit --profile production --platform android
eas submit --profile production --platform ios

# 17.4 OTA update (JS-only)
eas update --branch production --message "v1.1.1 fix"
```

Runtime version (mobile `app.config.ts`) store build'i ile pinlenir;
OTA ayni runtime icinde yayinlanir.

---

## 18. Secrets ve Env Yonetimi (Faz 7 Asama 1 Adim 9)

- `.env.prod` git'te **yok** (verify: `git ls-files | grep .env.prod`).
- Dosya izni: `chmod 600 /opt/motogram/.env.prod`.
- Secret uretimi: `openssl rand -hex 32` (32 byte = 64 hex char).
- Sentry DSN + FCM + APNs + Mapbox token: EAS Secret + VPS'te 0600
  dosyalar; log'a yazilmaz (NestJS Logger redaction kural seti).
- Rotation: 90 gunde bir JWT secrets rotasyonu; refresh token'lar
  invalide olur (kullanicilar tekrar login).
