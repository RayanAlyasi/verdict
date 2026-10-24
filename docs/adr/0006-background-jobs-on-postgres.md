# 0006. Background jobs on Postgres (Procrastinate)

- Status: Superseded by [0010](0010-stack-revised.md) (still on Postgres; DBOS replaces Procrastinate)
- Date: 2026-10-22

## Context
Ingestion, generation, verification and video rendering take seconds to minutes and must survive restarts.

## Decision
Use Procrastinate, a Postgres-backed queue: no extra broker to run, jobs enqueued in the same transaction as their data, retries, scheduling and per-queue concurrency. Separate queues and worker pools for ingestion, generation, verification, media and maintenance.

## Consequences
One less moving part and no lost jobs. If throughput ever exceeds what Postgres handles comfortably, move the busiest queue to a dedicated broker behind the same interface.
