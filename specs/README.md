# Specs

Every feature is built from a spec. A spec is the contract between the person deciding and the person (or agent) building: what, why, how it looks, how we know it's done.

## How to write one
Run the `/spec <feature name>` command (`.claude/commands/spec.md`). It interviews you and writes `specs/NNN-name.md` from [_TEMPLATE.md](_TEMPLATE.md). Review it, commit it, then build from it.

## Order of work
| Spec | Feature | Phase | Status |
| --- | --- | --- | --- |
| [000](000-foundation.md) | Foundation: monorepo, tooling, design system in code, CI/CD to staging | 0 | Ready |
| [001](001-sign-in-and-course-setup.md) | Google sign-in, course and exams, file upload, ingestion with live progress | 1 | Ready |
| 002 | Course map: topics, ideas, exam-relevance labels, grounding and citations | 1 | To write |
| 003 | Today: readiness globe, verdict sentence, today's session plan | 1 | To write |
| 004 | Study session: questions, hint ladder, one-tap confidence, step feedback | 1 | To write |
| 005 | Topic page: explanation with visuals, Explain it switch, sources | 2 | To write |
| 006 | Spaced reviews (FSRS), calendar feed, mistake notebook | 2 | To write |
| 007 | Practice exams (five types), timed mocks, results | 2 | To write |
| 008 | Full worked solutions and solution videos | 2 | To write |
| 009 | Readiness per exam; professor profile | 2 | To write |
| 010 | Generate from topic: videos, flashcards, games, explain-it-back | 3 | To write |
| 011 | Ask Verdict (typed and spoken) | 3 | To write |
| 012 | Printable exam papers (PDF), Kahoot export, revision sheet | 3 | To write |
| 013 | Share a course with a batch | 3 | To write |
