#!/usr/bin/env bash
set -euo pipefail
# Faz 12 — idempotent DB bootstrap hints (run on host with DATABASE_URL → Postgres direct)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/apps/api"
: "${DATABASE_URL:?Set DATABASE_URL to Postgres (not PgBouncer) for migrations}"
pnpm exec prisma migrate deploy
echo "[bootstrap-prod-db] migrate deploy complete."
