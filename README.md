<p align="center">
  <img src="docs/brand/banner.svg" alt="Verdict: know you're ready.">
</p>

<p align="center">The exam coach built from your own course materials.</p>

<p align="center">
  <a href="docs/PRODUCT.md">Product</a> ·
  <a href="docs/README.md">Documentation</a> ·
  <a href="docs/PRODUCT.md#roadmap">Roadmap</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="SECURITY.md">Security</a>
</p>

<p align="center">
  <a href="https://github.com/RayanAlyasi/verdict/actions/workflows/ci.yml"><img src="https://github.com/RayanAlyasi/verdict/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-AGPL--3.0--only-blue" alt="Licence: AGPL-3.0-only"></a>
</p>

> [!NOTE]
> Verdict is in early development and has no release yet. The product is designed and the foundation is being built; follow progress on the [roadmap](docs/PRODUCT.md#roadmap).

## About
Students reread slides and guess what will be on the exam. General chatbots answer without knowing the course, and unguarded AI help can even lower exam scores ([Bastani et al., PNAS 2025](https://doi.org/10.1073/pnas.2422633122)).

Verdict starts from the student's own slides, notes, textbook and past papers:
- **Grounded:** every explanation, question and diagram cites the slide or page it came from.
- **Exam-focused:** it learns what the professor emphasises and how they ask, and practice feels like the real paper.
- **Hints, not answers:** during practice the tutor nudges and shows one step at a time; it never gives the answer first.
- **Honest readiness:** readiness is measured only from work done without help.
- **For every student:** any major, on phone and desktop, in Arabic and English, with no prompting skills needed.

## Features
Planned for the first public release:
- **Course map:** topics extracted from the materials, each labelled by how likely it is to be examined, with its evidence and source.
- **Study sessions:** a daily plan aimed at each exam date, with explanations, visuals and step-by-step feedback.
- **Practice exams:** five exam styles, solved on screen or printed as a paper that looks like the real one.
- **Results and worked solutions:** every question marked step by step, with the full solution and a similar question to try.
- **Spaced review:** reviews planned backwards from the exam, and a notebook of mistakes and traps.
- **Shared courses:** a class sets a course up once and studies together.

The full list and the research behind each feature are in [docs/PRODUCT.md](docs/PRODUCT.md).

## Built with
Next.js and React for the web app, FastAPI and Python for the API, PostgreSQL with pgvector for data and search, and DBOS for background work. Deployed with Kamal. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Getting started
> [!IMPORTANT]
> [Spec 000](specs/000-foundation.md) is still being built: the web app shows a placeholder until the app shell lands.

Requirements: Node 26, pnpm 12 (`npm install -g pnpm@12.14.0`: Node 25 and later no longer include Corepack), Python 3.14, [uv](https://docs.astral.sh/uv/) and Docker.

```bash
cp .env.example .env                              # fill in the values marked required
docker compose up -d                              # Postgres with pgvector
pnpm install && uv sync --project services/api
pnpm dev                                          # web on localhost:3000, API on localhost:8000
```

[CONTRIBUTING.md](CONTRIBUTING.md) covers the git hooks, the checks and how to open a pull request.

## Documentation
| Document | What it covers |
| --- | --- |
| [Product](docs/PRODUCT.md) | Who Verdict is for, the features, the research behind them and the roadmap |
| [Architecture](docs/ARCHITECTURE.md) | Modules, the AI gateway, background work and data |
| [Deployment](docs/DEPLOYMENT.md) | Environments, releases, rollback and secrets |
| [Security architecture](docs/SECURITY-ARCHITECTURE.md) | Threats, controls and privacy |
| [UX guidelines](docs/UX-GUIDELINES.md) | Layout, interaction states, motion, accessibility and right-to-left |
| [All documentation](docs/README.md) | Testing, workflow, decision records, specs and brand |

## Contributing
Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), and look for issues labelled [`good first issue`](https://github.com/RayanAlyasi/verdict/labels/good%20first%20issue). Contributors sign the [Contributor License Agreement](CLA.md) once, on their first pull request. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security
Please report vulnerabilities privately through [GitHub's private vulnerability reporting](https://github.com/RayanAlyasi/verdict/security/advisories/new), never in a public issue. See [SECURITY.md](SECURITY.md).

## Licence and trademark
Copyright © 2026 Rayan Alyasi.

Verdict is free software under the [GNU Affero General Public License v3.0 only](LICENSE). You may use, modify, self-host and sell it. If you distribute Verdict, or run a modified version that other people use over a network, you must offer them its source code. Commercial licences for uses that the AGPL doesn't allow may be offered separately ([ADR 0009](docs/adr/0009-license-agpl-and-cla.md)).

The Verdict name and logo are trademarks and aren't covered by the AGPL. [TRADEMARK.md](TRADEMARK.md) explains how you may use them.
