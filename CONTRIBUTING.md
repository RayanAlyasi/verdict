# Contributing to Verdict

Thanks for helping students walk into their exams ready. This guide takes you from your first issue to a merged pull request. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute
- **Report a bug** or **suggest a feature** with the [issue forms](https://github.com/RayanAlyasi/verdict/issues/new/choose).
- **Report a vulnerability** privately, never in a public issue. See [SECURITY.md](SECURITY.md).
- **Improve the docs,** or **write code** for an open issue.

## Before you start
- Issues labelled [`good first issue`](https://github.com/RayanAlyasi/verdict/labels/good%20first%20issue) are small and well described. [`help wanted`](https://github.com/RayanAlyasi/verdict/labels/help%20wanted) issues are open to anyone.
- Comment on an issue to claim it before you start.
- For anything larger than a small fix, discuss the approach in the issue first, so no work is wasted.
- Features are built from a spec in [`specs/`](specs/README.md). If a feature has no spec yet, the spec comes first.

## Contributor License Agreement
Before your first pull request can be merged, sign the [Contributor License Agreement](CLA.md) by commenting exactly this on the pull request:

> I have read the Verdict CLA and I agree to its terms.

You sign once; the `cla` check then passes on all your pull requests.
- **What you keep:** the copyright to your work, and the guarantee that it always stays available under the AGPL.
- **What the CLA allows:** the project may also offer your contribution under other licences. That's how Verdict can fund itself with commercial licences ([ADR 0009](docs/adr/0009-license-agpl-and-cla.md)).
- **Contributing for a company?** Open an issue first; organisations need a separate agreement.

## Development setup
1. Follow [Getting started](README.md#getting-started) in the README.
2. Install [TruffleHog](https://github.com/trufflesecurity/trufflehog#installation), then the git hooks: `pnpm dlx lefthook install`. The hooks format your code and block commits that contain secrets.

## Repository layout
| Path | What lives there |
| --- | --- |
| `apps/web` | Next.js web app: the UI and sign-in, with no business logic |
| `services/api` | FastAPI service: data, ingestion and the AI pipeline |
| `specs/` | One spec per feature; code is written from specs |
| `docs/` | Product, architecture, deployment, security, UX, testing, workflow, decision records and brand |
| `scripts/` | Repository setup, the docs check, dependency health and smoke tests |
| `.github/` | CI/CD workflows, issue and pull request templates, Dependabot |
| `AGENTS.md`, `.claude/` | Instructions, review agents and skills for AI coding agents |

## Making a change
1. **Branch from `main`** as `<type>/<short-description>`, for example `feat/exam-picker` or `fix/exam-date-timezone`.
2. **Keep it small:** one feature or fix, ideally under 400 changed lines.
3. **Add or update tests.** A bug fix starts with a failing test.
4. **UI changes** include screenshots at phone (390px) and desktop (1440px) width, in English and Arabic.
   - Shared components live in `apps/web/components/ui`; `/en/dev/ui` shows each one in every state (toasts and sheets on `/en/dev/ui/overlays`), when `APP_ENV` is development, test or staging.
   - Text a student reads goes through Lingui, never a bare string: `<Trans>` from `@lingui/react/macro` in markup, or `` i18n._(msg`…`) `` with the `i18n` that `initLingui()` returns. Each page and layout calls `initLingui()` first. Lingui's global `` t`…` `` isn't set up, so it throws.
   - `pnpm --dir apps/web messages` adds new text to `apps/web/locales/`; then write its Arabic in `ar.po`. Lint and the build fail while a translation is missing.
5. **Run the checks** for what you changed:
   ```bash
   pnpm lint && pnpm typecheck && pnpm test     # web (first run: pnpm --dir apps/web exec playwright install chromium)
   uv run --directory services/api ruff check . && uv run --directory services/api mypy . && uv run --directory services/api pytest   # api
   ```
6. **Title the pull request** as a [Conventional Commit](https://www.conventionalcommits.org/), for example `feat(web): add the exam picker`. It becomes the commit on `main`.

[docs/WORKFLOW.md](docs/WORKFLOW.md) has the full rules for branches, titles, descriptions, review comments and releases.

## Review
- **Checks:** `ci-ok`, `pr-title` and `cla` must pass, and the change must add no high-severity CodeQL alerts. `ci-ok` covers lint, types, tests, end-to-end and accessibility checks, workflow security and dependency review.
- **Pull requests from outside contributors:** a maintainer approves each workflow run before it starts.
- **AI changes:** if your change touches AI code, a maintainer runs the evals by pushing your branch to the repository, because evals can't run on forks.
- **CodeRabbit,** an AI reviewer, comments on every pull request. Fix what it gets right and reply where it's wrong, then resolve each conversation; unresolved conversations block merging.
- **The maintainer's review decides.** Expect a first response within a few days.

## Issues
- Use the issue forms. Feature issues link to their spec and list acceptance criteria; bug issues include steps to reproduce, expected and actual behaviour, and the device and browser.
- Large work is a parent issue with sub-issues. A pull request closes its issue with `Closes #123`.
- Maintainers label issues, and pull requests are labelled automatically.

## Code style
Formatting is automatic: Prettier for TypeScript and Ruff for Python. Prefer clear names to comments, and comment the why, not the what. [docs/UX-GUIDELINES.md](docs/UX-GUIDELINES.md) covers the interface: interaction states, motion, mobile layout and right-to-left.

## AI coding tools
You're welcome to use them. `AGENTS.md` and `.claude/` give agents the project's rules, review agents and skills. You remain responsible for every line you submit: read it, run it and test it. Don't add tool attribution, such as co-author trailers or "generated with" lines, to commits or pull requests.
