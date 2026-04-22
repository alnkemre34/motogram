#!/usr/bin/env bash
set -euo pipefail
# pgBackRest komutlari — backup profili ile ayaga kalkan `pgbackrest` konteynerinde calisir.
# Ornek: ./scripts/pgbackrest-exec.sh --stanza=motogram stanza-create
#        ./scripts/pgbackrest-exec.sh --stanza=motogram backup
#        ./scripts/pgbackrest-exec.sh --stanza=motogram info
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${ENV_FILE:-$ROOT/.env.prod}"
COMPOSE=(docker compose -f "$ROOT/docker-compose.prod.yml")
if [[ -f "$ENV_FILE" ]]; then
  COMPOSE+=(--env-file "$ENV_FILE")
fi
COMPOSE+=(--profile backup exec -T pgbackrest pgbackrest)
exec "${COMPOSE[@]}" "$@"
