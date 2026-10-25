# Deployment

Three environments run the same images with different data and secrets. Changes flow one way: **development → staging → production** ([ADR 0003](adr/0003-environments-and-deployment.md), [ADR 0011](adr/0011-hosting-kamal.md)).

| | Development | Staging | Production |
| --- | --- | --- | --- |
| Address | `localhost:3000` (web) and `:8000` (API) | `verdict-staging.alyasi.tech` | `verdict.alyasi.tech` |
| Access | You | The team and testers, behind an access gate | Everyone |
| Deploys | `pnpm dev` | Kamal, automatically on every merge to `main` | Kamal, when a GitHub Release is published and approved |
| Database | Postgres 18 with pgvector in Docker | Postgres 18 with pgvector, continuous backups | Postgres 18 with pgvector, point-in-time recovery |
| Files | Local `./storage` | A server volume at `STORAGE_LOCAL_PATH` (a staging bucket is planned for spec 001) | A server volume at `STORAGE_LOCAL_PATH` (a production bucket is planned for spec 001) |
| AI | Your own key or a local model | Shared key with low limits | Production key, per-user fair use and a platform spend cap |
| Google sign-in | Development OAuth client | Staging OAuth client | Production OAuth client |
| Data | Seeded demo course | Seeded demo course and test accounts | Real users; never copied to other environments |

## How a change reaches production
1. **A pull request** runs CI: lint, types, tests, security scans, end-to-end tests, and phone and desktop screenshots in English and Arabic. A pull request that changes a Dockerfile, a lockfile or the deploy config also builds both images, without pushing them.
2. **Merging to `main`:**
   - Once `ci-ok` is green, CI builds the `web` and `api` images and tags them `sha-<commit>`.
   - It signs their build provenance and pushes them to GitHub Container Registry.
   - It deploys them to staging with Kamal, the API first, so migrations run before the web app relies on them.
   - A smoke test checks the health endpoint.
3. **Publishing a GitHub Release** (for example `v0.4.0`) once staging looks good:
   - The production job waits for the maintainer's approval in the `production` environment.
   - It then adds the release tag to the same image digests, deploys them with Kamal and runs the smoke test again.
   - If no staging image was built for the release commit, the promotion fails.

Production runs the images built for staging; nothing is rebuilt. Each image carries the commit it was built from (`APP_COMMIT`; `GET /api/health` reports the web image's, and both are built from the same commit), and the deploy sets the version (`APP_VERSION`). Anyone can verify that an image came from this repository's CI:

```bash
gh attestation verify oci://ghcr.io/rayanalyasi/verdict/api:v0.4.0 -R RayanAlyasi/verdict
```

## Images
- **`apps/web/Dockerfile`:** Next.js's standalone server on Node 26, run as the non-root `node` user. `pnpm --dir apps/web start` runs the same server locally after a build.
- **`services/api/Dockerfile`:** Python 3.14 with the locked dependencies, run as a non-root user. By default it runs `alembic upgrade head`, then starts uvicorn; each worker role runs `python -m verdict.worker <queue>` instead.
- **Both:** built from the repository root for arm64, with base images pinned by digest (Dependabot proposes updates after the same 7-day wait as other dependencies; for an urgent operating-system fix, update the digest by hand), current root certificates and the `org.opencontainers.image.licenses` label.
- **Storage:** the api writes uploads to `/app/storage`. Mount a named volume there; a host folder must belong to uid 1000.

Build and run one locally with `docker build -f services/api/Dockerfile --build-arg APP_COMMIT=$(git rev-parse HEAD) -t verdict-api .`.

## Rollback
Run the **deploy** workflow by hand from `main` with `rollback_to` set to the version to restore, for example `v0.3.2`. After approval, it runs `kamal rollback` for both services. Migrations are backward compatible, so rolling back code is safe.

## Database migrations
Alembic migrations run before the new API containers accept traffic. They follow expand and contract:
- **Never drop or rename a column** in the same release that stops using it; remove it in a later release.
- **Add new columns** as nullable or with defaults.

## Backups
Production's database is archived continuously, so it can be restored to any minute in the last 30 days. Backups are encrypted and stored with a different provider, and an automated restore proves them every month.

## Secrets and variables
- **Development:** `.env`, which git ignores. [`.env.example`](../.env.example) documents the names.
- **Staging and production:** GitHub environment secrets, passed to Kamal through `.kamal/secrets` at deploy time. Only the jobs that declare an environment can read its values.

Never put secrets in code, logs, issues or screenshots. `deploy.yml` passes the app secrets to Kamal; keep its list and `.kamal/secrets` in sync with this table.

| Name | Kind | Environments | Purpose |
| --- | --- | --- | --- |
| `APP_URL` | variable | staging, production | Base URL for the deployment link and the smoke test |
| `KAMAL_SSH_PRIVATE_KEY`, `KAMAL_SSH_KNOWN_HOSTS` | secret | staging, production | Deploys over SSH, with the servers' host keys pinned |
| `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | secret | staging, production | Service token for SSH through the tunnel, and for the smoke test past the access gate |
| `CLOUDFLARE_TUNNEL_TOKEN` | secret | staging, production | The tunnel that carries all traffic, so the servers have no open ports |
| `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | secret | staging, production | Sign-in |
| `DATABASE_URL`, `AUTH_DATABASE_URL` | secret | staging, production | Database roles for the API and for the web app's `auth` schema |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | secret | staging, production, evals, evals-pr | AI providers. The eval environments get their own keys, with a low spend limit set at the provider |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | secret | staging, production | File storage in a bucket, from spec 001; unused until then |
| `SENTRY_DSN` | secret | staging, production | Error reporting |
| `EVALS_REPO` (variable), `EVALS_REPO_TOKEN` (secret) | both | evals, evals-pr | The private evaluation set, with a read-only token |
| `EVALS_SPEND_LIMIT_USD` | variable | evals, evals-pr | Cost cap for one eval run |

`evals` accepts only `main`, for nightly and on-demand runs. Pull request evals use `evals-pr`, which waits for the maintainer's approval ([ADR 0013](adr/0013-ai-review-coderabbit.md)).

## Monitoring
- **Health:** `GET /api/health` on the web app reports web, the API, the database and storage, plus the running version and commit. The smoke test and the every-minute uptime checks use it.
- **Errors, traces and logs:** errors are reported with personal data scrubbed, every AI call and workflow step emits an OpenTelemetry trace, and logs are structured JSON with a request ID and never personal data or file contents.
