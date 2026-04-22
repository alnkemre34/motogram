#!/usr/bin/env bash
# Motogram Staging Migration - Spec 8.11.5
# Safe prisma migrate deploy + post-deploy smoke check.
# DATABASE_URL environment variable zorunludur.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL zorunludur}"
: "${MIGRATION_LOG:=migration.log}"

echo "[migrate-staging] $(date -u +%FT%TZ) basladi" | tee -a "$MIGRATION_LOG"

pushd "$(dirname "$0")/../apps/api" >/dev/null

echo "[migrate-staging] prisma migrate status" | tee -a "$MIGRATION_LOG"
npx --yes prisma migrate status 2>&1 | tee -a "$MIGRATION_LOG" || true

echo "[migrate-staging] prisma migrate deploy (forward-only, Spec 8.11.5)" | tee -a "$MIGRATION_LOG"
npx --yes prisma migrate deploy 2>&1 | tee -a "$MIGRATION_LOG"

echo "[migrate-staging] prisma generate" | tee -a "$MIGRATION_LOG"
npx --yes prisma generate 2>&1 | tee -a "$MIGRATION_LOG"

echo "[migrate-staging] smoke check: selecting User count..." | tee -a "$MIGRATION_LOG"
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count().then((n) => { console.log('user_count=' + n); process.exit(0); })
 .catch((e) => { console.error(e); process.exit(1); });
" 2>&1 | tee -a "$MIGRATION_LOG"

popd >/dev/null

echo "[migrate-staging] $(date -u +%FT%TZ) tamamlandi" | tee -a "$MIGRATION_LOG"
