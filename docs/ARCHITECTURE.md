# Architecture

**A modular monolith with a pluggable AI gateway.** Verdict has:
- **two deployable programs,** web and api;
- **one Postgres database;**
- **strictly enforced module boundaries;**
- **one place where every AI call is routed, paid for, metered and checked.**

That keeps Verdict safe for students, cheap on AI credits, simple to run and self-host, and ready to move from hosted AI to bring-your-own-key with any provider ([ADR 0001](adr/0001-modular-monolith.md), [ADR 0005](adr/0005-ai-gateway-and-byok.md)). The stack and hosting are recorded in [ADR 0010](adr/0010-stack-revised.md) and [ADR 0011](adr/0011-hosting-kamal.md).

## Why a monolith
Microservices would add network failures, duplicated data and distributed debugging without a benefit Verdict needs; the weighted evaluation is in [ADR 0008](adr/0008-architecture-evaluation.md). Strict module boundaries keep a later split incremental.

## System overview
```
Browser (phone / desktop)
   │ HTTPS through Cloudflare, one domain
   ├──► apps/web ── Next.js 16: server-rendered pages, Better Auth sign-in, link previews
   │       │ server-side calls carry the user's short-lived JWT
   │       ▼
   └──► services/api ── FastAPI at /api/v1: all data and business logic, organised as modules
           │   the browser calls it directly for uploads, study sessions and live progress (SSE)
           │   verifies JWTs against Better Auth's public keys (JWKS); holds no signing secret
           │   └── ai_gateway module: the only code that talks to AI providers (Pydantic AI)
           │
           ├── workers (same image, one Kamal role per queue): ingestion · generation · verification · media
           │      └── verification sends untrusted code to ─► sandbox (Phase 3): no secrets, no DB, no network
           ├── Postgres 18 + pgvector: module tables, `auth` schema (Better Auth only), DBOS workflows and queues, usage ledger
           └── Object storage: uploads and generated media (local in dev, S3-compatible in staging and production)
```

## Modules and boundaries
- **Each module owns its tables** and exposes a small public interface, `verdict/<module>/api.py`.
- **Other modules import only that interface.** A pytest in CI fails the build when one module imports another module's internals.
- **In the web app,** ESLint's `no-restricted-imports` keeps `components/ui` free of feature code.

| Module | Owns | Public interface (examples) |
| --- | --- | --- |
| `identity` | users, settings | `get_user`, `update_settings` |
| `courses` | courses, exams, members | `create_course`, `add_exam`, `assert_member` |
| `ingestion` | sources, pages, chunks | `add_source`, `chunks_for` |
| `course_map` | topics, ideas, relevance | `build_map`, `topic_for` |
| `professor` | profiles, traps | `profile_for` |
| `ai_gateway` | credentials, usage ledger, model registry | `complete`, `stream`, `embed`, `submit_batch`, `budget_for` |
| `generation` | generated items (questions, pages, videos, games) | `generate`, `get_item` |
| `verification` | verification runs | `verify` |
| `practice` | sessions, attempts, exams, results | `start_session`, `grade` |
| `memory` | review states (FSRS), mistakes | `due_reviews`, `record_attempt` |
| `readiness` | readiness snapshots | `readiness_for` |

Rules:
- A module never queries another module's tables.
- Cross-module calls are plain function calls, never internal HTTP.
- Work triggered by a write is enqueued as a DBOS workflow in the same transaction as the write.
- Scheduling, grading and readiness are pure functions inside their modules, with no database or network access, so they can be fully unit-tested.
- `identity` creates a user's row on their first authenticated request, from the JWT's claims. The `auth` schema belongs to Better Auth in the web app, and no api module reads it.

## The AI gateway
Every AI call in Verdict goes through `ai_gateway`. Nothing else imports a provider SDK.

