# 0001. Modular monolith

- Status: Accepted
- Date: 2026-10-22

## Context
Verdict starts with one maintainer and grows with open-source contributors. It needs clear boundaries (ingestion, AI generation, practice, memory), single-transaction consistency for study data, and easy self-hosting, without the operational cost of many services.

## Decision
Two deployables, `apps/web` (Next.js) and `services/api` (FastAPI, plus workers from the same image), sharing one Postgres. Inside the API, modules own their tables and expose small interfaces; cross-module table access is forbidden and checked in review.

## Consequences
Simple local development, one database to back up, easy refactoring. Any module can become its own service later if measured load requires it. Discipline at module boundaries is required.
