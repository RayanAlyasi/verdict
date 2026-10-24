# 0011. Hosting: Kamal deploys, Postgres with point-in-time recovery

- Status: Accepted
- Date: 2026-10-23
- Supersedes: 0007, and the hosting tool (Coolify) in 0003. Image promotion and the approval gate from 0003 still stand.

## Context
ADR 0003 assumed Coolify. Checked against Verdict's needs, Coolify falls short in four ways:
- **Security:** it runs a beta dashboard with root Docker access on the production server. It disclosed 11 critical vulnerabilities in late 2025 and two more in 2026, rated 9.9 and 8.8.
- **Backups:** it backs up Postgres only with `pg_dump`, so there is no point-in-time recovery.
- **Config:** settings live in its own database instead of git.
- **Maintenance:** 91% of commits in the last 6 months came from one person.

## Decision
- **Deploys:** Kamal 2 (37signals, MIT licence) deploys the images CI built.
  - GitHub Actions runs it over SSH through the Cloudflare Tunnel, so no ports are open and no dashboard runs on the server.
  - Config lives in `config/deploy.api.yml` and `config/deploy.web.yml` (one Kamal service per image), each with `staging` and `production` destinations. The api deploys first, so migrations run before the web app relies on them.
  - Each process type is one Kamal role: web, api, and one worker role per queue.
- **Promotion (as in 0003):**
  - Merging to `main` deploys `sha-<commit>` to staging.
  - A GitHub Release deploys the same image to production after approval.
  - `kamal rollback <version>` restores an earlier version.
- **Servers:** cloud VMs. CI builds images for the servers' CPU architecture on GitHub's native runners.
- **Database:** Postgres 18 with pgvector.
  - WAL-G (Apache 2.0) archives database changes continuously to object storage at another provider. That allows restoring to any minute.
  - A full backup runs nightly.
  - A monthly job on our own servers restores the latest backup and checks it, and a missed or failed check alerts. Student data never goes to CI runners.
- **Monitoring:** uptime checks run outside the app servers, so alerts still go out when production is down.
- **No server-side pull request previews.** CI attaches English and Arabic screenshots at phone and desktop width to every UI pull request, and staging updates on every merge.

## Alternatives
| Option | Why not now |
| --- | --- |
| Coolify | See Context. |
| Dokploy | Healthier maintenance (40 active contributors), but the same model: a dashboard on the server, `pg_dump` backups, config outside git. |
| Kubernetes (k3s, Argo CD, CloudNativePG) | Failover needs 3 or more servers, and Kubernetes has no LTS, so it needs upgrading every year. |
| A managed platform with managed Postgres | Costs money, and fewer regions fit. |

## Consequences
- **Reviewable infrastructure:** changes go through pull requests, and the setup can be rebuilt from the repo.
- **Small attack surface:** the server runs only SSH (reached through the tunnel), Docker, kamal-proxy and our containers.
- **Bounded data loss:** at most about a minute of data is lost, and restores are proven every month.
- **No automatic failover:** a dead VM means minutes of downtime while it's replaced. That's accepted for the feedback phase.
- **Lost:** one-click pull request previews.

## Revisit when
- **Students pay, or an uptime promise is made:** move to managed Postgres with automatic failover.
- **The fleet grows:** at 3 or more servers, autoscaling on elastic capacity, or universities asking for a Helm chart, reconsider Kubernetes. We can publish a Helm chart either way.
- **Previews are missed:** add a label-triggered Kamal preview, which is one workflow.
