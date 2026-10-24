# 0008. Architecture evaluation: modular monolith with an isolated sandbox

- Status: Accepted (refines 0001)
- Date: 2026-10-22

## Context
Verdict is open source and will be self-hosted; it starts hosted on our AI credits and moves to bring-your-own-key with any provider. One student action (answering a question) updates attempts, review schedules, mistakes and readiness together. It runs very different workloads (quick page requests, long AI generations, CPU-heavy video rendering) and will execute AI-generated interactive code that nobody has reviewed.

## Options weighed (weights 1 to 5, scores 1 to 5)
| Criterion | Weight | Modular monolith | Microservices |
| --- | --- | --- | --- |
| Data consistency across features | 5 | 5 | 2 |
| Self-hosting by students and universities | 5 | 5 | 1 |
| Security isolation of untrusted code and uploads | 5 | 5 (with sandbox) | 5 |
| Scaling different workloads independently | 4 | 4 | 5 |
| Evolving a product whose boundaries are still forming | 4 | 5 | 2 |
| Fault isolation | 4 | 4 | 5 |
| AI cost efficiency (shared caching, budgets) | 3 | 4 | 4 |
| Contributor onboarding | 3 | 5 | 2 |
| Response speed | 3 | 5 | 3 |
| Independent team deploys | 1 | 2 | 5 |
| **Weighted total (max 185)** | | **171** | **120** |

Evidence: Fowler's MonolithFirst (successful microservice systems almost always started as monoliths split once boundaries were stable); Shopify's modular monolith; Amazon Prime Video consolidating a distributed system into one process; Dify (open-source AI platform) running api and workers from one image while isolating code execution in a sandbox; Sentry's microservice self-hosted edition needing 16 GB RAM minimum and being intended for low volume.

## Decision
A modular monolith run as several process types from one codebase:
- `web` (Next.js) and `api` (FastAPI) as described in ARCHITECTURE.md;
- `worker` pools from the api image, one per queue (`ingestion`, `generation`, `verification`, `media`), scaled and restarted independently, so a crash in video rendering never stops studying;
- one deliberately separate **sandbox** service (from Phase 3) that executes and tests AI-generated interactive code with no secrets, no database access and no outbound network. It receives work from the verification queue and returns results only.

## Consequences
Single-transaction consistency for study data, easy self-hosting (web, api, worker, sandbox, Postgres), fast refactoring while the product evolves, and strong isolation where the threat is real.

## Revisit when
Separate teams own separate domains; a module needs scaling a worker pool can't provide; the AI gateway is shared with other products; or measurements show one module dominating resources. Module boundaries (enforced by import-linter) keep any extraction contained.
