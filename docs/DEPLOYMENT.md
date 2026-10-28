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
1. **A pull request** runs CI: lint, types, tests, security scans, end-to-end tests, and phone and desktop screenshots in English and Arabic. A pull request that changes a Dockerfile, a lockfile or the deploy config also builds the images, without pushing them, and one that changes the Kamal config checks it with `kamal config`. Building the database image also tests its backups: a full backup, the restore check, and a restore to a chosen moment (`scripts/test-db-backups.sh`).
2. **Merging to `main`:**
   - Once `ci-ok` is green, CI builds the `web`, `api` and `db` images and tags them `sha-<commit>`.
   - It signs their build provenance and pushes them to GitHub Container Registry.
   - It deploys them to staging with Kamal, over SSH on the private network that the private hosting runbook describes:
     - the database, its backup container and the tunnel start on the first deploy and keep running after it (moving them to a new image is a [step on the server](#moving-the-database-to-a-new-image));
     - the api deploys first and migrates, so the web app never relies on a migration that hasn't run;
     - the old workers stop before the new ones start, since two workers with the same executor ID could both resume a workflow;
     - then the web app deploys.
   - A smoke test checks the health endpoint, and that it reports the version just deployed.
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
- **`services/api/Dockerfile`:** Python 3.14 with the locked dependencies, run as a non-root user. By default it migrates the database with `python -m verdict.migrate`, then starts uvicorn; each worker role runs `python -m verdict.worker <queue>` instead.
- **`config/db/Dockerfile`:** the deployed database, Postgres 18 with pgvector, plus WAL-G and the backup scripts in `config/db/bin/` ([backups](#backups)). WAL-G is a release binary checked against a pinned checksum; Dependabot can't see it, so update it by hand. Previews run the plain base image instead.
- **All three:** built from the repository root for arm64, with base images pinned by digest (Dependabot proposes updates after the same 7-day wait as other dependencies; for an urgent operating-system fix, update the digest by hand) and current root certificates. The web and api images carry the `org.opencontainers.image.licenses` label.
- **Deploys** also label each image `service=verdict-api` or `service=verdict-web`, which Kamal checks before it runs one.
- **Storage:** the api writes uploads to `/app/storage`. Deployed, that's the server folder `/var/lib/verdict/<environment>/storage`, owned by uid 1000 (the api's user), which Kamal mounts into the api and every worker.

Build and run one locally with `docker build -f services/api/Dockerfile --build-arg APP_COMMIT=$(git rev-parse HEAD) -t verdict-api .`.

## Pull request previews
Adding the `preview` label to a pull request from a branch in this repository deploys it to one of two slots, `verdict-preview-1.alyasi.tech` and `verdict-preview-2.alyasi.tech`, behind the same access gate as staging ([spec 014](../specs/014-pull-request-previews.md)). A bot comment links to it.
- **Two workflows:**
  - `preview-request.yml` only reports that a pull request's `preview` label or commits changed. A pull request runs its own copy of it, so nothing it produces is used.
  - `preview.yml` runs from `main` (`workflow_run`), so a pull request can't change it. It reads the pull request through the API, and acts only on a labelled, current commit that the repository owner pushed, according to the activity log. It builds that commit's images itself, in a job with no secrets or server access, then deploys them.
- **Each preview** is the api, the workers and the web app, with a database and storage on Docker volumes of its own. Data survives the pull request's pushes; a pull request taking a slot starts empty.
- **Slots:** the server records which pull request holds each slot in `~/.verdict-previews/<slot>`, claimed atomically. With both taken, the comment names the pull requests holding them.
- **Removal:** closing or merging the pull request, or removing the label, removes the preview and frees its slot (`scripts/preview-remove.sh`). A sweep every 6 hours, or a manual run of `preview.yml`, removes any preview whose pull request isn't open with the label.
- **A new destination's api name** (`proxy.run.options.network-alias` in `config/deploy.*.yml`) needs one `kamal proxy reboot`, which briefly interrupts every environment. Run it from a preview destination, which doesn't log in to the registry.
- **The `preview` environment** accepts only `main`. Its secrets are its own, apart from staging's AI key, which previews share with a smaller daily cap.

## Rollback
Run the **deploy** workflow by hand from `main` with `rollback_to` set to the version to restore, for example `v0.3.2`. After approval, it deploys that release's images again, the same way as any deploy, and the smoke test confirms the version. It doesn't use `kamal rollback`, which needs the old containers, and Kamal's pruning may already have removed them.

Migrations are backward compatible, so rolling back code is safe. The older api starts against a database that a newer one migrated, and leaves it as it is.

## Database migrations
The api migrates (`python -m verdict.migrate`) before it answers its health check, so a new version takes traffic only after its migrations have run. kamal-proxy waits 3 minutes for that (`deploy_timeout` in `config/deploy.api.yml`); raise it before a migration that takes longer. Migrations follow expand and contract:
- **Never drop or rename a column** in the same release that stops using it; remove it in a later release.
- **Add new columns** as nullable or with defaults.
- **Never delete a migration that has reached staging;** undo it with a new one. The api treats a database revision it doesn't know as one from a newer version and leaves the database alone, so a deleted revision would stop later migrations from running.

## The deployed database
Each environment's Postgres runs on the server as a Kamal accessory (`config/deploy.api.yml`), with its data in `/var/lib/verdict/<environment>/postgres`. When that folder is empty, Postgres creates the database and runs `config/db/10-roles.sql` and `config/db/20-role-passwords.sh`: the api and web roles, then their passwords from `VERDICT_API_DB_PASSWORD` and `VERDICT_WEB_DB_PASSWORD`. The apps never connect as the superuser.

These steps run on the server, as the private hosting runbook describes; `<environment>` is `staging` or `production`.
- **A first start that stopped halfway:**
  - If the database exists but a role script failed, run both scripts again. They're safe to repeat.

    ```bash
    docker exec verdict-<environment>-db psql -v ON_ERROR_STOP=1 -U verdict -d verdict -f /docker-entrypoint-initdb.d/10-roles.sql
    docker exec verdict-<environment>-db bash /docker-entrypoint-initdb.d/20-role-passwords.sh
    ```
  - If Postgres itself never finished creating the database, nothing is stored yet. Remove the container (`docker rm -f verdict-<environment>-db`), empty the data folder, and deploy again.
- **Rotating a role's password** (the apps keep their own roles throughout):
  1. Make a new one with `openssl rand -hex 32`.
  2. Set it on the role, `verdict_api` or `verdict_web`. psql asks for it twice and sends only a hash, so it never appears in a log or a process list:

     ```bash
     docker exec -it verdict-<environment>-db psql -U verdict -d verdict -c '\password verdict_api'
     docker exec -it verdict-<environment>-db psql -U verdict -d verdict -c '\password verdict_web'
     ```
  3. Put the same value in the environment's matching secret: `VERDICT_API_DB_PASSWORD` for `verdict_api`, `VERDICT_WEB_DB_PASSWORD` for `verdict_web`.
  4. Run the environment's last deploy again. Until it finishes, connections the app already holds keep working, but new ones fail.

### Moving the database to a new image
A deploy leaves the running database and backup containers as they are. To move them to the image of the environment's current version, for example after Dependabot updates `config/db/Dockerfile`'s base image, remove them on the server and run the environment's last deploy again, which starts them from its image. The data folder stays. The site is down until the deploy has started the database, so pick a quiet moment:

```bash
docker rm -f verdict-<environment>-backup verdict-<environment>-db
```

A change to the backup scripts alone needs only the backup container removed, with no downtime. A new Postgres major version needs an upgrade of the data, not just a new image.

## If a secret leaks
Rotate it at its source first, then:
- **App secrets** (`BETTER_AUTH_SECRET`, `ANTHROPIC_API_KEY`, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`): update the environment secret and run the environment's last deploy again.
- **The api and web roles' passwords:** follow [rotating a role's password](#the-deployed-database).
- **`POSTGRES_PASSWORD`:** set the new one on the server with `docker exec -it verdict-<environment>-db psql -U verdict -d verdict -c '\password verdict'`, then update the secret. Postgres reads the variable only when it creates the database.
- **`CLOUDFLARE_TUNNEL_TOKEN`:** a deploy leaves a running tunnel as it is. Update the secret, remove the tunnel container on the server (`docker rm -f verdict-<environment>-tunnel`), then run the deploy again, which starts it with the new token. The site is down in between.
- **The deploy key** (`KAMAL_SSH_PRIVATE_KEY`): make a new key pair, replace the deploy user's `authorized_keys` on the server, then update the secret.
- **The backup storage's credentials:** replace them in the server's `config.json` ([backups](#backups)), then revoke the old ones. WAL-G reads the file on every run, so nothing needs restarting.
- **The backup encryption key:** put a new one in `config.json`, then take a full backup at once (`docker exec verdict-<environment>-backup db-backup.sh`). Keep the old key until the backups made with it have aged out after 30 days: restoring a moment from before the change needs it.

## Running Kamal by hand
Deploys run in CI. For logs or a one-off look, a maintainer on the private network can run Kamal from a checkout: run `bundle install`, export `KAMAL_HOST`, point SSH at the deploy key as `deploy.yml` does, then for example run `bundle exec kamal app logs -c config/deploy.api.yml -d staging -r worker-ingestion`. Commands that deploy or boot need every secret in `.kamal/secrets-common`, so leave those to CI.

## Backups
Staging's and production's databases are archived continuously with WAL-G ([ADR 0011](adr/0011-hosting-kamal.md)), so each can be restored to any minute of the last 30 days. Previews have no backups.
- **Continuous:** the database image's `archive_command` sends each finished write-ahead log (WAL) segment to object storage at a provider other than the server's. `archive_timeout` finishes a segment at least every minute, so a lost server loses at most about a minute of writes.
- **Nightly:** the backup accessory (`config/db/bin/db-schedule.sh`) takes a full backup at 03:00 UTC. It keeps the newest 31 and deletes older ones along with the WAL only they needed. On a new database, it takes the first one straight away.
- **Monthly check:** on the 1st, before that night's backup, `db-check.sh` restores the latest full backup into a scratch folder and replays the archived WAL past a point it has just written to the live database. It then reads every table back and compares the migration revision. It runs on the server, so student data never reaches CI.
- **Alerts:** each successful backup and check pings a heartbeat URL, so monitoring alerts when one fails or doesn't run.
- **Encrypted:** WAL-G encrypts everything with libsodium before it uploads it.
- **Settings stay on the server,** in `/etc/verdict/<environment>/wal-g/`, never in GitHub or CI. Both accessories mount the folder read-only. It must exist before the database first starts, or archiving fails and WAL piles up on the server's disk. The folder (mode 500) and its files (mode 400) belong to uid 999, Postgres's user in the image:
  - `config.json`: WAL-G's settings, `WALG_S3_PREFIX`, `AWS_ENDPOINT`, `AWS_REGION`, `AWS_S3_FORCE_PATH_STYLE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `WALG_LIBSODIUM_KEY` (`openssl rand -hex 32`) and `WALG_LIBSODIUM_KEY_TRANSFORM` (`hex`);
  - `heartbeats.json`: `{"backup": "<url>", "restore_check": "<url>"}`.
- **Keep a copy of the encryption key off the server,** as the private hosting runbook describes. Without it, the backups can't be read.

### Restoring to a chosen minute
For example, after a bad migration or a mistaken delete. These steps run on the server; times are UTC.
1. Pick the moment just before the damage, such as `2026-10-28 14:05:00+00`. `docker exec verdict-<environment>-backup wal-g backup-list` lists the full backups, and the moment must come after the oldest one finished.
2. Stop the apps, the backup container and the database, so nothing writes during the restore:

   ```bash
   docker stop $(docker ps -q --filter label=destination=<environment>) verdict-<environment>-backup verdict-<environment>-db
   ```
3. Keep the current data, and give the database an empty folder:

   ```bash
   sudo mv /var/lib/verdict/<environment>/postgres /var/lib/verdict/<environment>/postgres.before-restore
   sudo install -d -o 999 -g 999 -m 700 /var/lib/verdict/<environment>/postgres
   ```
4. Restore with the database's own image. Its log ends with the last transaction it replayed. The copy then continues on a new timeline, which later backups and restores follow.

   ```bash
   docker run --rm --user postgres \
     --volume /var/lib/verdict/<environment>/postgres:/var/lib/postgresql \
     --volume /etc/verdict/<environment>/wal-g:/etc/wal-g:ro \
     "$(docker inspect --format '{{.Config.Image}}' verdict-<environment>-db)" \
     db-restore.sh '2026-10-28 14:05:00+00'
   ```
5. Start the database and the backup container, take a full backup on the new timeline, then run the environment's last deploy again to start the apps:

   ```bash
   docker start verdict-<environment>-db verdict-<environment>-backup
   until docker exec verdict-<environment>-db pg_isready -q -U verdict; do sleep 2; done
   docker exec verdict-<environment>-backup db-backup.sh
   ```
6. Once the restored data looks right, delete `postgres.before-restore`.

After losing the server, restore the same way on the new one with `latest` instead of a time, before the first deploy starts the database. Recreate the settings folder from the copies kept off the server first.

## Secrets and variables
- **Development:** `.env`, which git ignores. [`.env.example`](../.env.example) documents the names.
- **Staging and production:** GitHub environment secrets and variables, passed to Kamal through `.kamal/secrets-common` at deploy time. Only the jobs that declare an environment can read its values. The backup settings are the exception: they stay on the server ([backups](#backups)).

Never put secrets in code, logs, issues or screenshots. `deploy.yml` passes the app secrets to Kamal; keep its list and `.kamal/secrets-common` in sync with this table.

| Name | Kind | Environments | Purpose |
| --- | --- | --- | --- |
| `APP_URL` | variable | staging, production | Base URL for the deployment link and the smoke test |
| `KAMAL_HOST` | secret | staging, production, preview | The server's address on the private network, kept out of the repository |
| `TS_OAUTH_CLIENT_ID`, `TS_AUDIENCE` | secret | staging, production, preview | The federated identity that lets this environment's deploy job (`preview.yml` for preview) join the private network. GitHub's token proves the job, so no long-lived key is stored |
| `KAMAL_SSH_PRIVATE_KEY`, `KAMAL_SSH_KNOWN_HOSTS` | secret | staging, production, preview | SSH as the deploy user, whose key works only from the private network, with the server's host key pinned. Previews have a key of their own, so it can be revoked alone |
| `CLOUDFLARE_TUNNEL_TOKEN` | secret | staging, production | The environment's tunnel, which Kamal runs and which carries its web traffic, so the server has no open web ports |
| `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | secret | staging, preview | Service token for the smoke test past the access gate (each environment has its own) |
| `BETTER_AUTH_SECRET` | secret | staging, production, preview | Signs sign-in sessions (`openssl rand -base64 32`) |
| `POSTGRES_PASSWORD`, `VERDICT_API_DB_PASSWORD`, `VERDICT_WEB_DB_PASSWORD` | secret | staging, production, preview | The database superuser's and the api and web roles' passwords (`openssl rand -hex 32`). `.kamal/secrets-common` builds the api's `DATABASE_URL` from them |
| `ANTHROPIC_API_KEY` | secret | staging, production, preview, evals, evals-pr | The platform's AI key. Previews share staging's; the eval environments get their own, with a low spend limit set at the provider |
| `AI_DAILY_SPEND_LIMIT_USD` | variable | staging, production, preview | The platform's daily AI spend cap in that environment; for preview, per slot |
| `OPENAI_API_KEY` | secret | evals, evals-pr | A second AI provider for the eval runs |
| `EVALS_REPO` (variable), `EVALS_REPO_TOKEN` (secret) | both | evals, evals-pr | The private evaluation set, with a read-only token |
| `EVALS_SPEND_LIMIT_USD` | variable | evals, evals-pr | Cost cap for one eval run |

Later specs add Google sign-in (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `AUTH_DATABASE_URL` for the web role), a bucket for files (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) and error reporting (`SENTRY_DSN`). Each joins `deploy.yml`, `.kamal/secrets-common`, its Kamal config and this table when its code does.

`evals` accepts only `main`, for nightly and on-demand runs. Pull request evals use `evals-pr`, which waits for the maintainer's approval ([ADR 0013](adr/0013-ai-review-coderabbit.md)).

## Monitoring
- **Health:** `GET /api/health` on the web app reports web, the API, the database and storage, plus the running version and commit. The smoke test and the every-minute uptime checks use it.
- **Backups:** the nightly backup and the monthly restore check each ping a heartbeat when they succeed, and monitoring alerts on a missed one ([backups](#backups)).
- **Errors, traces and logs:** errors are reported with personal data scrubbed, every AI call and workflow step emits an OpenTelemetry trace, and logs are structured JSON with a request ID and never personal data or file contents.
