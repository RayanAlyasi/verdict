#!/usr/bin/env bash
# A full backup of the live database, then retention: the backups a restore to any minute of the
# last 30 days could start from stay, and older ones go with the WAL only they needed. Runs in the
# backup container, which mounts the data folder read-only and reaches Postgres through its
# socket. Pings the "backup" URL in /etc/wal-g/heartbeats.json, if set, when it all worked.
# BACKUP_RETENTION_DAYS changes the 30 days, for tests.
set -euo pipefail

# Two databases' backups in one place would overwrite each other's WAL and confuse retention, so a
# new database (an emptied data folder, or a major upgrade) needs a new, empty storage prefix.
live=$(psql -XAtc 'SELECT system_identifier FROM pg_control_system()')
stored=$(wal-g backup-list --detail --json | jq -r 'sort_by(.finish_time) | last | .system_identifier // empty')
if [ -n "$stored" ] && [ "$stored" != "$live" ]; then
  echo "The storage holds another database's backups (system $stored; this one is $live)." >&2
  echo "Give this database a new, empty storage prefix (docs/DEPLOYMENT.md)." >&2
  exit 1
fi

wal-g backup-push "$PGDATA"

# By age, not by count, so an extra backup taken by hand doesn't shorten the window.
cutoff=$(date -u -d "${BACKUP_RETENTION_DAYS:-30} days ago" +%s)
oldest=$(wal-g backup-list --detail --json | jq -r --argjson cutoff "$cutoff" '
  map(select((.finish_time | sub("\\.[0-9]+"; "") | fromdateiso8601) <= $cutoff))
  | sort_by(.finish_time) | last | .backup_name // empty')
if [ -n "$oldest" ]; then
  # Ordered by start time rather than by the timeline in each name, which a major upgrade resets.
  wal-g delete before FIND_FULL "$oldest" --use-sentinel-time --confirm
fi

heartbeat=$(jq -r '.backup // empty' /etc/wal-g/heartbeats.json 2>/dev/null || true)
if [ -n "$heartbeat" ] && ! curl -fsS --retry 3 --max-time 10 -o /dev/null "$heartbeat"; then
  echo "The heartbeat ping failed, so monitoring will report this run as missed." >&2
fi
