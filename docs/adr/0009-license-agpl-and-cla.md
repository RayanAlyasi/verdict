# 0009. Licence: AGPL-3.0 with a Contributor License Agreement

- Status: Accepted
- Date: 2026-10-23

## Context
Verdict is open source and runs as a network service: hosted by us, and self-hosted by universities and others. Two needs pull on the licence:
- Anyone should be able to use, study, self-host and improve Verdict.
- Nobody should be able to take it, improve it and run it as a closed service competing with the project, and we want to keep the option to make money from it.

What comparable projects use:

| Licence | Projects |
| --- | --- |
| AGPL-3.0 | Canvas LMS, Open edX, Anki, Plausible, Grafana, Mastodon, Nextcloud |
| GPL | Moodle (v3), Discourse (v2) |
| MIT or Apache | Ghost, Cal.com, Supabase |
| Licences that aren't open source | Sentry, n8n, Dify, Open WebUI |

## Decision
- **Code is licensed under the GNU Affero General Public License, version 3 only (`AGPL-3.0-only`).**
  - Anyone may use, modify, self-host and sell Verdict.
  - Anyone who runs a modified version for other people, including over a network, must offer those users the full source of that version.
  - All current dependencies are MIT, Apache or BSD licensed, which is compatible.
- **Contributions require the Verdict Individual Contributor License Agreement (`CLA.md`).**
  - It's based on the Apache Software Foundation ICLA v2.2.
  - It grants the Maintainer copyright and patent licences, including the right to sublicense under other terms, such as commercial licences.
  - It promises contributors that their contributions always remain available under AGPL.
  - The Maintainer may assign it to a successor organisation.
- **Signing:**
  - Contributors sign once by commenting a fixed sentence on their pull request.
  - `cla.yml` records each signature on the `cla-signatures` branch, keyed by GitHub account ID.
  - The required `cla` check verifies the signature. Bots and the repository owner are exempt.

## Alternatives
| Option | Why not |
| --- | --- |
| MIT | Anyone could run a closed, improved Verdict as a competing service. Nobody would ever need a commercial licence. |
| AGPL with a Developer Certificate of Origin | Contributors keep exclusive control of relicensing, so commercial licences could cover only code the Maintainer wrote. |
| `AGPL-3.0-or-later` | The CLA already lets the project move to a later version if needed, without handing that choice to a third party. |
| CLA Assistant (GitHub Action or SAP's hosted service) | The Action is archived. The hosted service has one active maintainer, which fails ADR 0010's rules. A 60-line in-repo workflow does the job, and the records stay in the repository. |

## Consequences
- **Money:** the project can offer hosting, support, closed enterprise features and commercial licences. Competitors can't build a closed service on our code.
- **Self-hosting:** universities can still self-host freely. They share source only if they modify Verdict and serve it to others.
- **Fewer corporate users:** some companies avoid AGPL entirely (Google reportedly bans it internally), and some contributors won't sign a CLA.
- **Source link in the app:** Verdict will link to its own source code from the app, configurable for self-hosted copies. That makes AGPL compliance automatic for anyone running an unmodified or published fork.
- **Trademark:** the name and logo are covered by [TRADEMARK.md](../../TRADEMARK.md), not the AGPL. Forks can copy the code, but not the name.
- **Organisations:** contributions made on behalf of an organisation need a separate agreement, so they're handled case by case.

## Revisit when
- A company asks to contribute (add a corporate CLA).
- The project moves to an organisation (assign the CLA to it).
- The CLA text changes materially (decide whether earlier signers must sign again).
