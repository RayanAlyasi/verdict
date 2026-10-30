#!/usr/bin/env bash
# Proves the backups restore. Marks a point on the live database and waits for it to be archived,
# fetches the latest full backup into a scratch folder, and replays the archived WAL as a standby,
# along the live database's timeline, until it passes that point. It then reads every row and
# column of every table back and compares the migration revision with the live database's. A
# standby is never promoted, so nothing is archived from the copy.
# Runs in the backup container. Pings the "restore_check" URL in /etc/wal-g/heartbeats.json, if
# set, when the copy passes.
set -euo pipefail
scratch=/tmp/restore-check

live() { psql -XAtc "$1"; }
# A WAL record of our own, so the copy has a point to replay past even on an idle database. The
# switch closes its segment, which sends it to storage.
lsn=$(live "SELECT pg_logical_emit_message(false, 'verdict', 'restore check')")
live 'SELECT pg_switch_wal()' >/dev/null
segment=$(live "SELECT pg_walfile_name('$lsn')")
timeline=$(live 'SELECT timeline_id FROM pg_control_checkpoint()')
archived=false
for _ in $(seq 1 60); do
  if [ "$(live "SELECT coalesce(last_archived_wal >= '$segment', false) FROM pg_stat_archiver")" = t ]; then
    archived=true
    break
  fi
  sleep 5
done
if [ "$archived" != true ]; then
  echo "WAL segment $segment wasn't archived within 5 minutes; check archive_command." >&2
  exit 1
fi
revision() {
  if [ "$(psql -XAtc "SELECT to_regclass('public.alembic_version') IS NOT NULL")" = t ]; then
    psql -XAtc 'SELECT version_num FROM alembic_version'
  fi
}
expected=$(revision)

# The scratch folder shares a disk with the live database, so leave it room: the copy, the WAL it
# replays, and some to spare.
rm -rf "$scratch"
mkdir -m 700 "$scratch"
size=$(wal-g backup-list --detail --json | jq 'sort_by(.finish_time) | last | .uncompressed_size')
free=$(df --output=avail -B1 "$scratch" | tail -n 1)
if [ "$free" -lt $((size * 2 + 2 * 1024 * 1024 * 1024)) ]; then
  echo "Only $free bytes free for a copy of $size bytes; free some disk space first." >&2
  exit 1
fi

data="$scratch/data"
trap 'pg_ctl stop --pgdata="$data" --mode=immediate >/dev/null 2>&1 || true; rm -rf "$scratch"' EXIT
wal-g backup-fetch "$data" LATEST
touch "$data/standby.signal"
# Its own socket folder: the default one belongs to the live database. Replay never cancels the
# long reads below.
postgres -D "$data" -c listen_addresses= -c "unix_socket_directories=$scratch" -c archive_mode=off \
  -c "restore_command=wal-g wal-fetch %f %p" -c "recovery_target_timeline=$timeline" \
  -c max_standby_archive_delay=-1 >"$scratch/postgres.log" 2>&1 &
server=$!
export PGHOST="$scratch"

caught_up=false
for _ in $(seq 1 720); do
  if ! kill -0 "$server" 2>/dev/null; then
    cat "$scratch/postgres.log" >&2
    echo "The restored copy stopped during recovery." >&2
    exit 1
  fi
  if [ "$(psql -XAtc "SELECT pg_last_wal_replay_lsn() >= '$lsn'" 2>/dev/null)" = t ]; then
    caught_up=true
    break
  fi
  sleep 5
done
if [ "$caught_up" != true ]; then
  tail -n 50 "$scratch/postgres.log" >&2
  echo "The restored copy didn't replay up to $lsn within an hour." >&2
  exit 1
fi

# Sequential scans of every column read each table page and its TOAST, which verifies their
# checksums (on by default since Postgres 18). Unlogged tables have no data on a standby.
tables="SELECT format('SELECT sum(length(t::text)) FROM %I.%I t;', n.nspname, c.relname)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r' AND c.relpersistence = 'p'
    AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'"
export PGOPTIONS='-c enable_indexscan=off -c enable_indexonlyscan=off -c enable_bitmapscan=off'
psql -d postgres -XAtc 'SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate' |
  while IFS= read -r database; do
    psql -d "$database" -XAtc "$tables" | psql -d "$database" -XAq -v ON_ERROR_STOP=1 >/dev/null
  done
restored=$(revision)
if [ "$restored" != "$expected" ]; then
  echo "The copy's migration revision is '$restored', but the live database's is '$expected'." >&2
  exit 1
fi
echo "Restore check passed: replayed past $lsn on timeline $timeline, and every table reads back."

heartbeat=$(jq -r '.restore_check // empty' /etc/wal-g/heartbeats.json 2>/dev/null || true)
if [ -n "$heartbeat" ] && ! curl -fsS --retry 3 -o /dev/null "$heartbeat"; then
  echo "The heartbeat ping failed, so monitoring will report this run as missed." >&2
fi
