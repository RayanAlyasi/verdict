#!/usr/bin/env bash
# Usage: scripts/smoke-test.sh https://verdict-staging.alyasi.tech
# Waits for the new deployment, then checks health. The web health endpoint also checks the api, database and storage.
# Staging sits behind Cloudflare Access: set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET to pass it.
set -euo pipefail
url="${1:?base URL required}/api/health"
headers=()
if [ -n "${CF_ACCESS_CLIENT_ID:-}" ] && [ -n "${CF_ACCESS_CLIENT_SECRET:-}" ]; then
  headers=(-H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET")
fi
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 ${headers[@]+"${headers[@]}"} "$url" >/dev/null; then echo "OK $url"; exit 0; fi
  sleep 10
done
echo "Smoke test failed: $url"
exit 1