1. **Task roles, not model names.** Code asks for a role: `extract`, `generate`, `tutor`, `verify`, `embed`. The **model registry** (`verdict/ai_gateway/registry.toml`) maps roles to models per provider, with each model's capabilities (structured output, vision, context size, caching style, batch support) and prices.
2. **Credential resolution.** Who pays depends on `DEPLOYMENT_MODE`:
   - `hosted` (feedback phase): platform keys from the secret store, with per-student budgets.
   - `byok` (full release): the student's own key, stored with envelope encryption (a per-credential data key encrypted by a master key held outside the database). It's decrypted only in worker memory at call time, never sent to the browser and never logged.
   - `self_hosted`: keys from the server's environment; local models through Ollama.
3. **Provider adapters** through Pydantic AI (Anthropic, OpenAI, Google and any OpenAI-compatible service such as OpenRouter or Ollama). It handles provider quirks such as explicit cache breakpoints. The batch lane calls the official Anthropic and OpenAI SDKs directly.
4. **Budgets before spending.**
   - Each call's estimated tokens and cost are reserved in one atomic step against the student's daily token limit and the platform's daily spend cap, so parallel jobs can't overspend.
   - Estimates are upper bounds, so the real figures never push the ledger past a limit: all input tokens at the model's highest input rate (cache writes cost more than plain input), plus the maximum output.
   - The usage ledger row (user, course, feature, model, tokens, cache hits, cost) then replaces the reservation with the real figures. A call the provider rejected releases its reservation; one that may have been billed (a timeout or a broken stream) settles at its estimate.
   - The student's token limit counts every token a call reads or writes, cached ones included.
   - Limits reset at 00:00 UTC. A reservation counts only against its own day, so one left behind by a crashed worker clears at the reset.
   - Over budget: degrade to a cheaper model or queue the job for batch, with a plain message to the student.
5. **Output contracts.** All structured outputs are validated against Pydantic schemas, with one repair attempt, so changing provider never breaks the app.
6. **Certified models.** The eval set (pydantic-evals) runs per model; only models that pass are offered in bring-your-own-key mode.
7. **Tracing.** Every call and workflow step emits an OpenTelemetry trace with its model, token counts, timings and usage-ledger row, but never prompt or answer text, which comes from students' work.

### Grounding (what goes into a prompt)
- **Whole course in the prompt** when the course is under about 150,000 tokens. Course-map building and exam-wide work put the entire course in the cached prompt prefix, with page and slide markers for citations.
- **Retrieval otherwise,** for per-topic work and larger courses. Each chunk gets a short generated context before it is embedded and indexed. Keyword and vector search are fused.
  - Add a reranker only if evals show retrieval misses.
- **Embeddings:** one model that handles Arabic and English in the same space, chosen by evals.

### Cost design
- **Prompt caching:** prompts are built static-first: instructions, then the course's shared context, then the student-specific part last. Course context is shared by everyone in a batch, so cache hits compound.
- **Batch lane:** non-urgent work uses discounted batch APIs: tomorrow's study session, pre-generated practice exams, nightly flashcards, solution walkthrough scripts. Caching and batching discounts stack.
- **Generate once, share:** a generated item's key is a hash of the prompt version, the model and the source chunks. Items are reused within a course and never regenerated.
- **No paying twice:** DBOS checkpoints every workflow step, so a crash after a paid step resumes after it.
- **Right-sized models:** cheap fast models for extraction and grading steps; strong models only where quality needs it.

## Background work
- **DBOS** runs durable workflows and queues inside Postgres, with no separate broker. A DBOS SQL function enqueues a workflow atomically with the data it belongs to.
- **Steps are checkpointed,** with per-step retries and backoff, per-queue concurrency and rate limits, and scheduled workflows.
- **Queues:** `ingestion`, `generation`, `verification`, `media` (CPU-heavy video rendering) and `maintenance`.
- **Progress** reaches the UI through Postgres `LISTEN/NOTIFY` and then server-sent events, with no polling.

