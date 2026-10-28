#!/usr/bin/env bash
# Usage: db-restore.sh '<time>' | latest  <timeline> | latest
# Replaces an environment's database with its state at <time>, a timestamp with its zone such as
# '2026-10-28 14:05:00+00', or as far as the archive goes with "latest". <timeline> is the one the
# database being replaced was on (docs/DEPLOYMENT.md says how to find it). Naming it matters: a
# restore that was later backed out leaves a newer timeline in the archive, and following that one
# would stop at its branch point.
# Runs in a one-off container from this image, with the emptied data folder and the backup config
# mounted. Fetches the newest full backup that finished before <time> and replays the archived WAL
# up to it. Postgres then promotes the copy onto a new timeline and archives its history, so use
# this only to replace the database, never to look at old data. Stops Postgres when it's done.
set -euo pipefail
usage="Usage: db-restore.sh '<time, like 2026-10-28 14:05:00+00>' | latest  <timeline> | latest"
target="${1:?$usage}"
timeline="${2:?$usage}"
[[ $timeline =~ ^([1-9][0-9]*|latest)$ ]] || { echo "$usage" >&2; exit 1; }

if [ -n "$(ls -A "$PGDATA" 2>/dev/null)" ]; then
  echo "$PGDATA isn't empty. Move the old data aside first." >&2
  exit 1
fi

recovery=(-c "restore_command=wal-g wal-fetch %f %p" -c "recovery_target_timeline=$timeline"
  -c recovery_target_action=promote)
if [ "$target" = latest ]; then
  backup=LATEST
else
  at=$(date -u -d "$target" +%s)
  # A backup is consistent only from its end, so it must have finished by the target.
  backup=$(wal-g backup-list --detail --json | jq -r --argjson at "$at" '
    map(select((.finish_time | sub("\\.[0-9]+"; "") | fromdateiso8601) <= $at))
    | sort_by(.finish_time) | last | .backup_name // empty')
  if [ -z "$backup" ]; then
    echo "No full backup finished by $target, so it can't be restored." >&2
    exit 1
  fi
  recovery+=(-c "recovery_target_time=$target")
fi

echo "Fetching backup $backup"
wal-g backup-fetch "$PGDATA" "$backup"
touch "$PGDATA/recovery.signal"

# The image's archiving settings (Dockerfile), so the new timeline's history file is archived.
postgres -c listen_addresses= -c archive_mode=on -c "archive_command=wal-g wal-push %p" \
  "${recovery[@]}" &
server=$!

# Postgres deletes recovery.signal when recovery ends, then records "in production" once it has
# promoted; the backup's own control file says that too, hence both. Postgres exits instead if it
# can't reach the target, for example one later than the archive; its log above then says why.
until [ ! -e "$PGDATA/recovery.signal" ] &&
  pg_controldata | grep -q '^Database cluster state: *in production'; do
  if ! kill -0 "$server" 2>/dev/null; then
    echo "Recovery failed; Postgres's log above says why." >&2
    exit 1
  fi
  sleep 2
done
pg_ctl stop --mode=fast --wait
echo "Restored to $target. Postgres's log above shows the last transaction it replayed."
