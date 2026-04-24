#!/usr/bin/env bash
set -euo pipefail
# Tek komutla .env.prod üretir (openssl). TLS yok: NGINX_CONF=http-only.
# Kullanım (repo kökü veya herhangi nereden):
#   bash scripts/init-env-prod.sh 85.235.74.203
#   SERVER_IP=85.235.74.203 bash scripts/init-env-prod.sh
# İsteğe bağlı 2. arg: çıktı dosyası (varsayılan: repo kökü .env.prod)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW="${1:-${SERVER_IP:-}}"
if [[ -z "$RAW" ]]; then
  echo "Kullanım: bash scripts/init-env-prod.sh <SUNUCU_IP_veya_DOMAIN>"
  echo "Örnek:    bash scripts/init-env-prod.sh 85.235.74.203"
  exit 1
fi

IP="${RAW#http://}"
IP="${IP#https://}"
IP="${IP%%/*}"

OUT="${2:-$ROOT/.env.prod}"
if [[ -f "$OUT" ]]; then
  echo "[init-env-prod] UYARI: $OUT zaten var. Üzerine yazılıyor (10 sn içinde Ctrl+C)..."
  sleep 2
fi

umask 077
cat >"$OUT" <<EOF
NGINX_CONF=nginx.http.conf
CORS_ALLOWED_ORIGINS=http://${IP}
POSTGRES_USER=motogram
POSTGRES_DB=motogram
POSTGRES_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)
MINIO_ROOT_USER=minio$(openssl rand -hex 4)
MINIO_ROOT_PASSWORD=$(openssl rand -hex 24)
MINIO_BUCKET=motogram-media
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
INTERNAL_API_SHARED_SECRET=$(openssl rand -hex 32)
NEXT_PUBLIC_API_BASE_URL=http://${IP}/v1
NEXTAUTH_URL=http://${IP}
NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')
APPLE_CLIENT_ID=
GOOGLE_CLIENT_IDS=
OTP_AUTH_ENABLED=false
FCM_CREDENTIALS_PATH=
APNS_AUTH_KEY_PATH=
SENTRY_DSN=
GRAFANA_USER=admin
GRAFANA_PASSWORD=$(openssl rand -hex 12)
SERVER_HOSTNAME=motogram-api
EOF
chmod 600 "$OUT"
echo "[init-env-prod] Tamam: $OUT"
echo "[init-env-prod] Sonra: cd $ROOT && SKIP_SLO_CHECK=1 bash scripts/deploy.sh"
