# 000. Foundation

- Status: Ready
- Phase: 0
- Designs: all of `../verdict-internal/design/` (the private design repository; for the design system and app shell)
- Decisions: [ADR 0010](../docs/adr/0010-stack-revised.md) (stack), [ADR 0011](../docs/adr/0011-hosting-kamal.md) (hosting)

## Problem and goal
Every later feature needs a solid base:
- a working monorepo;
- the design system in code;
- an app shell that feels great on phones;
- deployment that reaches staging automatically and safely.

When this ships, a contributor can clone the repo, run one command and see the Verdict shell with the globe. Every merge to `main` then reaches staging safely.

## Scope
### Before building
- Prove every Python dependency installs and imports on Python 3.14 (one CI run).
- Confirm the servers' CPU architecture (see the private hosting runbook). Build images for it on GitHub's native runners.

### Monorepo
- **Root:**
  - pnpm, pinned in `packageManager`, with `minimumReleaseAge` in `pnpm-workspace.yaml`.
  - Root scripts `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`, `e2e:screens` and `contract:check` call into `apps/web` and `services/api`.
  - No Turborepo.
- **`apps/web`:**
  - Next.js 16 (App Router) with the React Compiler, React 19, TypeScript strict, ESLint and Prettier.
  - Tailwind CSS 4, with theme variables generated from `docs/brand/tokens.json`: colours, radius, spacing, motion durations and easing.
  - React Aria Components and Lingui (English, Arabic).
  - Vitest Browser Mode with the Playwright provider, and Playwright with @axe-core/playwright.
  - ESLint's `no-restricted-imports` keeps `components/ui` free of feature code.
- **`services/api`:**
  - FastAPI on Python 3.14 with uv.
  - Pydantic v2 settings: `APP_ENV` (development, test, staging, production), `DATABASE_URL` and the rest.
  - SQLAlchemy 2, Alembic and psycopg 3; Ruff, mypy (strict for new code) and pytest.
  - Module folders per `docs/ARCHITECTURE.md`, each with `api.py` (empty modules allowed). A boundary test fails when one module imports another module's internals.
  - A `fake` AI provider for tests.
- **Database conventions from day one:**
  - UUIDv7 primary keys (`uuidv7()`).
  - `course_id` on every course-scoped table, and every foreign key indexed.
  - Better Auth's tables live in a separate `auth` schema, reached only with the web app's own database role.
