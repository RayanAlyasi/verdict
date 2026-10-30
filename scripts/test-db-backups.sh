#!/usr/bin/env bash
# Usage: scripts/test-db-backups.sh <db image>
# Proves the database image's backups end to end, with WAL-G writing to a Docker volume instead of
# object storage: continuous archiving, the backup container's first and later full backups with
# retention, the watch on stalled archiving, the restore check, a restore to a moment between two
# writes, the check again after that restore is backed out, and the refusal to mix two databases'
# backups. CI runs it for changes to config/db/; it needs only Docker.
set -euo pipefail
image="${1:?Usage: scripts/test-db-backups.sh <db image>}"
name="verdict-backup-test-$$"
work=$(mktemp -d)
cleanup() {
  docker rm -f "$name-db" "$name-schedule" "$name-restored" "$name-other" >/dev/null 2>&1 || true
  docker volume rm -f "$name-data" "$name-socket" "$name-backups" "$name-restored" "$name-other" \
    "$name-other-socket" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

# As on a server, apart from the storage and a throwaway key.
printf '{"WALG_FILE_PREFIX": "/backups", "WALG_PREVENT_WAL_OVERWRITE": "true", "WALG_LIBSODIUM_KEY": "%s", "WALG_LIBSODIUM_KEY_TRANSFORM": "hex"}\n' \
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
backups() { docker run --rm "${storage[@]}" "$image" wal-g backup-list --json 2>/dev/null | jq length; }
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
container=(--user postgres --env PGHOST=/var/run/postgresql --env PGUSER=verdict
  --volume "$name-data:/var/lib/postgresql:ro" --volume "$name-socket:/var/run/postgresql"
  "${storage[@]}" "$image")
backup=(docker run --rm "${container[@]}")

echo "--- $(date -u +%T) The backup container's first full backup"
docker run --detach --name "$name-schedule" "${container[@]}" db-schedule.sh >/dev/null
for _ in $(seq 1 60); do [ "$(backups)" = 1 ] && break; sleep 1; done
[ "$(backups)" = 1 ] || { docker logs "$name-schedule"; echo "The backup container took no backup." >&2; exit 1; }
docker stop --time 5 "$name-schedule" >/dev/null

echo "--- $(date -u +%T) Another full backup, keeping none older than it"
"${backup[@]}" env BACKUP_RETENTION_DAYS=0 db-backup.sh
[ "$(backups)" = 1 ] || { echo "Retention kept $(backups) backups instead of 1." >&2; exit 1; }

echo "--- $(date -u +%T) The watch on archiving"
watch=$("${backup[@]}" db-watch.sh 2>&1)
[ -z "$watch" ] || { echo "The watch complained on a healthy database: $watch" >&2; exit 1; }
sql "$name-db" "CREATE TABLE stalled (n int)"
docker exec "$name-db" chmod 000 /backups
for n in $(seq 1 12); do
  sql "$name-db" "INSERT INTO stalled VALUES ($n)"
  sql "$name-db" "SELECT pg_switch_wal()" >/dev/null
done
if watch=$("${backup[@]}" db-watch.sh 2>&1); then
  echo "The watch passed with archiving stalled." >&2
  exit 1
fi
grep -q "waiting to reach storage" <<<"$watch" || { echo "$watch" >&2; exit 1; }
docker exec "$name-db" chmod 755 /backups
caught_up=false
for _ in $(seq 1 90); do
  if "${backup[@]}" db-watch.sh 2>/dev/null; then caught_up=true; break; fi
  sleep 1
done
$caught_up || { echo "Archiving didn't catch up after the stall." >&2; exit 1; }

sql "$name-db" "INSERT INTO writes VALUES (2)"
target=$(sql "$name-db" "SELECT now()")
sleep 1
sql "$name-db" "INSERT INTO writes VALUES (3)"
archive "$name-db"

echo "--- $(date -u +%T) The restore check"
"${backup[@]}" db-check.sh

echo "--- $(date -u +%T) A restore to $target, between the second and third writes"
timeline=$(sql "$name-db" "SELECT timeline_id FROM pg_control_checkpoint()")
docker stop "$name-db" >/dev/null
docker run --rm --user postgres --volume "$name-restored:/var/lib/postgresql" "${storage[@]}" "$image" \
  db-restore.sh "$target" "$timeline"
start "$name-restored" "$name-restored"
rows=$(sql "$name-restored" "SELECT string_agg(n::text, ',' ORDER BY n) FROM writes")
[ "$rows" = 1,2 ] || { echo "Expected rows 1,2 after the restore, got $rows." >&2; exit 1; }
# The restore promoted onto timeline 2; its history must be archived for later restores to follow it.
docker run --rm "${storage[@]}" "$image" wal-g wal-show --detailed-json |
  jq -e 'any(.[]; .id == 2)' >/dev/null || { echo "Timeline 2 isn't in the archive." >&2; exit 1; }

echo "--- $(date -u +%T) The restore check after backing that restore out"
# The original database goes on along timeline 1, while the archive also holds timeline 2.
docker stop "$name-restored" >/dev/null
docker start "$name-db" >/dev/null
for _ in $(seq 1 30); do docker exec "$name-db" pg_isready -q -U verdict && break; sleep 1; done
sql "$name-db" "INSERT INTO writes VALUES (4)"
"${backup[@]}" db-check.sh

echo "--- $(date -u +%T) A second database refused by the same storage"
start "$name-other" "$name-other" --volume "$name-other-socket:/var/run/postgresql"
if docker run --rm --user postgres --env PGHOST=/var/run/postgresql --env PGUSER=verdict \
  --volume "$name-other:/var/lib/postgresql:ro" --volume "$name-other-socket:/var/run/postgresql" \
  "${storage[@]}" "$image" db-backup.sh 2>"$work/refused"; then
  echo "A second database's backup went into the first one's storage." >&2
  exit 1
fi
grep -q "another database's backups" "$work/refused" || { cat "$work/refused" >&2; exit 1; }
echo "Backups, retention, the archiving watch, the restore check and a restore to a chosen moment all work."
