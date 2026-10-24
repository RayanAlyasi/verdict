# 0012. CI/CD, repository settings and automation

- Status: Accepted
- Date: 2026-10-23
- Refines: 0003 (environments and deployment), 0011 (hosting)

## Context
The first CI setup worked in outline, but zizmor found 50 problems in it:
- 3 places where values from outside the workflow were inserted into shell commands (template injection);
- 34 actions referenced by tag instead of by commit;
- 12 checkouts that left the repo token on disk;
- 1 job with more permissions than it needed.

Two of its tools also failed ADR 0010's maintenance rules: gitleaks and squawk. To check against real practice, we read every GitHub Actions workflow in 14 large repositories: uv, Ruff, Pydantic, FastAPI, Next.js, React, VS Code, CPython, Astro, Dify, Better Auth, Supabase, Django and PostHog.

| Practice | Repositories using it | Our decision |
| --- | --- | --- |
| Actions pinned to full commit SHAs | 12 of 14 | Adopt, and enforce with the repository setting |
| Checkout without persisted credentials | 14 of 14 | Adopt |
| Job timeouts | 13 of 14 | Adopt |
| Path filtering (skip unaffected jobs) | 13 of 14 | Adopt, inside the `changes` job |
| zizmor (workflow security linter) | 9 of 14 | Adopt |
| One aggregate "all green" required check | 6 of 14 | Adopt (`ci-ok`) |
| Signed build provenance (attestations) | 5 of 14 | Adopt for container images |
| Merge queue | 5 of 14 | Not now (one maintainer) |
| Bot that closes stale issues | 5 of 14 (all with very high issue volume) | No |
| PR labeler | 4 of 14 | Keep: labels drive release-note categories |
| Release tooling (changesets and similar) | 2 of 14 (npm libraries) | No; we ship an app |
| Dependabot auto-merge | 0 of 14 | No |
| Harden-Runner, OpenSSF Scorecard | 0 of 14 | No |
| Own CodeQL workflow file | 1 of 14 | No; GitHub's default setup |
| PR number on every commit on `main` (squash merge) | 13 of 14 | Adopt |
| Conventional Commits on `main` | 7 of 14 at 64–100% (Better Auth, PostHog, Dify, Electron, Angular, Supabase, partly Astro) | Adopt, enforced on PR titles |
| A maintained `CHANGELOG.md` in apps | Next.js, Dify, Supabase, VS Code and Better Auth have none; PostHog's points to its website | No; GitHub Releases are the changelog |

## Decision
- **Three required checks: `ci-ok`, `pr-title` and `cla`.**
  - `ci.yml` runs on every pull request and every push to `main`. Its jobs are `changes`, `web`, `api`, `contract`, `e2e`, `zizmor`, `scripts`, `dependency-review` and `evals`.
  - `ci-ok` passes when every job passed or was skipped as unaffected, so adding a job never means editing branch protection.
  - The `changes` job skips work a pull request doesn't touch. Pushes to `main` run everything.
  - `cla` comes from `cla.yml` and checks the author has signed the Contributor License Agreement (ADR 0009).
  - `pr-title` enforces Conventional Commits on PR titles, which become the squash commits on `main`. It lives in its own workflow so a title edit doesn't re-run CI.
  - Signed commits aren't required. Every commit on `main` is a squash merge that GitHub creates and signs, and direct pushes are blocked. The rule would also apply to the pull request's own commits, so every contributor would have to sign their branch commits.
- **Versioning:**
  - SemVer `vMAJOR.MINOR.PATCH` tags, published as GitHub Releases from `main`.
  - The tag is the only version.
  - PR title types decide the bump. GitHub Releases are the changelog.
  - The rules are in `docs/WORKFLOW.md`.
- **Hardened workflows.**
  - Every action is pinned to a full commit SHA. The repository setting enforces this, and Dependabot updates the pins.
  - Every job declares minimal permissions, has a timeout, and doesn't persist checkout credentials.
  - The default workflow token is read-only. zizmor audits workflows and Dependabot config on every PR.
  - Workflows from outside contributors need approval before they run.
  - Same-repository workflows are called with GitHub's `$/` self-repository syntax.
- **Deploys** (`deploy.yml`, ADR 0011).
  - A green push to `main` builds arm64 images on native runners, with no build cache because they're shipped.
  - Each image gets a signed provenance attestation, so self-hosters can run `gh attestation verify`. The images then deploy to staging with Kamal.
  - A GitHub Release promotes the same image digest to production after approval. Rollback is a manual run with a version.
  - Smoke tests pass Cloudflare Access with a service token.
- **The AI evaluation gate** (ADR 0004).
  - `evals.yml` runs when a pull request touches AI code, and every night.
  - It uses the `evals` environment's secrets and a spend cap.
  - Pull requests from forks fail the gate, rather than skip it, until a maintainer pushes the branch to the repository.
- **Dependency health** (ADR 0010).
  - A quarterly workflow runs `scripts/dependency_health.py` over direct dependencies.
  - When a dependency fails, it opens or updates one issue.
- **Secrets.**
  - GitHub's secret scanning and push protection guard the server side.
  - A TruffleHog pre-commit hook (lefthook) guards the local side.
  - gitleaks is removed: 2 active people and no release since March 2026.
- **Repository settings as code.** `scripts/github/setup-repo.sh` applies everything below and is safe to re-run:
  - **Merging:** squash only, with the PR title as the commit title.
  - **Branch rules for `main`:** pull request required, linear history, `ci-ok`, `pr-title` and `cla` reported by GitHub Actions, no new high-severity CodeQL alerts, conversations resolved.
  - **Security features:** secret scanning, push protection, Dependabot alerts and security updates, private vulnerability reporting, CodeQL default setup.
  - **Actions:** the hardening above.
  - **Environments:** `staging`, `production`, `evals` and `evals-pr`.
  - **Labels and milestones.**
- **Bots:**
  - Dependabot: weekly updates, a 7-day cooldown on version updates, grouped updates and a `dependencies` label. Security updates aren't delayed.
  - The labeler.
  - The optional Claude review: pull requests from this repository only, and never a required check.
  - Nothing else.
- **Release notes:** GitHub's generated notes, grouped by label (`.github/release.yml`).
- **Migrations:**
  - A test applies migrations up, down and up again on real Postgres.
  - The code-reviewer agent checks the expand-then-contract rule.
  - No migration linter: squawk is 95% one person.
- **Performance budget:** the e2e suite fails a route that loads more than 170 KB of compressed JavaScript.
- **Backup restore check:** runs monthly on our own servers, never on CI runners, so student data never leaves our infrastructure. A missed or failed check alerts.

## Consequences
- Branch protection doesn't change when jobs are added or removed.
- Documentation-only pull requests finish in about a minute.
- A compromised or retagged action can't reach our workflows unnoticed.
- Shipped images can be traced to the commit and workflow that built them.
- Every repository setting is reviewable and reproducible.
- AI changes can't merge without passing the evals.
- actionlint 1.7.12 doesn't yet recognise the `$/` syntax. It isn't part of CI; zizmor is.

## Revisit when
- **A second regular maintainer joins:** require one approval and code-owner review, and enable prevent self-review for production.
- **Several pull requests a day merge into `main`:** add a merge queue.
- **Issue volume outgrows triage:** consider a stale-issue policy.
- **A tool here fails ADR 0010's rules at the quarterly check:** replace it.
