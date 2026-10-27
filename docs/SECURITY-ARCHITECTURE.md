# Security architecture

What Verdict protects, the main threats, and the controls in place. Keep this current when features change.

Verdict is designed and reviewed against [OWASP ASVS 5.0](https://asvs.owasp.org/) Level 2, the [OWASP Top 10:2025](https://owasp.org/Top10/2025/) and the [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/llm-top-10/). Its images meet [SLSA](https://slsa.dev/spec/v1.2/build-requirements) Build Level 2 through signed build provenance.

## What we protect
Students' accounts, uploaded course materials (which may include copyrighted or private content), study history, and our AI provider keys and infrastructure.

## Threats and controls
| Threat | Controls |
| --- | --- |
| Account takeover | Google sign-in only (no passwords stored); Better Auth sessions in httpOnly, Secure, SameSite=Lax cookies, revocable instantly; CSRF protection on mutations; the api accepts only short-lived Ed25519 JWTs verified against Better Auth's public keys and holds no signing secret |
| One user reading another's data | Every API query is scoped by user and course membership in the owning module; authorization tests for each endpoint; IDs are UUIDs |
| Malicious uploads | Type and size limits (50 MB per file), content-type sniffing, files stored outside the web root, served only through short-lived signed URLs; parsing runs in workers with timeouts |
| Prompt injection from course content | Course text is always treated as data, never instructions; system and user content kept separate; AI has no tools with side effects; outputs verified before display |
| Unsafe generated interactive code | Runs only in a sandboxed iframe (`sandbox="allow-scripts"`, no same-origin), strict CSP with no network access, automated tests before publishing |
| Cost abuse of AI | Per-user daily token limits and a platform-wide daily spend cap, reserved atomically so parallel jobs can't overspend; rate limits per IP and user; caching of generated content |
| Leaked secrets | Three layers: TruffleHog pre-commit hook, GitHub push protection, GitHub secret scanning of all history; secrets only in env vars and GitHub environment secrets, readable only by the jobs that declare that environment; no fallback secret values in code (services refuse to start without them) |
| Vulnerable dependencies | Lockfiles committed with hashes; new package versions wait before install (pnpm `minimumReleaseAge`, Dependabot cooldown; security fixes not delayed); dependency review blocks PRs adding known-vulnerable packages; CodeQL scans code; dependencies meet ADR 0010's maintenance rules |
| Supply chain in CI | Every action pinned to a full commit SHA (enforced by a repository setting; Dependabot updates the pins); zizmor audits workflows on every PR; the only third-party GitHub App with write access is CodeRabbit, installed on this repository alone and bound by the branch rules (ADR 0013); read-only workflow token by default and minimal `permissions` per job; checkout never persists credentials; workflows from outside contributors need approval; no secrets on fork PRs; shipped images built without caches and signed with build provenance (ADR 0012) |
| Compromised deploy tooling | Kamal keeps no dashboard or agent on the server; CI deploys over SSH on a private network, which only `deploy.yml` in a deploy environment can join, as a deploy user whose key works only from that network, with the host key pinned; web traffic arrives only through each environment's tunnel, so no web ports are open; Kamal installs from a lockfile whose checksums Bundler verifies |
| Data loss | WAL-G continuous archiving to encrypted off-site storage at another provider (restore to any minute, 30 days); restore proven by a monthly automated check |

## HTTP security headers
`Content-Security-Policy` (strict, nonce-based scripts), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (microphone only where the mic button is used), `frame-ancestors 'none'`.

## Privacy
- Collect the minimum: Google name, email and avatar; course materials the student uploads; study activity.
- Course materials are private to their owner and invited batch members.
- Students can export and delete their data; deleting a course removes its files and everything derived from it.
- Logs never contain file contents, answers or personal data beyond a user ID.
- AI providers are configured for zero data retention where available.

## If a secret leaks
1. Revoke and rotate the credential immediately at the provider.
2. Update it in GitHub environment secrets; redeploy with Kamal.
3. Check provider logs for misuse during the exposure window.
4. Remove it from git history if it was committed, then force-push only after the rotation (rotation is what actually fixes it).
5. Write a short incident note in the private security log.
