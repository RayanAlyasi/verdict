#!/usr/bin/env bash
# A full backup of the live database, then retention: the newest 31 full backups stay, so any
# minute of the last 30 days can be restored, and older ones go with the WAL only they needed.
# Runs in the backup container, which mounts the data folder read-only and reaches Postgres through
# its socket. Pings the "backup" URL in /etc/wal-g/heartbeats.json, if set, when it all worked.
set -euo pipefail

wal-g backup-push "$PGDATA"
# Ordered by start time rather than by the timeline in each name, which a major upgrade resets.
wal-g delete retain FULL 31 --use-sentinel-time --confirm

heartbeat=$(jq -r '.backup // empty' /etc/wal-g/heartbeats.json 2>/dev/null || true)
if [ -n "$heartbeat" ] && ! curl -fsS --retry 3 -o /dev/null "$heartbeat"; then
  echo "The heartbeat ping failed, so monitoring will report this run as missed." >&2
fi
