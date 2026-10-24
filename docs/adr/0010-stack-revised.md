# 0010. Technology stack, revised

- Status: Accepted
- Date: 2026-10-23
- Supersedes: 0002; the provider adapter in 0005 (LiteLLM); the queue library in 0006 (Procrastinate)

## Context
ADR 0002 picked tools before checking versions, maintenance or fit. An October 2026 review found:
- **Outdated runtimes:** Node 22 ends in April 2027, at launch, and Python 3.12 only gets security fixes.
- **Weak libraries:** several were maintained by one person or abandoned.
- **A compromised dependency:** a LiteLLM release stole credentials in March 2026.
- **A licence risk:** PyMuPDF is AGPL.

## Selection rules
Every dependency must:
1. have a release in the last 6 months;
2. have at least 10 people committing in the last 6 months, measured with GitHub's API;
3. if one person does most of the work, be backed by a company or foundation, or be depended on industry-wide so it would be forked rather than abandoned;
4. be needed: no library where the platform or about 50 lines of our own code does the job.

Runtimes stay on supported (LTS) lines and move to a new LTS or major version within about 6 months of its release. Check dependencies against these rules every quarter.

## Decision
### Runtimes
| Runtime | Version | Supported until |
| --- | --- | --- |
| Node.js | 26 LTS | April 2029 |
| Python | 3.14 (move to 3.15 around spring 2027) | Security fixes to October 2030 |
| PostgreSQL | 18 with pgvector | November 2030 |
| TypeScript | 6 (move to 7 once lint and editor tooling support it) | |

### Web (`apps/web`)
| Concern | Choice | Runner-up |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 19, React Compiler | React Router 7, SvelteKit |
| Components | React Aria Components (Adobe), styled with Tailwind CSS 4 | shadcn/ui |
| Motion | Native CSS and the View Transitions API, no library | Motion |
| Translations | Lingui (ICU messages, including Arabic's six plural forms) | next-intl |
| API client | Orval-generated, using native `fetch` (build-time only) | Hey API |
| Maths display | KaTeX, rendered on the server | MathJax |
| Sign-in | Better Auth with Google. Sessions live in the Postgres `auth` schema. The api gets short-lived Ed25519 JWTs and verifies them against Better Auth's JWKS. | Authlib inside FastAPI |
| Module boundaries | ESLint's built-in `no-restricted-imports` | eslint-plugin-boundaries |
| Tests | Vitest Browser Mode (real Chromium), Playwright, axe-core | Testing Library on jsdom |

### API and workers (`services/api`)
| Concern | Choice | Runner-up |
| --- | --- | --- |
| Framework | FastAPI, Pydantic 2 | Litestar, Django |
| Data | SQLAlchemy 2, Alembic, psycopg 3, pgvector (our own ~30-line column type) | |
| Background work | DBOS: durable workflows and queues in Postgres | Procrastinate, Celery |
| AI providers | Pydantic AI (slim install, chosen providers only) inside `ai_gateway`; official Anthropic and OpenAI SDKs for the batch lane | any-llm, LiteLLM |
| Documents | Docling (PDF, PowerPoint with speaker notes, Word, images). A vision model through the `extract` role reads photos and scans. | PyMuPDF (AGPL) |
| Maths checks | SymPy, pint | |
| Spaced repetition | FSRS formulas in the `memory` module, tested against reference outputs | py-fsrs |
| Token checks | PyJWT | |
| Evals | pydantic-evals | A custom runner |
| Module boundaries | A pytest that fails when a module imports another module's internals | import-linter |
| Tooling | uv, Ruff, mypy, pytest | |

### Repository tooling
- **pnpm**, with `minimumReleaseAge` set so new package versions wait before they can be installed.
- **Dependabot** with a cooldown on version updates; security updates are not delayed.
- **No Turborepo:** there is one JavaScript package.

### Not added until a measurement shows the need
- **Caching and search:** Redis or Valkey (only as the shared Next.js cache once more than one web instance runs), a search engine, a vector database.
- **Web libraries:** a state-management library, a form library, an icon library, a date library.

## Consequences
- **Fewer dependencies,** and every remaining one has a team or company behind it.
- **Batch lane:** Pydantic AI has no batch support, so the gateway keeps two small batch adapters.
- **Sign-in:**
  - Better Auth gives the web app one data responsibility: the `auth` schema, reached with its own database role.
  - The api never holds a signing secret.
- **Resumable work:** DBOS checkpoints each step, so a crash resumes after the last finished step and paid AI steps never run twice.
- **Ingestion weight:** Docling is heavier than single-format readers. It runs only in the ingestion worker pool.
- **Before building:**
  - Run Docling on 20 real course files, including Arabic PDFs, measuring accuracy and seconds per page.
  - Prove every Python dependency installs on 3.14.

## Revisit when
- A dependency fails the selection rules at the quarterly check.
- FastAPI's maintenance stalls. Routes are thin, so moving to Litestar is mechanical.
- pgvector lags a new Postgres major, or a course passes about 100,000 chunks.
- TypeScript 7's editor support and lint tooling are ready.
