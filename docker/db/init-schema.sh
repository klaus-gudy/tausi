#!/bin/sh
# Runs once, when the Postgres volume is first created: makes DB_SCHEMA and
# hands it to the app user.
set -eu

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v schema="${DB_SCHEMA:-public}" \
  -v owner="$POSTGRES_USER" <<'SQL'
CREATE SCHEMA IF NOT EXISTS :"schema" AUTHORIZATION :"owner";
ALTER ROLE :"owner" SET search_path TO :"schema";
SQL
