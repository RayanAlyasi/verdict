#!/usr/bin/env bash
# Applies the repository settings, so they're reviewed in pull requests instead of clicked by hand.
# Safe to re-run (ADR 0012).
# Usage: scripts/github/setup-repo.sh [owner/repo]   (gh CLI logged in as a repository admin)
set -uo pipefail
REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
ME_ID="$(gh api user -q .id)"
failures=0
ok()   { echo "ok    $1"; }
fail() { echo "FAIL  $1" >&2; failures=$((failures + 1)); }
step() { local what="$1"; shift; if "$@" >/dev/null; then ok "$what"; else fail "$what"; fi; }
echo "Configuring $REPO"

step "description and topics" gh repo edit "$REPO" \
  --description "Exam coach built from a student's own course materials. Phone and desktop, Arabic and English." \
  --add-topic education --add-topic exam-preparation --add-topic spaced-repetition --add-topic ai \
  --add-topic nextjs --add-topic fastapi --add-topic postgresql --add-topic arabic

step "merge settings" gh api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=BLANK \
  -F delete_branch_on_merge=true -F allow_auto_merge=true -F allow_update_branch=true \
  -F has_projects=false -F has_wiki=false

step "secret scanning and push protection" gh api -X PATCH "repos/$REPO" --input - <<'JSON'
{"security_and_analysis": {"secret_scanning": {"status": "enabled"}, "secret_scanning_push_protection": {"status": "enabled"}}}
JSON
step "Dependabot alerts" gh api -X PUT "repos/$REPO/vulnerability-alerts"
step "Dependabot security updates" gh api -X PUT "repos/$REPO/automated-security-fixes"
step "private vulnerability reporting" gh api -X PUT "repos/$REPO/private-vulnerability-reporting"
step "CodeQL default setup (extended queries)" gh api -X PATCH "repos/$REPO/code-scanning/default-setup" \
  -f state=configured -f query_suite=extended

step "workflow token read-only by default; Actions can't approve PRs" gh api -X PUT "repos/$REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
step "actions must be pinned to full commit SHAs" gh api -X PUT "repos/$REPO/actions/permissions" \
  -F enabled=true -f allowed_actions=all -F sha_pinning_required=true
step "workflows from outside contributors need approval" gh api -X PUT "repos/$REPO/actions/permissions/fork-pr-contributor-approval" \
  -f approval_policy=all_external_contributors

ruleset() {  # name, JSON: create the ruleset, or update it if one with that name exists
  local id
  id=$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name == \"$1\") | .id" 2>/dev/null)
  if [ -n "$id" ]; then gh api -X PUT "repos/$REPO/rulesets/$id" --input - <<<"$2"
  else gh api -X POST "repos/$REPO/rulesets" --input - <<<"$2"; fi
}

# Signed commits aren't required on main: every commit on main is a squash merge
# that GitHub creates and signs, and the rule would make every contributor sign their branch commits.
# 15368 is the GitHub Actions app, so only Actions can report the required checks.
RULESET=$(cat <<'JSON'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {"ref_name": {"include": ["~DEFAULT_BRANCH"], "exclude": []}},
  "rules": [
    {"type": "deletion"},
    {"type": "non_fast_forward"},
    {"type": "required_linear_history"},
    {"type": "pull_request", "parameters": {
      "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": true,
      "require_code_owner_review": false, "require_last_push_approval": false,
      "required_review_thread_resolution": true, "allowed_merge_methods": ["squash"]}},
    {"type": "required_status_checks", "parameters": {
      "strict_required_status_checks_policy": false, "do_not_enforce_on_create": false,
      "required_status_checks": [
        {"context": "ci-ok", "integration_id": 15368},
        {"context": "pr-title", "integration_id": 15368},
        {"context": "cla", "integration_id": 15368}]}},
    {"type": "code_scanning", "parameters": {"code_scanning_tools": [
      {"tool": "CodeQL", "alerts_threshold": "errors", "security_alerts_threshold": "high_or_higher"}]}}
  ]
}
JSON
)
step "branch rules for main" ruleset main "$RULESET"

step "branch rules for cla-signatures" ruleset cla-signatures '{
  "name": "cla-signatures", "target": "branch", "enforcement": "active",
  "conditions": {"ref_name": {"include": ["refs/heads/cla-signatures"], "exclude": []}},
  "rules": [{"type": "deletion"}, {"type": "non_fast_forward"}]}'

