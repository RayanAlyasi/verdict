# 0007. Pull request previews on Coolify

- Status: Superseded by [0011](0011-hosting-kamal.md)
- Date: 2026-10-22

## Context
Reviewers should see a change running before it merges. Vercel's free plan is for non-commercial use and would only preview the web app, on a different runtime from production.

## Decision
Use Coolify preview deployments through its GitHub App: each pull request gets its own URL and a status comment, previews use their own environment variables, and pull requests from forks don't deploy unless the author is a member. Previews run with `APP_ENV=preview`: demo sign-in (Google sign-in needs fixed URLs), the fake AI provider, and a throwaway database seeded with the demo course. CI also attaches phone and desktop screenshots (English and Arabic) to pull requests that change the UI.

## Consequences
Previews match production's runtime and cost nothing extra. Previews never hold production secrets or real student data.