- **`ai_gateway` skeleton:**
  - Task roles, a model registry (TOML, read with Python's standard library, with capabilities and prices) and a credential resolver for `hosted` and `self_hosted`. `byok` storage lands in a later spec, but the interface exists now.
  - Calls go through Pydantic AI, installed slim with only the chosen providers.
  - A usage ledger table, the budget check (below), schema-validated outputs with one repair attempt, the `fake` provider, and an OpenTelemetry trace for every call.
- **Budget check that parallel jobs can't race:**
  - Before each call, the gateway reserves its estimated tokens and cost in one atomic database step that checks every limit together:
    - the student's daily token limit (`AI_DAILY_TOKEN_LIMIT_PER_USER`);
    - the platform's daily spend cap (`AI_DAILY_SPEND_LIMIT_USD`), which protects the hosted credits however many students sign up.
  - If any limit would be passed, nothing is reserved and the call is refused.
  - After the call, the ledger row replaces the reservation with the real tokens and cost. A call the provider rejected releases its reservation; one that may have been billed (a timeout or a broken stream) settles at its estimate.
  - Each limit compares like with like: tokens with tokens, dollars with dollars.
  - Days reset at 00:00 UTC. Reservations belong to their day, so one left by a crashed worker clears at the reset.
- **DBOS:**
  - Queues `ingestion`, `generation`, `verification`, `media` and `maintenance`, each with its own concurrency, and a worker command per queue.
  - One example two-step workflow whose progress streams to the browser through Postgres `LISTEN/NOTIFY` and SSE.
- **Generated API client:** `contract:check` exports OpenAPI from FastAPI and generates the Orval fetch client into `apps/web/lib/api/`. It fails if the committed client differs.

### App shell and design system (web)
- **Fonts:** Readex Pro via `next/font`, preloading only its Latin and Arabic files (other scripts' files load only for text that needs them, such as a student's name in Latin Extended).
- **Space background:**
  - The nebula is rendered at a quarter of its size and scaled up.
  - Two star layers and a shooting star animate only `opacity` and `transform`.
  - It pauses when the tab is hidden and is static with reduced motion.
- **Components** in `apps/web/components/ui`, built on React Aria Components (see the `verdict-design-system` skill): Button, IconButton, Input, Panel, Chip, SegmentedControl, Light, ProgressLights, Globe, Skeleton, Toast, Sheet/Dialog and EmptyState.
  - **States:** React Aria's `data-hovered` (never on touch), `data-pressed` and `data-focus-visible`, plus disabled and loading, all using motion tokens.
  - **Glows** are drawn once and animate only `opacity`. Don't copy the `box-shadow` pulses (`tw`, `glowp`) from the design files.
- **AppShell:**
  - Bottom navigation (Today, Course, Practice, Progress) under 1024px; a left sidebar (courses, Ask Verdict, sections, profile) from 1024px.
  - Page transitions use the View Transitions API (fade plus an 8px slide). They're instant where unsupported or with reduced motion.
  - Safe areas and `dvh` units.
- **Globe:** one `<canvas>`.
  - A Fibonacci sphere with props for point count and mastery split, and an optional orbit ring.
  - Glow comes from an image prepared once. Device pixel ratio is capped at 2, and low-memory devices get fewer points.
  - It pauses off screen and in hidden tabs, and shows a still frame with reduced motion.
  - The plain-language line and the legend stay in HTML for screen readers.
- **Locales:** English and Arabic, with `/en` and `/ar` routes, `dir`, and hreflang alternates. All layout uses logical properties.
- **`/dev/ui` route** (development and staging only): every component in every state, in both languages. This replaces a separate Storybook.

### Health and environments
- **Health endpoints:** `GET /api/health` on the web reports web, api, database and storage status. The api has `GET /health`.
- **Dockerfiles,** both built for the server's architecture:
  - `apps/web/Dockerfile`: multi-stage, standalone output, non-root user.
  - `services/api/Dockerfile`: uv, non-root. It runs `alembic upgrade head`, then starts uvicorn, and has a worker command.
- **Local services:** `docker compose up -d` provides Postgres 18 with pgvector locally, and `pnpm dev` runs web and api together.
- **No fallback secrets:**
  - `BETTER_AUTH_SECRET`, and any secret a later spec adds, has no default value in code.
  - If one is missing or empty, the web or api process stops at startup with a message naming the variable (never a value) and saying how to create it.
  - In `hosted` mode, `AI_DAILY_SPEND_LIMIT_USD` is required the same way, so a misconfigured deploy fails its smoke test instead of spending without a cap.
- **Kamal** (ADR 0011):
  - `config/deploy.api.yml` and `config/deploy.web.yml`, each with `staging` and `production` destinations, one role per process type, and cloudflared as an accessory.
  - SSH via `~/.ssh/config` (the `ssh` `config` option), and `.kamal/secrets` matching the list in `deploy.yml`.
  - Kamal installed from a `Gemfile` and `Gemfile.lock` with checksums, replacing the version-pinned `gem install` in `deploy.yml`.
- **CI/CD** is already written (ADR 0012): `ci.yml`, `deploy.yml`, `evals.yml`, `dependency-health.yml`. This spec makes them run for real:
  - the root `package.json` with `packageManager` and the scripts CI calls (version fields stay untouched; the git tag is the version);
  - Dependabot entries for npm (`/`), uv (`/services/api`) and docker (`/apps/web`, `/services/api`), with the same cooldown, `chore` prefix, scope and `dependencies` label as the existing entries;
  - `GET /api/health` reporting the running version and commit;
  - license metadata: `"license": "AGPL-3.0-only"` in `package.json`, `license = "AGPL-3.0-only"` in `pyproject.toml`, and the `org.opencontainers.image.licenses` label on both images (ADR 0009);
  - a "Source code" link in the app shell, pointing to `SOURCE_CODE_URL` (default: this repository), so anyone running Verdict offers its source as AGPL requires;
  - `services/api/uv.lock`;
  - the per-route JavaScript budget in the e2e suite;
  - the migration round-trip test;
  - running `scripts/github/setup-repo.sh` once the repository exists.
- **Staging database:** Postgres 18 with pgvector, WAL-G continuous archiving to off-site storage, and a monthly restore check. Production follows the same setup.
- **Monitoring:** uptime checks from a separate machine, as the private hosting runbook describes.

## Acceptance criteria
- [ ] Fresh clone: `cp .env.example .env`, fill the secrets marked required (`openssl rand -base64 32`), then `docker compose up -d && pnpm install && uv sync --project services/api && pnpm dev` shows the shell at localhost:3000 with the globe.
- [ ] `pnpm lint typecheck test build` and the api checks pass locally and in CI; `contract:check` passes; every Python dependency installs on 3.14.
- [ ] `pnpm e2e:screens` writes `artifacts/screens/<screen>-<390|1440>-<en|ar>.png` for every route (the `ui-reviewer` depends on these names).
- [ ] `/dev/ui` shows every component's states. Component tests in real Chromium cover hover (pointer only), pressed, focus-visible, disabled and loading. Axe reports no serious or critical issues.
- [ ] At 360px and 1440px the shell matches the approved designs (bottom nav vs sidebar); Arabic mirrors correctly.
- [ ] With reduced motion on, the background and globe are static and transitions are instant.
- [ ] A performance trace of the shell at 4× CPU throttling shows no long frames caused by the globe or background, and no animated property other than `transform` and `opacity`.
- [ ] Lighthouse mobile on the shell: performance 90+, accessibility 100.
- [ ] Merging to `main` deploys to staging with Kamal and the smoke test passes. A GitHub Release promotes the same image to production after approval. The rollback run restores the previous version.
- [ ] `gh attestation verify` succeeds for a staging image, and the promotion fails for a commit that never reached staging.
- [ ] `ci-ok`, `pr-title` and `cla` are the only required checks. A docs-only pull request skips web, api, contract and e2e and still passes. zizmor reports no findings.
- [ ] `scripts/github/setup-repo.sh` completes with no failed steps, and a second run changes nothing.
- [ ] A route over 170 KB of compressed JavaScript fails the e2e suite, and a migration that can't downgrade fails the api tests (each proved once).
- [ ] The staging database restores to a chosen minute from its WAL-G backups. Proved once by hand, then by the monthly check.
- [ ] The boundary test fails when one module imports another module's internals (proved by a test PR).
- [ ] Calling the gateway with the fake provider records a usage ledger row, and refuses a call that would pass the student's daily token limit or the platform's daily spend cap.
- [ ] 20 gateway calls fired at once against limits that fit 5: exactly 5 run and the ledger stays within both limits (tested on real Postgres).
- [ ] Starting the web or api without a required secret, or with it empty, fails at startup with a message naming the variable (tested for each).
- [ ] The example workflow, with its worker killed after step 1, resumes at step 2 without re-running step 1.
- [ ] Pull requests get labels automatically.

## Out of scope
- **Later specs:** sign-in, courses and any AI features (spec 001 onwards).
- **Not planned:** pull request preview environments (ADR 0011).
