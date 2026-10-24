# Workflow

How a change goes from idea to production, and how we write branches, commits, pull requests, comments and releases.

## The loop
1. **Issue.** Every piece of work is an issue with a milestone (see [Issues](../CONTRIBUTING.md#issues)).
2. **Spec.** Features start from a spec in `specs/` (`/spec` writes one from the template). Review and commit the spec first.
3. **Plan.** List the files to change and the tests to add before editing.
4. **Build.** Implement in small steps, running tests and checks after each.
5. **Review.** Run `/review`. The `code-reviewer` and `ui-reviewer` agents check the change against the spec and the UX guidelines, and the `ai-quality-checker` runs the evals for AI changes. Fix what they find.
6. **Pull request.**
   - Open a PR using the template.
   - CI runs only the jobs your change affects. `ci-ok` sums them up, `pr-title` checks the title, and `cla` checks you've signed the [Contributor License Agreement](../CLA.md). These are the three required checks.
   - AI changes also pass the evals. Approve each run in the `evals-pr` environment: for an outside contributor's branch, only after reading the diff. Reject any request you didn't expect.
   - CodeRabbit reviews every PR except Dependabot's, and again after each push, so it's the last review before merge. Fix what it gets right; answer what it gets wrong. Then resolve each conversation.
7. **Merge.** Squash-merge when the required checks are green and conversations are resolved. CI then builds signed images and deploys them to staging.
8. **Release.** When staging is verified, publish a GitHub Release (see [Versioning and releases](#versioning-and-releases)) and approve the production deploy.

## Branches
- **Trunk-based development:** branch from `main`, keep the branch short-lived (merged within days), and delete it after merge (automatic).
- **Naming:** `<type>/<short-description>`, using the commit types below, for example `feat/hint-ladder`, `fix/exam-date-timezone`, `docs/hosting-guide`.
- **Keeping up to date:** use the "Update branch" button, or merge `main` in. History on the branch doesn't matter, because it's squashed.
- **Unfinished work:** a feature too big for one PR lands in several PRs behind a feature flag, so `main` is always releasable.
- **No direct pushes:** nobody pushes to `main`; branch rules require a pull request.

## Pull request titles (Conventional Commits)
A squash merge turns the PR title into the commit on `main`, and GitHub appends the PR number. So the title must follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). The `pr-title` check enforces it.

```
<type>(<optional scope>)<optional !>: <summary>
```

| Type | Use for | Version effect |
| --- | --- | --- |
| `feat` | A capability a user or self-hoster can see | minor |
| `fix` | A bug fix | patch |
| `perf` | Faster or cheaper, same behaviour | patch |
| `refactor` | Restructuring with no behaviour change | none |
| `test` | Tests only | none |
| `docs` | Documentation only | none |
| `build` | Dockerfiles, dependencies, package manager | none |
| `ci` | Workflows and repository automation | none |
| `chore` | Anything else that doesn't touch behaviour | none |
| `revert` | Reverting an earlier change: `revert: feat(practice): add hint ladder` | depends |

- **Scope (optional, lowercase):** a module or area: `identity`, `courses`, `ingestion`, `course-map`, `professor`, `ai-gateway`, `generation`, `verification`, `practice`, `memory`, `readiness`, `web`, `ui`, `auth`, `deploy`, `deps`.
- **Summary:**
  - imperative mood ("add", not "added" or "adds");
  - lowercase first word;
  - no full stop;
  - 72 characters at most for the whole title, ideally about 50;
  - say what changes, not how.
- **Breaking changes:** add `!` before the colon (`feat(ai-gateway)!: require a spend cap in hosted mode`) and fill in the PR's "Breaking changes" section.
- **Dependabot** titles follow the same format (`chore(deps): bump …`).

| Instead of | Write |
| --- | --- |
| `Fixed bug` | `fix(courses): keep exam dates in the student's time zone` |
| `feat: Added the new hint ladder feature to practice.` | `feat(practice): add the hint ladder` |
| `Update stuff` | `chore(deps): update pnpm to 10.20` |
| `WIP` | (Open a draft pull request instead.) |

## Pull request descriptions
Use the template (`.github/pull_request_template.md`):
- **What and why:** the problem, the approach, and any alternative you rejected.
- **How to test.**
- **Screenshots** for UI changes, at phone and desktop width, in English and Arabic.
- **Breaking changes** and upgrade notes.
- **The checklist.**
- **Links:** the issue (`Closes #123`) and the spec.

Write for a reviewer who hasn't seen the work: plain sentences, no restating the diff, and no claims you didn't check. Say what you ran and what it showed.

Other rules:
- **Size:** keep a PR to one feature or fix, ideally under 400 changed lines.
- **Drafts:** open a draft while work is in progress, and mark it ready once `/review` findings are fixed and CI is green.
- **Commits on the branch** can be small and frequent. Conventional messages there are a good habit but not required, since only the PR title reaches `main`.

## Review comments
Start each comment with its intent, following [Conventional Comments](https://conventionalcomments.org/):
- `issue:` must be fixed before merge;
- `suggestion:` worth considering;
- `question:` asks for information;
- `nit:` a minor preference that doesn't block.

Resolve every conversation before merging (branch rules require it). Explain the reason behind a request, not only the request.

## Code comments
- **Comment the why:** a constraint, a trade-off or a source. Clear names explain the what.
- **Only when needed:** no comments that restate the code, describe the change ("added X", "now uses Y") or label sections.
- **No commented-out code:** delete it; git keeps history.
- **TODOs link an issue:** `TODO(#123): drop the old column after v0.6.0`.

## Attribution
Commits, PR titles and descriptions, issues, review comments and release notes carry no tool attribution, such as AI co-author trailers or "generated with" footers. The person who opens a change owns every line of it. The `pr-title` check fails a description that credits an AI tool.

## Versioning and releases
Verdict follows [Semantic Versioning 2.0.0](https://semver.org/). Versions are git tags of the form `vMAJOR.MINOR.PATCH`, created by publishing a GitHub Release from `main`.

- **The tag is the only version.**
  - Version fields in `package.json` and `pyproject.toml` stay untouched.
  - Images are built once per commit (`sha-<commit>`) and given the release tag when promoted.
  - The running app reports its version and commit in `GET /api/health`.
- **Choosing the next version.** Look at the PR titles merged since the last release:
  - any `!` means **major**;
  - otherwise any `feat` means **minor**;
  - otherwise **patch**.

  While we're on `0.x` (until the public release, which will be `1.0.0`), a breaking change bumps the minor version and is called out in the notes.
- **What counts as breaking** (anything a self-hoster or student must act on):
  - a removed or renamed environment variable or setting;
  - a migration that needs manual steps;
  - a removed or changed public API field;
  - dropped support for a runtime or Postgres version.
- **Release notes:**
  - GitHub generates them from the PR titles, grouped by label (`.github/release.yml`).
  - Add a short "Highlights" paragraph and, when needed, "Upgrade notes" at the top.
  - GitHub Releases are the changelog; there's no `CHANGELOG.md`.
- **Hotfixes:** a `fix` PR to `main`, then a patch release. There are no release branches; `main` is always releasable.
- **Compatibility during deploys:** old and new versions run side by side briefly. API changes, like database migrations, are backward compatible for one release: expand first, contract in a later release.

## Dependency updates
- **Dependabot** opens grouped pull requests weekly, each at least 7 days after its release. Review and merge them like any other PR; nothing auto-merges.
- **A quarterly workflow** checks every direct dependency against ADR 0010's maintenance rules and opens an issue for any that fail.

## Definition of done
- [ ] Spec acceptance criteria met
- [ ] Tests added and passing; CI green
- [ ] Works at 360px and 1440px; all interaction states and motion present; reduced motion respected
- [ ] Checked in Arabic (right-to-left)
- [ ] Accessible: keyboard, focus, labels, contrast
- [ ] No secrets; security considerations in the spec addressed
- [ ] Docs updated if behaviour or setup changed
