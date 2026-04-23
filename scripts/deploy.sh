#!/usr/bin/env bash
set -euo pipefail
# Faz 12 — non-interactive deploy: build api → prisma migrate (api-migrate) → stack up
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-$ROOT/.env.prod}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[deploy] ERROR: env file not found: $ENV_FILE"
  echo "[deploy] Create it from repo root .env.example (see docs/DEPLOY_QUICKSTART.md)."
  exit 1
fi

DC=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

echo "[deploy] using env file: $ENV_FILE"
echo "[deploy] building api image..."
"${DC[@]}" build api

echo "[deploy] prisma migrate deploy (api-migrate profile → Postgres direct, same DATABASE_URL as api)..."
"${DC[@]}" --profile tooling run --rm api-migrate

echo "[deploy] up stack..."
"${DC[@]}" up -d

echo "[deploy] smoke livez..."
"${DC[@]}" exec -T api \
  node -e "fetch('http://127.0.0.1:3000/v1/livez').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
if [[ "${SKIP_SLO_CHECK:-0}" != "1" ]]; then
  echo "[deploy] Prometheus SLO (scripts/check-slo.sh) ..."
  "$ROOT/scripts/check-slo.sh"
else
  echo "[deploy] SKIP_SLO_CHECK=1 — SLO kontrolü atlandı (Prometheus yok ortam)."
fi
echo "[deploy] done."