## The sandbox service (Phase 3)
- **What it is:** the only deliberately separate service. It runs and tests AI-generated interactive diagrams and games in a headless browser inside a locked-down container.
- **Lockdown:** no environment secrets, no database credentials, no outbound network, a read-only filesystem, CPU and memory limits, and a hard timeout per job.
- **How it's used:** the `verification` worker sends it the code and spec, and it returns test results and screenshots.
- **Uploaded files** are parsed in the `ingestion` worker pool, with timeouts and memory limits.
- **No URL fetching in v1.** If added later, outbound requests go through an egress proxy to prevent server-side request forgery.

## Data and performance
### Database
- **Keys:** UUIDv7 primary keys (`uuidv7()` is built into Postgres 18). They're time-ordered, so new rows land at the end of the index instead of scattering across it.
- **Tenant key:** `course_id` is on every course-scoped table, and course-scoped indexes start with it. A student's work never crosses courses, so sharding by course stays possible later.
- **Indexes:** every foreign key is indexed. Hot queries get partial indexes, for example due reviews on `(user_id, due_at) WHERE active`.
- **Vectors:** stored as `halfvec`, which halves the storage. Search is exact within one course, giving perfect recall in milliseconds at thousands of chunks. Add HNSW indexes (with pgvector 0.8 filtered scans) only if a course passes about 100,000 chunks.
- **Hybrid search:** one SQL query combines Postgres full-text search (with `arabic` and `english` configurations) and vector search, merged by reciprocal rank fusion.
- **Write-time updates:** readiness and review state update when an attempt is saved, at constant cost per answer, instead of being recalculated from history on page load.
- **Scale path, each step only when measured:**
  1. a bigger VM;
  2. PgBouncer 1.21 or newer, which handles prepared statements in transaction mode;
  3. a read replica;
  4. monthly partitions for the usage ledger and attempts;
  5. sharding by `course_id`.

### Web
- **Less JavaScript:**
  - Public and read-only pages are server-rendered or static, and browser JavaScript ships only for interactive parts. Shared links get real link previews.
  - KaTeX renders maths on the server, so no maths JavaScript reaches the browser.
- **No waiting between questions:** a study session loads all its questions at the start, without answers, and grades in the background.
- **The globe is drawn on one `<canvas>`,** with a glow image prepared once. It pauses off screen, and on low-memory devices it shows fewer points.
- **Animation:** only `transform` and `opacity` animate. View Transitions drive page changes.
- **Caching:**
  - Cloudflare caches hashed static files for a year.
  - Readex Pro is trimmed to its Latin and Arabic characters.
  - A single web instance caches on disk. Valkey becomes the shared Next.js cache only when several instances run.
- **Budgets:** in `docs/UX-GUIDELINES.md`.

### Not added until a measurement shows the need
- **Infrastructure:** Redis, a search engine, a vector database, Kubernetes, microservices.
- **Web libraries:** a state-management library, a form library, an icon library (about 20 inline SVGs), a date library (Python `zoneinfo` and the browser's `Intl`).

## Deployment modes
- **One image, three modes,** chosen by `DEPLOYMENT_MODE`:
  - `hosted`: we run it with our keys;
  - `byok`: we run it with students' keys;
  - `self_hosted`: anyone runs it on their own server.
- **Feature flags live in settings,** not code forks.
- **Environments** (development, staging, production): [DEPLOYMENT.md](DEPLOYMENT.md).

## When to split something out
Split only with evidence: a module needs independent scaling (the `media` worker is likely first), a different runtime, or a separate team. The module boundary and its public interface make the split a contained change.

## Technology
See [ADR 0010](adr/0010-stack-revised.md) and [ADR 0011](adr/0011-hosting-kamal.md). Repository layout after spec 000:
```
apps/web/           Next.js app (app/, components/, lib/, e2e/)
services/api/       FastAPI app: verdict/<module>/, migrations/, tests/, evals/
config/             Kamal deploy configuration; db/ creates the database roles
docs/ specs/ scripts/ .claude/ .github/
```
