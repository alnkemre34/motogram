#!/usr/bin/env bash
# VPS / prod stack — kritik servisler + HTTP sağlık + API içi readyz.
# Kullanım (repo kökü):  VERIFY_BASE_URL=https://api.example.com bash scripts/verify-vps-health.sh
# Varsayılan: VERIFY_BASE_URL=http://127.0.0.1  (nginx üzerinden, sunucuda)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-$ROOT/.env.prod}"
BASE="${VERIFY_BASE_URL:-http://127.0.0.1}"
BASE="${BASE%/}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[verify] ERROR: env file not found: $ENV_FILE"
  exit 1
fi

DC=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

echo "=========================================="
echo "[verify] Motogram prod sağlık kontrolü"
echo "[verify] ENV_FILE=$ENV_FILE"
echo "[verify] VERIFY_BASE_URL=$BASE"
echo "=========================================="

echo ""
echo "[verify] --- docker compose ps ---"
"${DC[@]}" ps

echo ""
echo "[verify] --- HTTP: livez / readyz (nginx veya BASE) ---"
livez_body="$(curl -fsS "$BASE/v1/livez")"
echo "GET $BASE/v1/livez → $livez_body"
if [[ "$livez_body" != *'"ok":true'* ]] && [[ "$livez_body" != *'"ok": true'* ]]; then
  echo "[verify] ERROR: livez beklenen gövde değil"
  exit 1
fi

readyz_body="$(curl -fsS "$BASE/v1/readyz")"
echo "GET $BASE/v1/readyz → $readyz_body"
if [[ "$readyz_body" != *'"ok":true'* ]] && [[ "$readyz_body" != *'"ok": true'* ]]; then
  echo "[verify] ERROR: readyz 200 ama ok değil veya bağımlılık hatası"
  exit 1
fi

echo ""
echo "[verify] --- API konteyneri içinden readyz (nginx bypass) ---"
"${DC[@]}" exec -T api node -e "
fetch('http://127.0.0.1:3000/v1/readyz')
  .then(r => r.text().then(t => { console.log(t); if (!r.ok) process.exit(1); }))
  .catch(() => process.exit(1));
"

echo ""
echo "[verify] --- /v1/metrics (ilk satırlar; başarısızsa uyarı) ---"
curl -fsS "$BASE/v1/metrics" 2>/dev/null | head -n 5 || echo "[verify] WARN: /v1/metrics erişilemedi (nginx kısıtı); livez/readyz geçtiyse kritik değil."

echo ""
echo "[verify] --- Kritik konteyner isimleri (Running) ---"
# İsimler docker-compose.prod.yml container_name ile uyumlu
for c in motogram_postgres motogram_redis motogram_minio motogram_pgbouncer motogram_api motogram_nginx; do
  state="$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo missing)"
  if [[ "$state" != "running" ]]; then
    echo "[verify] ERROR: $c durumu: $state (running olmalı)"
    exit 1
  fi
  echo "  OK  $c → $state"
done

echo ""
echo "=========================================="
echo "[verify] Tüm kontroller tamam (olması gerektiği gibi)."
echo "=========================================="
