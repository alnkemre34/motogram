# Opsiyonel pgBackRest CLI sidecar — `docker compose --profile backup`.
# Postgres veri dizini ve repo volume compose ile baglanir; tam PITR icin
# Postgres tarafinda archive_mode / archive_command ayri yapilandirilir (RUNBOOK §13.5).
FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends pgbackrest ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/lib/pgbackrest/repo /var/lib/pgbackrest/log \
  && chmod 750 /var/lib/pgbackrest/repo

WORKDIR /etc/pgbackrest
CMD ["sleep", "infinity"]
