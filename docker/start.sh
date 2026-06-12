#!/bin/bash
set -e

PG_BIN="/usr/lib/postgresql/16/bin"
PGDATA="${PGDATA:-/var/lib/postgresql/data/pgdata}"
DB_NAME="${DB_NAME:-ao_idp}"
DB_USERNAME="${DB_USERNAME:-ao_idp}"
DB_PASSWORD="${DB_PASSWORD:-changeme}"

# ──────────────────────────────────────────────
# 1. Initialize PostgreSQL cluster if needed
# ──────────────────────────────────────────────
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "[start.sh] Initializing PostgreSQL cluster at $PGDATA ..."
    mkdir -p "$PGDATA"
    chown -R postgres:postgres "$(dirname "$PGDATA")"
    su -s /bin/bash postgres -c "$PG_BIN/initdb -D '$PGDATA' --auth-host=md5 --auth-local=trust --encoding=UTF8 --locale=en_US.UTF-8"
    echo "host all all 127.0.0.1/32 md5" >> "$PGDATA/pg_hba.conf"
    echo "listen_addresses='127.0.0.1'" >> "$PGDATA/postgresql.conf"
fi

# ──────────────────────────────────────────────
# 2. Start PostgreSQL as postgres user
# ──────────────────────────────────────────────
echo "[start.sh] Starting PostgreSQL ..."
su -s /bin/bash postgres -c "$PG_BIN/pg_ctl -D '$PGDATA' -l '$PGDATA/logfile' start"

# Wait for postgres to accept connections
echo "[start.sh] Waiting for PostgreSQL to become ready ..."
for i in $(seq 1 30); do
    su -s /bin/bash postgres -c "$PG_BIN/pg_isready -q" && break
    sleep 1
done

# Create DB user if not exists, always sync password
echo "[start.sh] Ensuring database and user exist ..."
su -s /bin/bash postgres -c "$PG_BIN/psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USERNAME'\" | grep -q 1 \
    && $PG_BIN/psql -c \"ALTER USER \\\"$DB_USERNAME\\\" WITH PASSWORD '$DB_PASSWORD';\" \
    || $PG_BIN/psql -c \"CREATE USER \\\"$DB_USERNAME\\\" WITH PASSWORD '$DB_PASSWORD';\""
su -s /bin/bash postgres -c "$PG_BIN/psql -tc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\" | grep -q 1 || $PG_BIN/psql -c \"CREATE DATABASE \\\"$DB_NAME\\\" OWNER \\\"$DB_USERNAME\\\";\""

# ──────────────────────────────────────────────
# 3. Start the Java application
# ──────────────────────────────────────────────
echo "[start.sh] Starting AO IDP server on port 7000 ..."
export DB_HOST=127.0.0.1
export DB_PORT=5432
exec java $JAVA_OPTS -jar /app/app.jar
