#!/usr/bin/env bash
# The backup container's command. Takes a full backup at 03:00 UTC every night. On the 1st of the
# month it first runs the restore check (db-check.sh), so the check replays a day of archived WAL.
# A job that fails skips its heartbeat, and monitoring alerts on the missed ping.
set -uo pipefail
# Sleeps run in the background, so a stop signal ends the container at once.
trap 'exit 0' TERM INT
pause() { sleep "$1" & wait $!; }

echo "Waiting for the database on its socket."
until pg_isready -q; do pause 5; done
# A new database can't be restored until its first full backup. Its first start runs a temporary
# server while it initialises, which can cut that backup short, so keep trying until one exists.
until wal-g backup-list --json | jq -e 'length > 0' >/dev/null; do
  db-backup.sh && break
  echo "The first full backup failed; trying again in 5 minutes." >&2
  pause 300
done

while true; do
  next=$(date -u -d 'today 03:00' +%s)
  [ "$next" -gt "$(date -u +%s)" ] || next=$(date -u -d 'tomorrow 03:00' +%s)
  echo "Next full backup at $(date -u -d "@$next" '+%F %R') UTC."
  pause $((next - $(date -u +%s)))
  if [ "$(date -u +%d)" = 01 ]; then
    db-check.sh || echo "The restore check failed." >&2
  fi
  db-backup.sh || echo "The nightly backup failed." >&2
done
