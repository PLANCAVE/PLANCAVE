#!/usr/bin/env bash
set -e

# setup_database.sh - One-shot DB bootstrap for PlanCave
# - Creates the database if missing
# - Applies base schema (db.sql)
# - Applies migrations (migrations.sql)
# All operations are idempotent and safe to rerun.

DB_NAME="${PLANCAVE_DB_NAME:-plancave}"
DB_USER="${PLANCAVE_DB_USER:-postgres}"
DB_HOST="${PLANCAVE_DB_HOST:-localhost}"
DB_PORT="${PLANCAVE_DB_PORT:-5432}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DB_SQL="$PROJECT_ROOT/Backend/auth_api/db.sql"
MIGRATIONS_SQL="$PROJECT_ROOT/Backend/database/migrations.sql"

# Default password for local dev; override with PLANCAVE_DB_PASSWORD
export PGPASSWORD="${PLANCAVE_DB_PASSWORD:-postgres}"

PSQL="psql -h $DB_HOST -p $DB_PORT -U $DB_USER"

echo "[db] Using DB: $DB_NAME on $DB_HOST:$DB_PORT as $DB_USER"

# Create database if it does not exist
if ! $PSQL -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
  echo "[db] Creating database '$DB_NAME'"
  $PSQL -c "CREATE DATABASE \"$DB_NAME\";"
else
  echo "[db] Database '$DB_NAME' already exists, skipping create"
fi

DB_PSQL="$PSQL -d $DB_NAME"

run_sql_file() {
  local label="$1"
  local path="$2"

  if [ -f "$path" ]; then
    echo "[db] Applying $label from $path"
    $DB_PSQL -v ON_ERROR_STOP=1 -f "$path"
  else
    echo "[db] Skipping $label, file not found: $path"
  fi
}

run_sql_file "base schema (db.sql)" "$BACKEND_DB_SQL"
run_sql_file "migrations (migrations.sql)" "$MIGRATIONS_SQL"

echo "[db] Database '$DB_NAME' is fully set up."

echo "[db] Example DATABASE_URL for backend:"
echo "      postgresql://$DB_USER:${PLANCAVE_DB_PASSWORD:-postgres}@$DB_HOST:$DB_PORT/$DB_NAME"
