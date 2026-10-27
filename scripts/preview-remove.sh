#!/usr/bin/env bash
# Usage: scripts/preview-remove.sh <server> <slot>
# Removes a preview slot's routes, containers, database, volumes and Kamal files from the server
# (specs/014). Plain docker rather than `kamal app remove`, which prunes every role's containers at
# once on a single host, and Docker refuses a second prune while one runs. Claims are left alone.
set -euo pipefail
host="${1:?server required}"
slot="${2:?slot required}"
[[ $slot =~ ^[12]$ ]] || { echo "Unknown preview slot: $slot" >&2; exit 1; }
dest="preview-$slot"
# shellcheck disable=SC2029 # expanded here on purpose; the slot is checked above
ssh -n "$host" "
  set -e
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
"
