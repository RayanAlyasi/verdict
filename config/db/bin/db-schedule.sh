#!/usr/bin/env bash
# The backup container's command. Takes a full backup at 03:00 UTC every night. On the 1st of the
# month it first runs the restore check (db-check.sh), so the check replays a day of archived WAL.
# A job that fails skips its heartbeat, and monitoring alerts on the missed ping.
set -uo pipefail
# Sleeps run in the background, so a stop signal ends the container at once.
trap 'exit 0' TERM INT

until pg_isready -q; do sleep 5 & wait $!; done
# A new database can't be restored until its first full backup, so take one now.
if ! wal-g backup-list --json | jq -e 'length > 0' >/dev/null; then
  db-backup.sh || echo "The first full backup failed." >&2
fi

while true; do
  next=$(date -u -d 'today 03:00' +%s)
  [ "$next" -gt "$(date -u +%s)" ] || next=$(date -u -d 'tomorrow 03:00' +%s)
  echo "Next full backup at $(date -u -d "@$next" '+%F %R') UTC."
  sleep $((next - $(date -u +%s))) & wait $!
  if [ "$(date -u +%d)" = 01 ]; then
    db-check.sh || echo "The restore check failed." >&2
  fi
  db-backup.sh || echo "The nightly backup failed." >&2
done
