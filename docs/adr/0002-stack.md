# 0002. Technology stack

- Status: Superseded by [0010](0010-stack-revised.md)
- Date: 2026-10-22

## Decision
| Concern | Choice | Why |
| --- | --- | --- |
| Web | Next.js (App Router), React, TypeScript strict | Mature, fast, great mobile performance tools |
| Styling | Tailwind CSS with tokens from `docs/brand/tokens.json`; shadcn/ui (Radix) primitives | Consistent, accessible components we own |
| Motion | Motion (motion.dev) | Springs, layout and shared-element transitions, reduced-motion support |
| Auth | Auth.js with Google | No passwords to store; one-tap sign-in |
| API | FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, managed with uv | Best ecosystem for documents, OCR and AI; typed and fast |
| Database | Postgres 16 + pgvector | Data, vector search and job queue in one place |
| AI access | LiteLLM, behind the `ai_gateway` module | Any provider or local model behind one interface (ADR 0005) |
| Background jobs | Procrastinate (Postgres) | No extra broker; transactional enqueue (ADR 0006) |
| Module boundaries | import-linter (Python), eslint-plugin-boundaries (web) | Boundaries enforced in CI, not by memory |
| Spaced repetition | FSRS (py-fsrs) | Proven, open algorithm |
| Testing | Vitest, pytest, Playwright, axe-core | Covers unit to accessibility |
| Monorepo | pnpm workspaces + Turborepo | Fast installs and cached tasks |

## Consequences
Two languages (TypeScript and Python), bridged by a generated OpenAPI client. Contributors need Node and Python; Docker covers the database.
