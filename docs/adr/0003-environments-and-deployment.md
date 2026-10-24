# 0003. Environments and deployment

- Status: Accepted; hosting tool (Coolify) superseded by [0011](0011-hosting-kamal.md)
- Date: 2026-10-22

## Context
We need safe releases with very little operations work, on existing cloud VMs, deployed with Coolify behind a tunnel.

## Decision
Development, staging and production. CI builds Docker images once per commit to `main`, pushes them to GitHub Container Registry and deploys them to staging. Production promotes the exact tested image when a GitHub Release is published, after manual approval in the protected `production` environment. Rollback retags a previous version. The repository is public so environment approvals are available on the free plan.

## Consequences
What runs in production has already run in staging. Releases are deliberate. Migrations must be backward compatible to keep rollback safe.
