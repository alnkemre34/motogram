#!/usr/bin/env bash
set -euo pipefail
# Faz 12 — Host üzerinde migrate (DATABASE_URL → doğrudan Postgres, PgBouncer değil).
# Docker prod kullanıyorsan: scripts/deploy.sh bunu api-migrate ile otomatik yapar;
# bkz. docs/DEPLOY_QUICKSTART.md
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/apps/api"
: "${DATABASE_URL:?Set DATABASE_URL to Postgres (not PgBouncer) for migrations}"
pnpm exec prisma migrate deploy
echo "[bootstrap-prod-db] migrate deploy complete."
