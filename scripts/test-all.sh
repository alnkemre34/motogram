#!/usr/bin/env bash
# Motogram backend — birim + contract + E2E (Postgres + Redis + MinIO).
# Kullanim (Git Bash / Linux / macOS): repo kokunden  bash scripts/test-all.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export DATABASE_URL="${DATABASE_URL:-postgresql://motogram:motogram_test_password@localhost:5432/motogram_test?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"
export NODE_ENV=test
export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-test_access_secret_minimum_32_chars_long_ok}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-test_refresh_secret_minimum_32_chars_long_ok}"
export SERVER_HOSTNAME="${SERVER_HOSTNAME:-api-test-local}"
export INTERNAL_API_SHARED_SECRET="${INTERNAL_API_SHARED_SECRET:-internal_shared_secret_minimum_32_chars_ok}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://localhost:3000}"
export MINIO_ENDPOINT="${MINIO_ENDPOINT:-localhost}"
export MINIO_PORT="${MINIO_PORT:-9000}"
export MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
export MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin}"
export MINIO_BUCKET="${MINIO_BUCKET:-motogram-media}"
export MINIO_USE_SSL="${MINIO_USE_SSL:-false}"

echo "==> Docker stack (docker-compose.test.yml)"
docker compose -f docker-compose.test.yml up -d

echo "==> Bekleniyor: Postgres hazir"
for _ in $(seq 1 40); do
  if docker compose -f docker-compose.test.yml exec -T postgres pg_isready -U motogram -d motogram_test >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> prisma migrate deploy (apps/api)"
( cd apps/api && pnpm exec prisma migrate deploy )

echo "==> prisma seed + test RBAC kullanicilari"
( cd apps/api && pnpm run db:seed )
( cd apps/api && pnpm run db:seed:test-users )

echo "==> @motogram/shared build"
pnpm --filter @motogram/shared build

echo "==> API unit tests"
pnpm --filter @motogram/api test

echo "==> API contract tests"
export CONTRACT_TESTS=1
pnpm --filter @motogram/api run test:contract

echo "==> API E2E"
unset CONTRACT_TESTS || true
export E2E_TESTS=1
pnpm --filter @motogram/api run test:e2e

echo ""
echo "✅ BACKEND KİLİTLENDİ — tum suite (unit + contract + E2E) gecti."
