# 0004. Grounding and verification of AI output

- Status: Accepted
- Date: 2026-10-22

## Context
Students must be able to trust every explanation and question. Research shows unguarded AI help can lower exam scores.

## Decision
All generated content is grounded in the student's own materials and carries source anchors. Generated items pass a verification pipeline before display: specification checked against sources, generation, sandboxed execution for interactive code, automated tests, truth checks, and independent review by a second model; failures regenerate or fall back to a simpler format. During practice the tutor gives hints, never answers; readiness counts only unassisted work. An evaluation set gates changes to AI behaviour.

## Consequences
Higher generation latency and cost, offset by caching and sharing within a course. Trust becomes a measurable property (citation accuracy, flag rate).
