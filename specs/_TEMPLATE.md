# NNN. Feature name

- Status: Draft | Ready | In progress | Done
- Phase: 0 to 4 · Issue: #
- Designs: `../verdict-internal/design/screens/...` (the private design repository)

## Problem and goal
Who is this for, what are they struggling with, and what can they do when this ships? One paragraph.

## User flow
Numbered steps from the student's point of view, phone first. Note desktop differences.

## UI and states
For each screen or component: layout, copy (follow `verdict-voice`), and every state: empty, loading, partial, error, success. Interaction states and motion per `docs/UX-GUIDELINES.md`. Arabic notes.

## Data and API
New or changed tables (and which module owns them), endpoints (method, path, request, response, errors), background jobs, events streamed to the UI.

## AI behaviour (if any)
Inputs, prompts' intent, grounding and citations, verification steps, fallback, evals to add.

## Security and privacy
Authorization rules, input limits, data retention, anything sensitive.

## Acceptance criteria
Testable statements. Each becomes at least one test.
- [ ] ...

## Test plan
Unit, integration, end-to-end journeys, accessibility, evals.

## Out of scope
What we are deliberately not doing now.
