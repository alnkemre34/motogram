#!/usr/bin/env bash
set -euo pipefail
# Faz 12 — non-interactive deploy: build api → prisma migrate (api-migrate) → stack up
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-$ROOT/.env.prod}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[deploy] ERROR: env file not found: $ENV_FILE"
  echo "[deploy] Create it: cp .env.prod.example .env.prod && nano .env.prod (see docs/DEPLOY_QUICKSTART.md)."
  exit 1
fi

# Trim assignment RHS (Compose interpolation reads this file; empty = runtime disaster).
strip_env_val() {
  local val="$1"
  val="${val%$'\r'}"
  val="${val#"${val%%[![:space:]]*}"}"
  val="${val%"${val##*[![:space:]]}"}"
  if [[ ${#val} -ge 2 && ${val:0:1} == '"' && ${val: -1} == '"' ]]; then val="${val:1:-1}"; fi
  if [[ ${#val} -ge 2 && ${val:0:1} == "'" && ${val: -1} == "'" ]]; then val="${val:1:-1}"; fi
  printf '%s' "$val"
}

read_env_val() {
  local key="$1" line out
  line="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" 2>/dev/null | tail -n1)" || true
  [[ -n "$line" ]] || return 1
  out="$(strip_env_val "${line#*=}")"
  printf '%s' "$out"
}

require_env_nonempty() {
  local key="$1" min_len="${2:-1}" val
  val="$(read_env_val "$key")" || {
    echo "[deploy] ERROR: $ENV_FILE missing key: $key"
    return 1
  }
  [[ -n "$val" ]] || {
    echo "[deploy] ERROR: $ENV_FILE has empty value: $key"
    return 1
  }
  if [[ ${#val} -lt "$min_len" ]]; then
    echo "[deploy] ERROR: $key must be at least ${min_len} characters (got ${#val})."
    return 1
  fi
}

echo "[deploy] preflight: required keys in $ENV_FILE ..."
require_env_nonempty POSTGRES_PASSWORD 8
require_env_nonempty REDIS_PASSWORD 8
require_env_nonempty MINIO_ROOT_USER 3
require_env_nonempty MINIO_ROOT_PASSWORD 8
require_env_nonempty JWT_ACCESS_SECRET 32
require_env_nonempty JWT_REFRESH_SECRET 32
require_env_nonempty INTERNAL_API_SHARED_SECRET 32
require_env_nonempty NEXTAUTH_SECRET 16
echo "[deploy] preflight OK."

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
