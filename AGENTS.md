# AGENTS.md

Instructions for AI coding agents working on Verdict, an exam coach built from a student's own course materials. Read `docs/PRODUCT.md` once per task if you need product context. Keep this file short; details live in `docs/`.

The review agents (`.claude/agents/`), skills (`.claude/skills/`) and commands (`.claude/commands/`) are plain Markdown. Agents that don't load them automatically should read the relevant skill before UI, copy or AI work.

## Commands
- `pnpm dev`: web (3000) and api (8000) with hot reload. `docker compose up -d` first.
- `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm e2e`: web checks.
- `uv run --directory services/api ruff check . && uv run --directory services/api mypy . && uv run --directory services/api pytest`: api checks.
- `pnpm e2e:screens`: Playwright screenshots at 390px and 1440px, English and Arabic, into `artifacts/screens/`.

## How we work (always)
1. Every feature starts from a spec in `specs/`. No spec, no code. Use `/spec` to write one.
2. Explore and plan before editing. List the files you will touch and the tests you will add.
3. Make the smallest change that meets the spec. Do not add abstractions the spec does not need. Validate only at system boundaries.
4. Comment only a non-obvious why: a constraint, trade-off or source. No comments that restate the code, narrate the change or label sections.
5. Before using a library API or adding a package, read the docs for the version in the lockfile and confirm the package exists.
6. Run the checks yourself until they pass, and show the output. Never claim something works without running it.
7. Update or delete every doc the change makes wrong, in the same PR.
8. Before opening a PR, run `/review` (code-reviewer and ui-reviewer subagents) and fix what they find.
9. One feature per branch (`<type>/<short-description>`) and PR. The PR title is a Conventional Commit, `type(scope): summary`: imperative, lowercase, no full stop, 72 characters at most. It becomes the squash commit on `main`. The body gives the problem, why this approach, what you ran and its result, and the risks; don't restate the diff, and claim only what you checked. Full rules in `docs/WORKFLOW.md`.

## Architecture rules
- Modular monolith: `apps/web` (UI and sign-in only, no business logic) and `services/api` (all data and AI). See `docs/ARCHITECTURE.md`.
- Stack, versions and hosting are fixed by ADR 0010 and ADR 0011. Check any new dependency against ADR 0010's selection rules.
- API modules own their tables and expose `verdict/<module>/api.py`. Import only that from other modules; the boundary test fails CI otherwise.
- Only the `ai_gateway` module talks to AI providers. Ask for a task role (`extract`, `generate`, `tutor`, `verify`, `embed`), never a model name. Respect budgets; never log keys or prompts with personal data.
- Long work goes to DBOS workflows and queues, never inside a request. Stream progress over SSE.
- The API contract is OpenAPI generated from FastAPI; the web client is generated from it. Never hand-write API types.
- Every user-facing claim, question and diagram must cite its source. AI output goes through the verification pipeline (skill: `verification-pipeline`).
- During practice the tutor gives hints, never answers. Readiness is computed only from unassisted work.

## UI rules
- Follow `docs/UX-GUIDELINES.md` and the approved designs in `../verdict-internal/design/` (the maintainers' private design repository, cloned next to this one; without it, work from the spec and the UX guidelines). Use the `verdict-design-system` skill for tokens and components.
- Mobile-first. Every screen must work at 360px wide and look right at 1440px.
- Every interactive element has hover (pointer devices), pressed, focus-visible, disabled and loading states, with motion from the motion tokens. Respect `prefers-reduced-motion`.
- Animate only `transform` and `opacity`. Touch targets at least 44px.
- Copy follows the `verdict-voice` skill. Arabic layouts mirror (use logical CSS properties).

## Never
- Commit secrets or read `.env` files. Use `.env.example` for names only.
- Disable a failing test or lint rule to make CI pass.
- Add a dependency without saying why in the PR.
- Reference a GitHub Action by tag. Pin the full commit SHA with the version in a comment (zizmor and a repository setting enforce it).
- Add AI attribution anywhere: no co-author trailers, "generated with" lines or similar in commits, PRs, issues, comments or release notes.
- Push to `main` or bump version fields in `package.json`/`pyproject.toml`. Changes land through PRs; the release tag is the version.
