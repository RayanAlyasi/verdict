#!/usr/bin/env bash
# Usage: scripts/preview-remove.sh <server> <slot> <pull request> [--keep-claim]
# Removes a preview slot's routes, containers, database, volumes and Kamal files from the server,
# then releases the slot unless --keep-claim (specs/014). It acts only while the slot's claim still
# names <pull request>, under a lock per slot, so two removals can't clear a slot that has meanwhile
# gone to another pull request; otherwise it changes nothing and exits with status 3. Plain docker
# rather than `kamal app remove`, which prunes every role's containers at once on a single host, and
# Docker refuses a second prune while one runs.
set -euo pipefail
host="${1:?server required}"
slot="${2:?slot required}"
pr="${3:?pull request required}"
keep="${4:-}"
[[ $slot =~ ^[12]$ ]] || { echo "Unknown preview slot: $slot" >&2; exit 1; }
[[ $pr =~ ^[0-9]+$ ]] || { echo "Not a pull request number: $pr" >&2; exit 1; }
[ -z "$keep" ] || [ "$keep" = --keep-claim ] || { echo "Unknown option: $keep" >&2; exit 1; }
dest="preview-$slot"
# shellcheck disable=SC2029 # expanded here on purpose; every value is checked above
ssh -n "$host" "
  set -e
  mkdir -p ~/.verdict-previews
  exec 9> ~/.verdict-previews/$slot.lock
  flock 9
  if [ \"\$(cat ~/.verdict-previews/$slot 2>/dev/null || true)\" != $pr ]; then
    echo 'Slot $slot no longer belongs to #$pr; leaving it alone.'
    exit 3
  fi
  for service in verdict-api-api-$dest verdict-web-web-$dest; do
    docker exec kamal-proxy kamal-proxy remove \$service >/dev/null 2>&1 || true
  done
  docker ps -aq --filter label=destination=$dest | xargs -r docker rm -f >/dev/null
  docker rm -f verdict-$dest-db >/dev/null 2>&1 || true
  docker volume rm -f verdict-$dest-postgres verdict-$dest-storage >/dev/null
  rm -rf ~/.kamal/apps/verdict-api-$dest ~/.kamal/apps/verdict-web-$dest \
    ~/.kamal/proxy/apps-config/verdict-api-$dest ~/.kamal/proxy/apps-config/verdict-web-$dest ~/verdict-$dest-db
  # Images no container uses; skipped if a deploy is pruning at the same moment.
  docker image prune -af --filter label=service=verdict-api >/dev/null 2>&1 || true
  docker image prune -af --filter label=service=verdict-web >/dev/null 2>&1 || true
  [ -n '$keep' ] || rm -f ~/.verdict-previews/$slot
"
