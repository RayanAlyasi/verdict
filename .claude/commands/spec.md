---
description: Interview me about a feature and write its spec in specs/
argument-hint: <feature name>
---

Write a spec for: $ARGUMENTS

1. Read `specs/_TEMPLATE.md`, `specs/README.md`, `docs/PRODUCT.md` and the related designs in `../verdict-internal/design/` (if cloned).
2. Interview me before writing. Ask a few focused questions at a time, covering: the user and their goal, the exact flow, every UI state (empty, loading, error, success), phone and desktop differences, data and API changes, AI behaviour and verification, security and privacy, edge cases, and what is out of scope. Challenge anything that adds complexity without clear user value.
3. When I say we're done, write `specs/NNN-<kebab-name>.md` using the next free number, following the template exactly. Acceptance criteria must be testable.
4. Show me the spec and a one-paragraph summary of the riskiest parts.
