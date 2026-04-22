#!/usr/bin/env bash
set -euo pipefail
# Faz 12 — non-interactive deploy (extend with registry push / Sentry as needed)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
echo "[deploy] building api image..."
docker compose -f docker-compose.prod.yml build api
echo "[deploy] DB migrations: run scripts/bootstrap-prod-db.sh against Postgres (direct) before traffic cutover."
echo "[deploy] up stack..."
docker compose -f docker-compose.prod.yml up -d
echo "[deploy] smoke livez..."
docker compose -f docker-compose.prod.yml exec -T api \
  node -e "fetch('http://127.0.0.1:3000/v1/livez').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
if [[ "${SKIP_SLO_CHECK:-0}" != "1" ]]; then
  echo "[deploy] Prometheus SLO (scripts/check-slo.sh) ..."
  "$ROOT/scripts/check-slo.sh"
else
  echo "[deploy] SKIP_SLO_CHECK=1 — SLO kontrolü atlandı (Prometheus yok ortam)."
fi
echo "[deploy] done."
