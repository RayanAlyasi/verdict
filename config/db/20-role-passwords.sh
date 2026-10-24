#!/usr/bin/env bash
# Lets the roles from 10-roles.sql log in. The passwords come from the container's environment;
# \getenv reads them inside psql, so they never appear in a command line.
set -euo pipefail

: "${VERDICT_API_DB_PASSWORD:?Set VERDICT_API_DB_PASSWORD, the password for the api role (openssl rand -base64 32)}"
: "${VERDICT_WEB_DB_PASSWORD:?Set VERDICT_WEB_DB_PASSWORD, the password for the web role (openssl rand -base64 32)}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv api_password VERDICT_API_DB_PASSWORD
\getenv web_password VERDICT_WEB_DB_PASSWORD
ALTER ROLE verdict_api LOGIN PASSWORD :'api_password';
ALTER ROLE verdict_web LOGIN PASSWORD :'web_password';
SQL
