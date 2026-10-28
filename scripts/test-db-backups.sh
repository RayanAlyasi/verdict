#!/usr/bin/env bash
# Usage: scripts/test-db-backups.sh <db image>
# Proves the database image's backups end to end, with WAL-G writing to a Docker volume instead of
# object storage: continuous archiving, a full backup from a second container as the backup
# accessory takes it, the restore check, then a restore to a moment between two writes. CI runs it
# for changes to config/db/; it needs only Docker.
set -euo pipefail
image="${1:?Usage: scripts/test-db-backups.sh <db image>}"
name="verdict-backup-test-$$"
work=$(mktemp -d)
cleanup() {
  docker rm -f "$name-db" "$name-restored" >/dev/null 2>&1 || true
  docker volume rm -f "$name-data" "$name-socket" "$name-backups" "$name-restored" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

# As on a server, apart from the storage and a throwaway key.
printf '{"WALG_FILE_PREFIX": "/backups", "WALG_LIBSODIUM_KEY": "%s", "WALG_LIBSODIUM_KEY_TRANSFORM": "hex"}\n' \
  "$(openssl rand -hex 32)" >"$work/config.json"
chmod 755 "$work" && chmod 644 "$work/config.json"
docker run --rm --volume "$name-backups:/backups" --entrypoint chown "$image" postgres:postgres /backups
storage=(--volume "$work:/etc/wal-g:ro" --volume "$name-backups:/backups")

start() { # <container> <data volume> [docker run options]
  local container="$1" data="$2"
  shift 2
  docker run --detach --name "$container" --env POSTGRES_USER=verdict --env POSTGRES_PASSWORD=test \
    --volume "$data:/var/lib/postgresql" "${storage[@]}" "$@" "$image" >/dev/null
  # A first start runs a temporary server while it initialises, so wait for the real one.
  for _ in $(seq 1 60); do
    if docker logs "$container" 2>&1 | grep -q "ready for start up\|Skipping initialization" &&
      docker exec "$container" pg_isready -q -U verdict; then
      return
    fi
    sleep 1
  done
  docker logs "$container"
  return 1
}
sql() { docker exec "$1" psql -U verdict -d verdict -XAtqc "$2"; }
archive() { # waits until everything written so far on <container> is archived
  local segment
  segment=$(sql "$1" "SELECT pg_walfile_name(pg_current_wal_lsn())")
  sql "$1" "SELECT pg_switch_wal()" >/dev/null
  for _ in $(seq 1 30); do
    [ "$(sql "$1" "SELECT last_archived_wal >= '$segment' FROM pg_stat_archiver")" = t ] && return
    sleep 1
  done
  echo "WAL segment $segment wasn't archived." >&2
  docker logs "$1"
  return 1
}

start "$name-db" "$name-data" --volume "$name-socket:/var/run/postgresql"
sql "$name-db" "CREATE TABLE writes (n int)"
sql "$name-db" "INSERT INTO writes VALUES (1)"

echo "--- $(date -u +%T) A full backup from the backup container"
backup=(docker run --rm --user postgres --env PGHOST=/var/run/postgresql --env PGUSER=verdict
  --volume "$name-data:/var/lib/postgresql:ro" --volume "$name-socket:/var/run/postgresql"
  "${storage[@]}" "$image")
"${backup[@]}" db-backup.sh

sql "$name-db" "INSERT INTO writes VALUES (2)"
target=$(sql "$name-db" "SELECT now()")
sleep 1
sql "$name-db" "INSERT INTO writes VALUES (3)"
archive "$name-db"

echo "--- $(date -u +%T) The restore check"
"${backup[@]}" db-check.sh

echo "--- $(date -u +%T) A restore to $target, between the second and third writes"
docker stop "$name-db" >/dev/null
docker run --rm --user postgres --volume "$name-restored:/var/lib/postgresql" "${storage[@]}" "$image" \
  db-restore.sh "$target"
start "$name-restored" "$name-restored"
rows=$(sql "$name-restored" "SELECT string_agg(n::text, ',' ORDER BY n) FROM writes")
[ "$rows" = 1,2 ] || { echo "Expected rows 1,2 after the restore, got $rows." >&2; exit 1; }
# The restore promoted onto timeline 2; its history must be archived for later restores to follow it.
docker run --rm "${storage[@]}" "$image" wal-g wal-show --detailed-json |
  jq -e 'any(.[]; .id == 2)' >/dev/null || { echo "Timeline 2 isn't in the archive." >&2; exit 1; }
echo "Backups, the restore check and a restore to a chosen moment all work."
