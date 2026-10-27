#!/usr/bin/env bash
# Usage: REPO=owner/name scripts/preview-comment.sh <pull request> <slot, or ""> <message>
# Writes the preview bot's one comment on a pull request, editing it in place (specs/014). Its first
# line marks it as the bot's and names the slot the preview holds, which preview.yml reads later.
set -euo pipefail
pr="${1:?pull request number required}"
slot="${2-}"
message="${3:?message required}"
: "${REPO:?set REPO to owner/name}"
body="<!-- verdict-preview${slot:+ slot=$slot} -->"$'\n'"$message"
id=$(gh api "repos/$REPO/issues/$pr/comments" --paginate \
  --jq '.[] | select(.user.login == "github-actions[bot]" and (.body | startswith("<!-- verdict-preview"))) | .id' |
  head -n 1)
if [ -n "$id" ]; then
  gh api -X PATCH "repos/$REPO/issues/comments/$id" -f body="$body" >/dev/null
else
  gh api -X POST "repos/$REPO/issues/$pr/comments" -f body="$body" >/dev/null
fi
