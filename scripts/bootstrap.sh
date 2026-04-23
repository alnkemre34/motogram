#!/usr/bin/env bash
# Motogram Cold-Start Bootstrap (Faz 7 Asama 0 Adim 3)
#
# Idempotent prod bootstrap:
#   1. postgres + redis + minio servislerini baslat ve healthy bekle
#   2. prisma migrate deploy (forward-only, Spec 8.11.5)
#   3. node dist-seed/seed.js (notification templates + badges + quests)
#   4. api servisini baslat ve /v1/healthz 200 bekle
#   5. nginx + web-admin
#   6. prometheus + grafana + loki (observability stack)
#
# Kullanim:
#   cd /opt/motogram
#   ./scripts/bootstrap.sh
#
# Environment:
#   COMPOSE_FILE (default: docker-compose.prod.yml)
#   ENV_FILE     (default: .env.prod)
#   HEALTH_URL   (default: http://127.0.0.1:3000/v1/healthz)
#   HEALTH_RETRIES (default: 30)
#   HEALTH_INTERVAL (default: 5 - saniye)

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/v1/healthz}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"

# Script konumundan repo koku
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

log() {
  printf '[%s] [bootstrap] %s\n' "$(date -u +%FT%TZ)" "$*"
}

fail() {
  log "FATAL: $*"
  exit 1
}

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

wait_healthy() {
  local service="$1"
  local tries=${2:-60}
  local interval=${3:-5}
  log "waiting for '$service' to be healthy (max ${tries}x${interval}s)..."
  for i in $(seq 1 "$tries"); do
    local status
    status="$(docker inspect --format='{{.State.Health.Status}}' \
      "$(compose ps -q "$service")" 2>/dev/null || echo "no-container")"
    if [ "$status" = "healthy" ]; then
      log "  -> '$service' healthy (${i}. deneme)"
      return 0
    fi
    sleep "$interval"
  done
  fail "'$service' HEALTHY olmadi (son durum: $status)"
}

require_files() {
  [ -f "$COMPOSE_FILE" ] || fail "$COMPOSE_FILE bulunamadi"
  [ -f "$ENV_FILE" ] || fail "$ENV_FILE bulunamadi (env dosyasi 0600 izinle hazir olmali)"
}

############################################
# 0. On-kontrol
############################################
log "repo root: $REPO_ROOT"
log "compose:   $COMPOSE_FILE"
log "env file:  $ENV_FILE"
require_files

############################################
# 1. Veri katmani (postgres + redis + minio)
############################################
log "Adim 1/6: veri katmanini baslat"
compose up -d postgres redis minio
wait_healthy postgres 60 5
wait_healthy redis 30 3
wait_healthy minio 30 5

############################################
# 2. Migration (prisma migrate deploy)
############################################
log "Adim 2/6: prisma migrate deploy (forward-only, Spec 8.11.5)"
# api servisinin imaji migrate icin kullanilir.
# Image yoksa build'le; var ama guncel degilse --build ile yeniden kur.
compose build api
# Not: api servisinin DATABASE_URL'i varsayilan olarak PgBouncer'a (pgbouncer:6432) bakar.
# Bootstrap sirasinda migrasyon/seed adimlarini dogrudan Postgres'e karsi kosariz
# (Spec 8.11.5 + RUNBOOK: ilk cutover'da PgBouncer devre disi olabilir).
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile tooling run --rm --no-deps \
  --entrypoint "" \
  api-migrate \
  npx prisma migrate deploy --schema=prisma/schema.prisma

############################################
# 3. Seed (notification templates + badges + quests)
############################################
log "Adim 3/6: db seed (node dist-seed/seed.js)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile tooling run --rm --no-deps \
  --entrypoint "" \
  api-migrate \
  node dist-seed/seed.js

############################################
# 4. API
############################################
log "Adim 4/6: api servisini baslat"
compose up -d api

log "  -> /v1/healthz 200 bekleniyor (${HEALTH_RETRIES}x${HEALTH_INTERVAL}s)..."
ok=0
for i in $(seq 1 "$HEALTH_RETRIES"); do
  code="$(curl -o /dev/null -s -w '%{http_code}' "$HEALTH_URL" || echo '000')"
  if [ "$code" = "200" ]; then
    log "  -> api healthy (${i}. deneme, http ${code})"
    ok=1
    break
  fi
  sleep "$HEALTH_INTERVAL"
done
[ "$ok" = "1" ] || fail "api /v1/healthz 200 donmedi (son kod: $code)"

############################################
# 5. Reverse proxy + admin panel
############################################
log "Adim 5/6: nginx + web-admin"
compose up -d nginx web-admin

############################################
# 6. Observability stack
############################################
log "Adim 6/6: prometheus + grafana + loki"
compose up -d prometheus grafana loki

log "BOOTSTRAP TAMAMLANDI"
log "  api:        $HEALTH_URL"
log "  admin:      https://admin.motogram.app"
log "  grafana:    http://<host>:3000 (GF_SECURITY_ADMIN_USER)"
