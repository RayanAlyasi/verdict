#!/usr/bin/env bash
# Pings the "archiving" URL in /etc/wal-g/heartbeats.json only while WAL is reaching storage and the
# disk has room. db-schedule.sh runs it every 5 minutes, because stalled uploads leave every segment
# on the server, up to about 23 GB a day per database, and the nightly backup only hangs waiting
# for them: its heartbeat could be missed after the disk has already filled.
set -euo pipefail

healthy=true
backlog=$(psql -XAtc "SELECT count(*) FROM pg_ls_archive_statusdir() WHERE name LIKE '%.ready'")
if [ "$backlog" -gt 10 ]; then
  echo "$backlog WAL segments are waiting to reach storage." >&2
  healthy=false
fi
used=$(df --output=pcent "$PGDATA" | tail -1 | tr -dc 0-9)
if [ "$used" -ge 90 ]; then
  echo "The disk holding the database is $used% full." >&2
  healthy=false
fi
$healthy

heartbeat=$(jq -r '.archiving // empty' /etc/wal-g/heartbeats.json 2>/dev/null || true)
if [ -n "$heartbeat" ] && ! curl -fsS --retry 3 -o /dev/null "$heartbeat"; then
  echo "The heartbeat ping failed, so monitoring will report this run as missed." >&2
fi
