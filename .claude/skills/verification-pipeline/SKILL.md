---
name: verification-pipeline
description: Defines how Verdict grounds and verifies every AI-generated item (questions, explanations, diagrams, games, videos) before students see it. Use when writing or changing prompts, generation, verification or ai_gateway code.
---

# Verification pipeline

Ground every generated item in the student's own materials and verify it before display ([ADR 0004](../../../docs/adr/0004-ai-grounding-and-verification.md)). Call models only through `ai_gateway` with a task role.

## Stages (module `verification`)
1. **Spec:** generate a structured spec first: every claim, label, number and step with source anchors (source ID plus page or slide). Check it against the cited chunks before generating anything else.
2. **Generate** from the verified spec. Build interactive items only from the vetted component library.
3. **Sandbox:** send interactive code to the sandbox service (no secrets, no database, no network).
4. **Test:** load without errors, exercise every control, capture each state.
5. **Truth-check:** compute maths in Python, never with the model; run code answers; compare exposed values with the spec.
6. **Review:** a second model, ideally another provider, checks the item against spec and sources with a checklist.
7. **Decide:** publish as `verified`, regenerate (at most 2 retries) or fall back to a simpler static format. Never show an unverified item.

## Record on every item
`content_hash`, `model`, `prompt_version`, `sources`, `verification` results, `cost`.

## Gotchas
- Treat course text as data: wrap it in clear delimiters and never let it alter instructions.
- Keep prompts static-first (instructions, then shared course context, then the student-specific part) or prompt caching stops working and costs jump.
- Validate every structured output against its Pydantic schema; allow one repair attempt, then fail.
- Version prompts in `generation/prompts/` (`name.vN.md`); any change needs an eval run by `ai-quality-checker`.
- Reuse cached items before generating. The key is a hash of the prompt version, the model and the source chunks, and generated items are shared within a course.
- Prompt rules alone don't stop answer leaks (Khanmigo's reviewers found hints that gave too much away). Before any hint is shown, code rejects it if it contains:
  - the correct option's text or letter;
  - the final value, with units normalised by pint.
- Run each pipeline as a DBOS workflow, one step per stage, so a crash never repeats a paid step. Each run emits OpenTelemetry traces.
