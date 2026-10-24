# Security policy

Verdict holds students' accounts and their course materials, so we take security reports seriously and thank everyone who makes them.

## Reporting a vulnerability
Please **don't** open a public issue. Report privately through [GitHub's private vulnerability reporting](https://github.com/RayanAlyasi/verdict/security/advisories/new) (Security tab → Report a vulnerability). Include:
- what you found, and where;
- steps to reproduce it, or a proof of concept;
- the impact you expect.

## What to expect
- **Acknowledgement** within 3 days, and an initial assessment within 7 days.
- **Updates** as we work on a fix, and a coordinated disclosure date agreed with you.
- **Credit** in the security advisory, if you'd like to be named.

Please give us a reasonable time to fix an issue before you disclose it. We won't take legal action against research that follows this policy, avoids privacy violations and service disruption, and only uses accounts you own or have permission to test.

## Supported versions
Verdict has no release yet, so fixes land on `main`. After the first release, only the latest release receives security fixes.

## Scope
**In scope:**
- the web app and the API, including authentication and file uploads;
- the AI pipeline, including prompt injection that leaks data or bypasses safeguards;
- this repository's CI/CD.

**Out of scope:**
- social engineering;
- volumetric denial of service;
- vulnerabilities in third-party services we don't control.

## Leaked secrets
If you find a credential in this repository or its history, report it privately as above. Maintainers rotate it immediately ([runbook](docs/SECURITY-ARCHITECTURE.md#if-a-secret-leaks)).

[docs/SECURITY-ARCHITECTURE.md](docs/SECURITY-ARCHITECTURE.md) describes how Verdict is secured.
