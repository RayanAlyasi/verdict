---
description: Run the code and UI reviewers on the current branch, then fix what they find
---

1. Use the `code-reviewer` subagent on the current branch against its spec.
2. If any files under `apps/web` changed, use the `ui-reviewer` subagent too.
3. If any AI code changed (prompts, generation, retrieval, verification), use the `ai-quality-checker` subagent.
4. Summarise all **Blocking** and **Should fix** findings as a checklist, fix them, and re-run the relevant checks.
5. Finish with a pull request description using `.github/pull_request_template.md`.
