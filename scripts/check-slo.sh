#!/usr/bin/env bash
set -euo pipefail
#
# R10 — Prometheus SLO kapısı (deploy sonrası veya bake kontrolü).
# Gerekli: curl, jq. Varsayılan: PROMETHEUS_URL=http://localhost:9090
#
# Ortam:
#   PROMETHEUS_URL       — Prometheus tabanı
#   SLO_MAX_5XX_RATIO    — Üst eşik (varsayılan 0.02 = %2), alerts.yml ile uyumlu
#   SKIP_SLO_CHECK=1     — Tüm kontrolleri atla (Prometheus yok ortam)
#

if [[ "${SKIP_SLO_CHECK:-0}" == "1" ]]; then
  echo "[check-slo] SKIP_SLO_CHECK=1 — atlandi."
  exit 0
fi

PROM="${PROMETHEUS_URL:-http://localhost:9090}"
SLO_MAX_5XX_RATIO="${SLO_MAX_5XX_RATIO:-0.02}"

fail() {
  echo "[check-slo] FAIL: $*" >&2
  exit 1
}

prom_json() {
  local q="$1"
  curl -fsS --get "${PROM}/api/v1/query" --data-urlencode "query=${q}"
}

prom_scalar() {
  local q="$1"
  prom_json "$q" | jq -r '.data.result[0].value[1] // empty'
}

num_ok_zero() {
  local val="$1"
  local msg="$2"
  [[ -z "$val" || "$val" == "null" ]] && return 0
  [[ "$val" == "NaN" ]] && return 0
  awk -v v="$val" 'BEGIN { exit (v + 0 > 0 ? 1 : 0) }' || fail "$msg (got ${val})"
}

num_ok_ratio() {
  local val="$1"
  [[ -z "$val" || "$val" == "null" || "$val" == "NaN" ]] && return 0
  awk -v r="$val" -v m="$SLO_MAX_5XX_RATIO" 'BEGIN { exit (r + 0 <= m + 0 ? 0 : 1) }' \
    || fail "HTTP 5xx oranı çok yüksek: ${val} (eşik ≤ ${SLO_MAX_5XX_RATIO})"
}

echo "[check-slo] Prometheus: ${PROM}"

prom_json 'up' | jq -e '.status == "success"' >/dev/null || fail "Prometheus erişilemiyor (${PROM})"

RATIO="$(prom_scalar 'sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))')"
echo "[check-slo] HTTP 5xx payı (5m): ${RATIO:-<boş>}"
num_ok_ratio "$RATIO"

ZOD="$(prom_scalar 'sum(increase(zod_response_mismatch_total[15m]))')"
echo "[check-slo] zod_response_mismatch artışı (15m): ${ZOD:-0}"
num_ok_zero "$ZOD" "zod_response_mismatch_total artışı > 0"

INB="$(prom_scalar 'sum(increase(zod_inbound_validation_errors_total[15m]))')"
echo "[check-slo] zod_inbound_validation_errors artışı (15m): ${INB:-0}"
num_ok_zero "$INB" "zod_inbound_validation_errors_total artışı > 0"

DLQ="$(prom_scalar 'max(max_over_time(bullmq_dlq_size[5m]))')"
if [[ -z "$DLQ" || "$DLQ" == "NaN" ]]; then
  DLQ="$(prom_scalar 'max(bullmq_dlq_size)')"
fi
echo "[check-slo] bullmq_dlq_size (max): ${DLQ:-0}"
num_ok_zero "$DLQ" "BullMQ DLQ derinliği > 0"

echo "[check-slo] Tamam — SLO kapısı geçildi."
