#!/usr/bin/env bash
# Usage: scripts/smoke-test.sh https://verdict-staging.alyasi.tech sha-<commit>
# Waits until the deployment is healthy and reports the expected version. The web health endpoint
# also checks the api, database and storage. Checking the version catches a deploy or rollback that
# left the previous version running.
# Staging sits behind Cloudflare Access: set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET to pass it.
set -euo pipefail
url="${1:?base URL required}/api/health"
version="${2:?expected version required}"
headers=()
if [ -n "${CF_ACCESS_CLIENT_ID:-}" ] && [ -n "${CF_ACCESS_CLIENT_SECRET:-}" ]; then
  headers=(-H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET")
fi
reported=""
for _ in $(seq 1 30); do
  if body=$(curl -fsS --max-time 5 ${headers[@]+"${headers[@]}"} "$url"); then
    # A login page from the access gate isn't JSON; keep waiting rather than stop on it.
    reported=$(python3 -c 'import json, sys; print(json.loads(sys.argv[1]).get("version") or "")' "$body" 2>/dev/null) || reported=""
    if [ "$reported" = "$version" ]; then echo "OK $url reports $version"; exit 0; fi
  fi
  sleep 10
done
echo "Smoke test failed: $url${reported:+ reports $reported, not $version}"
exit 1
