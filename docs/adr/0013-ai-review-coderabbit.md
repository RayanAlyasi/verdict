# 0013. AI pull request review: CodeRabbit

- Status: Accepted
- Date: 2026-10-23
- Supersedes: the optional Claude review in 0012

## Context
ADR 0012 kept one optional AI reviewer, a Claude workflow. It has problems:
- It needs a paid API key as a repository secret, which every workflow on every branch can read.
- It can't review pull requests from forks, because GitHub doesn't pass secrets to them. Those are the pull requests where a second reviewer helps most.
- It has never run, because the key was never added.

What 30 comparable projects run on their 25 most recent pull requests (October 2026):

| AI reviewer | Projects |
| --- | --- |
| CodeRabbit, on nearly every pull request | Supabase, Ghost, Documenso, Trigger.dev (25 of 25), Cal.com (20 of 25) |
| GitHub Copilot review | Outline (25), Home Assistant (19), Lingui, Pydantic |
| Cursor Bugbot, Codex or cubic | n8n, Twenty, Sentry, Grafana |
| Greptile | None |
| No AI reviewer | Mastodon, Plausible, Nextcloud, Anki, Open edX, Canvas, Discourse, Next.js, FastAPI, Ruff, PostHog, Immich, Open WebUI, Appwrite, DBOS |

CodeRabbit is free for public repositories with its paid-tier review features (rate limits may apply), and needs no application.

Things to weigh:
- **Write access:**
  - The CodeRabbit app asks for write access to code, workflows, pull requests, issues, checks and statuses.
  - In January 2025, researchers ran code on CodeRabbit's servers through a malicious pull request's linter config and obtained the app's private key. That key gave write access to every installation.
  - CodeRabbit fixed it within hours of the report and says no customer data was accessed.
- **Noise:** one independent benchmark found that about one in four CodeRabbit comments was a real bug (77 of 300, across 50 pull requests).
- **Attribution:** by default CodeRabbit writes a summary into the pull request description, and it offers to push its own commits (docstrings, tests, fixes).

## Decision
- **Two reviews before merge:**
  1. The author runs `/review` before opening the pull request: Claude's `code-reviewer` and `ui-reviewer` agents.
  2. CodeRabbit reviews the pull request, forks included, and again after each push, so it is the last review before merge. It is not a required check.
- **Every comment needs an answer:** `main` requires conversations to be resolved, so each comment is fixed, or answered and resolved, before merge.
- **Settings** (in `.coderabbit.yaml`):
  - No summary in descriptions and no CodeRabbit commits (docstrings, tests, comment fixes, CI fixes, merge conflicts), so everything in a pull request is its author's.
  - Its title and description checks are off; `pr-title` covers titles.
  - Linters that CI already runs with a different version are off (Ruff, and actionlint, which rejects the `$/` syntax).
  - The generated API client is excluded, and Dependabot pull requests are skipped.
  - It applies `AGENTS.md` and the architecture and security docs as guidelines to every file, and the UX guidelines to `apps/web`.
- **Install scope:** the app is installed on this repository only.
- **Pull request evals need approval:** they run in a separate `evals-pr` environment that waits for the maintainer. Nightly runs keep `evals`, which only `main` can use. See Consequences.
- **Removed:** `claude-review.yml`, a CI copy of the Claude review that never ran, and with it the repository-level `ANTHROPIC_API_KEY`.

## Alternatives
| Option | Why not |
| --- | --- |
| Greptile | Free open-source access is by application, and the licences it covers (MIT, Apache, GPL are cited) aren't confirmed to include AGPL. None of the 30 projects use it. |
| Claude in CI instead of CodeRabbit | It costs money per review, needs a secret, and can't review forks. |
| Claude in CI as well | A third review of the same change, by the same model family as `/review`. Most of its comments would repeat the other two, each one a conversation to resolve. |
| No AI reviewer | Outside contributions would get only one reviewer. |

## Consequences
- **Coverage:** every pull request gets a second review at no cost, including those from outside contributors.
- **Third-party write access:**
  - Branch rules apply to the app (it has no bypass), so it can't change `main` without a pull request that passes the required checks.
  - Anything with write access to workflows can push a branch whose workflow asks for an environment's secrets. Only the environment's own rules stop it:
    - `staging` accepts only `main`; `production` accepts only release tags and `main`, and needs approval.
    - `evals` accepts only `main`.
    - `evals-pr` waits for the maintainer's approval. An approval request for a run you didn't start is the signal to reject it.
  - Every eval run on a pull request therefore waits for one click. That click also stops a costly run on a change that isn't ready.
  - The eval environments get their own AI keys with a low spend limit, and a read-only evaluation-set token.
- **Leaving is cheap:** uninstall the app and delete `.coderabbit.yaml`.

## Revisit when
- **After its first 20 reviewed pull requests,** count the comments that led to a change:
  - fewer than 1 in 5: set `reviews.profile: quiet`;
  - still fewer than 1 in 5 after another 20: remove it.
- Its permissions, its free terms for open source, or its security record change.
