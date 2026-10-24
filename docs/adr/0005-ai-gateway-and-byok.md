# 0005. AI gateway, hosted credits and bring-your-own-key

- Status: Accepted; provider adapter (LiteLLM) superseded by [0010](0010-stack-revised.md)
- Date: 2026-10-22

## Context
In the feedback phase Verdict pays for AI, so cost control and abuse prevention matter. Later, students bring their own key for any provider, or self-host. Swapping providers must not change product code, and keys must be safe.

## Decision
One `ai_gateway` module is the only code that calls AI providers. It routes by task role through a model registry, resolves credentials by deployment mode (hosted, byok, self_hosted), stores student keys with envelope encryption, enforces budgets before calls, records every call in a usage ledger, validates outputs against schemas, and offers only models that pass the eval set. Prompts are structured for provider prompt caching; non-urgent work uses batch APIs.

## Consequences
Provider changes are configuration plus an eval run. Costs are visible per user and feature. The gateway is a critical path: it gets the strictest tests and review.