policies() {  # environment, then each allowed "pattern:branch|tag"; adds missing policies and deletes any others
  local env="$1" existing id rule want
  shift
  existing=$(gh api "repos/$REPO/environments/$env/deployment-branch-policies" --paginate \
    --jq '.branch_policies[] | "\(.id) \(.name):\(.type)"') || return 1
  while read -r id rule; do
    [ -n "$id" ] || continue
    printf '%s\n' "$@" | grep -qxF "$rule" ||
      gh api -X DELETE "repos/$REPO/environments/$env/deployment-branch-policies/$id" || return 1
  done <<<"$existing"
  for want in "$@"; do
    cut -s -d' ' -f2- <<<"$existing" | grep -qxF "$want" ||
      gh api -X POST "repos/$REPO/environments/$env/deployment-branch-policies" \
        -f name="${want%:*}" -f type="${want##*:}" || return 1
  done
}
step "environment: staging" gh api -X PUT "repos/$REPO/environments/staging" --input - <<'JSON'
{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
JSON
step "staging deploys only from main" policies staging main:branch
step "environment: production (your approval required)" gh api -X PUT "repos/$REPO/environments/production" --input - <<JSON
{"reviewers": [{"type": "User", "id": $ME_ID}], "prevent_self_review": false,
 "deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
JSON
step "production deploys from release tags, and rollbacks run from main" policies production 'v*:tag' main:branch
step "environment: evals" gh api -X PUT "repos/$REPO/environments/evals" --input - <<'JSON'
{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
JSON
step "evals runs only from main" policies evals main:branch
step "environment: preview" gh api -X PUT "repos/$REPO/environments/preview" --input - <<'JSON'
{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
JSON
step "preview deploys only from main (preview.yml runs there)" policies preview main:branch
step "environment: evals-pr (your approval required)" gh api -X PUT "repos/$REPO/environments/evals-pr" --input - <<JSON
{"reviewers": [{"type": "User", "id": $ME_ID}], "prevent_self_review": false, "deployment_branch_policy": null}
JSON

label() { step "label: $1" gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force; }
label "type: feature"    3CC4A2 "New capability"
label "type: bug"        F07A6E "Something is broken"
label "type: chore"      8C9AAE "Maintenance"
label "type: docs"       5876FF "Documentation"
label "area: web"        1F6FEB "apps/web"
label "area: api"        1F6FEB "services/api"
label "area: ai"         A371F7 "Generation, verification, evals"
label "area: design"     E3A84A "UX and visual design"
label "area: infra"      6E7781 "CI/CD, environments"
label "dependencies"     0366D6 "Dependency updates"
label "security"         D73A49 "Security related"
label "good first issue" 7057FF "Small and well described"
label "help wanted"      008672 "Open for contributors"
label "blocked"          B60205 "Waiting on something"
label "accessibility"    0E8A16 "Keyboard, screen readers, contrast, motion"
label "preview"          3CC4A2 "Deploy this pull request to a preview slot (specs/014)"

# GitHub's default labels that the scheme above replaces. Closing reasons cover duplicate, invalid and won't fix.
existing_labels=$(gh label list --repo "$REPO" --limit 200 --json name --jq '.[].name')
for old in bug documentation enhancement duplicate invalid question wontfix; do
  if grep -qxF "$old" <<<"$existing_labels"; then
    step "remove default label: $old" gh label delete "$old" --repo "$REPO" --yes
  fi
done

milestone() {
  if gh api "repos/$REPO/milestones?state=all&per_page=100" --jq '.[].title' | grep -qxF "$1"; then ok "milestone exists: $1"
  else step "milestone: $1" gh api "repos/$REPO/milestones" -f title="$1" -f description="$2"; fi
}
milestone "Phase 0: Foundation" "Repo, CI/CD, environments, design system in code"
milestone "Phase 1: Core loop" "Sign-in, course setup, ingestion, course map, Today, study session"
milestone "Phase 2: Exams and readiness" "Reviews, mistakes, readiness, practice exams, results, solutions"
milestone "Phase 3: Generate and share" "Topic generation, Ask Verdict, PDF exams, sharing"
milestone "Phase 4: Full release" "Bring your own AI, self-hosting"

echo
if [ "$failures" -gt 0 ]; then
  echo "$failures step(s) failed. Fix or set them by hand (the comments above describe each setting), then re-run."
  exit 1
fi
echo "Done. Add environment secrets and variables next (docs/DEPLOYMENT.md#secrets-and-variables)."
