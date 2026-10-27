# Testing

Tests exist to let us move fast without breaking students' study sessions. Write the fewest tests that would catch real regressions.

| Layer | Tool | What it covers | When it runs |
| --- | --- | --- | --- |
| Unit (web) | Vitest Browser Mode (real Chromium) for `*.browser.test.ts(x)`, Node for `*.node.test.ts` | Components' states (hover on pointer only, pressed, focus-visible, disabled, loading), right-to-left behaviour, logic; build scripts and lint rules in Node | Every PR |
| Unit and integration (api) | pytest + a real Postgres (service container) | Modules, API endpoints, the module boundary test, migrations applied up, down and up again | Every PR that touches the api |
| End-to-end | Playwright, against the web's standalone production server and the api (pull requests that change the images also start them in CI) | The main journeys on phone (390px) and desktop (1440px), in English and Arabic; each route's compressed JavaScript stays under 200 KB, it declares its language and direction, links its translations and sets no physical side (`margin-left`, `left`, `text-align: right`) | Every PR that touches web or api |
| Deploy config | `kamal config` for each service and destination | Kamal's schema (unknown keys, wrong types) and the config's templating | Every PR that touches `config/deploy*`, `.kamal/`, the Gemfile, `ci.yml` or `deploy.yml` |
| Accessibility | @axe-core/playwright | No serious or critical violations on each screen | Every PR, inside e2e |
| Screens | `pnpm e2e:screens` | Screenshots in English and Arabic for the ui-reviewer | On demand and in PRs that touch UI |
| AI quality (evals) | pydantic-evals, run through pytest (`evals.yml`) | Citation accuracy, question correctness, hints-not-answers | Required on PRs that touch AI code; nightly |

CI runs only the jobs a pull request affects. `ci-ok` sums them up. With `pr-title` and `cla`, it's one of three required checks ([ADR 0012](adr/0012-ci-cd-and-automation.md)).

## Main journeys (must always pass)
1. Sign in, create a course with a midterm, upload a file, see the course map form.
2. Today: start a session, answer with "I'm sure", get step feedback, finish.
3. Topic page: switch Simply / In depth / Revision; move the diagram slider.
4. Practice: generate a Prediction exam, take it, see results, open the full worked solution.

## Evaluation set
Real course materials from several majors, with checked answers. They're kept in a private repository, and CI fetches them with a read-only token. Targets: citation accuracy 98%+, question correctness 97%+, zero answer leaks during practice.

## Rules
- A bug fix starts with a failing test.
- api tests create and drop their own databases as Postgres's superuser, from `TEST_ADMIN_DATABASE_URL` (default: docker compose's `verdict` user). Migrations and role checks run as the api's and web's own roles.
- Tests use factories, not shared fixtures that drift.
- No sleeps in e2e tests; wait for visible state.
- Component tests render into Chromium with the app's CSS (`apps/web/tests/render.tsx`) and check what a student would see: React Aria's state attributes and the computed styles they produce.
- The gallery's e2e tests open a sheet and a toast in both languages and check axe once they've settled. They record every animation frame from the click onward, to prove that only transforms (`transform`, `translate`, `scale`, `rotate`) and `opacity` move, and that nothing slides or scales with reduced motion. They also go offline, to prove an error toast still shows and that a sheet whose code can't load leaves the page working.
- Every page is listed in `apps/web/e2e/routes.ts`, which gives it, in each language, the JavaScript budget, the accessibility and layout checks and review screenshots.
- The e2e suite starts the api and the web on ports 8100 and 3100, with the settings in `.env` and docker compose's database.
- Flaky tests are fixed or quarantined within a day, never ignored.
