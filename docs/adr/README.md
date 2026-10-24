# Architecture decision records

Short records of decisions that are expensive to reverse. Add one when you make such a decision; never edit an accepted record, supersede it with a new one.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-modular-monolith.md) | Modular monolith: one web app, one API, Postgres | Accepted |
| [0002](0002-stack.md) | Technology stack | Superseded by 0010 |
| [0003](0003-environments-and-deployment.md) | Three environments, image promotion, approval gate | Accepted (hosting tool superseded by 0011) |
| [0004](0004-ai-grounding-and-verification.md) | Grounding and verification of all AI output | Accepted |
| [0005](0005-ai-gateway-and-byok.md) | AI gateway, hosted credits and bring-your-own-key | Accepted (provider adapter superseded by 0010) |
| [0006](0006-background-jobs-on-postgres.md) | Background jobs on Postgres (Procrastinate) | Superseded by 0010 |
| [0007](0007-pull-request-previews.md) | Pull request previews on Coolify | Superseded by 0011 |
| [0008](0008-architecture-evaluation.md) | Architecture evaluation: modular monolith with an isolated sandbox (weighted) | Accepted |
| [0009](0009-license-agpl-and-cla.md) | Licence: AGPL-3.0 with a Contributor License Agreement | Accepted |
| [0010](0010-stack-revised.md) | Technology stack, revised: selection rules, runtimes, libraries | Accepted |
| [0011](0011-hosting-kamal.md) | Hosting: Kamal deploys, Postgres with point-in-time recovery | Accepted |
| [0012](0012-ci-cd-and-automation.md) | CI/CD, repository settings and automation | Accepted (AI review superseded by 0013) |
| [0013](0013-ai-review-coderabbit.md) | AI pull request review: CodeRabbit | Accepted |

Template: [0000-template.md](0000-template.md)
