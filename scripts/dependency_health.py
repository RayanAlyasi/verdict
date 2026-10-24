#!/usr/bin/env python3
"""Check Verdict's direct dependencies against ADR 0010's maintenance rules.

Reads apps/web/package.json and services/api/pyproject.toml, finds each package's source
repository, and checks: a release in the last 6 months, and at least 10 people committing in
the last 6 months. A repository where one person makes most commits is flagged for review.
Prints a Markdown report. Exits 1 if any dependency fails and isn't an accepted exception.

Usage: GH_TOKEN=... python3 scripts/dependency_health.py
Standard library only (Python 3.11 or later), so it runs on any CI runner without installing anything.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
import tomllib
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

RELEASE_WINDOW_DAYS = 183
ACTIVITY_WINDOW_DAYS = 180
MIN_ACTIVE_PEOPLE = 10
TOP_SHARE_REVIEW = 0.8
MAX_COMMIT_PAGES = 5

# ADR 0010 rule 3.
EXCEPTIONS = {
    "fastapi/fastapi": "Company-backed (FastAPI Labs); a thin layer over Starlette and Pydantic",
    "pgvector/pgvector": "Shipped by every major cloud's managed Postgres",
    "jpadilla/pyjwt": "Depended on across the Python ecosystem",
}

# Packages whose registry entry doesn't link to their GitHub repository.
REPOSITORY_OVERRIDES = {
    "dbos": "dbos-inc/dbos-transact-py",
}

ROOT = Path(__file__).resolve().parent.parent
TODAY = dt.datetime.now(dt.UTC)
# Owner and repository from a GitHub link, skipping sponsor and organization pages.
GITHUB_REPO = re.compile(
    r"github\.com[/:](?!(?:sponsors|orgs)/)([\w.-]+)/([\w.-]+?)(?:\.git)?(?:[/#?]|$)"
)


def get_json(url: str, token: str | None = None) -> object | None:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "verdict-dependency-health",
        },
    )
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise


def parse_time(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value)


def npm_package(name: str) -> tuple[str | None, dt.datetime | None]:
    data = get_json(f"https://registry.npmjs.org/{urllib.parse.quote(name, safe='@')}")
    if not isinstance(data, dict):
        return None, None
    repository = data.get("repository") or {}
    url = repository.get("url", "") if isinstance(repository, dict) else str(repository)
    latest = data.get("dist-tags", {}).get("latest")
    released = data.get("time", {}).get(latest) if latest else None
    return url, parse_time(released) if released else None


def pypi_package(name: str) -> tuple[str | None, dt.datetime | None]:
    data = get_json(f"https://pypi.org/pypi/{name}/json")
    if not isinstance(data, dict):
        return None, None
    info = data.get("info", {})
    urls = list((info.get("project_urls") or {}).values()) + [
        info.get("home_page") or ""
    ]
    url = next((u for u in urls if u and GITHUB_REPO.search(u)), None)
    files = data.get("urls") or []
    released = files[0].get("upload_time_iso_8601") if files else None
    return url, parse_time(released) if released else None


def activity(repo: str, token: str) -> tuple[int, float, str]:
    since = (TODAY - dt.timedelta(days=ACTIVITY_WINDOW_DAYS)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    authors: list[str] = []
    for page in range(1, MAX_COMMIT_PAGES + 1):
        commits = get_json(
            f"https://api.github.com/repos/{repo}/commits?since={since}&per_page=100&page={page}",
            token,
        )
        if not isinstance(commits, list) or not commits:
            break
        for commit in commits:
            author = (commit.get("author") or {}).get("login") or commit["commit"][
                "author"
            ]["name"]
            if not author.endswith("[bot]"):
                authors.append(author)
    if not authors:
        return 0, 0.0, "-"
    top, count = Counter(authors).most_common(1)[0]
    return len(set(authors)), count / len(authors), top


def direct_dependencies() -> list[tuple[str, str]]:
    deps: list[tuple[str, str]] = []
    package_json = ROOT / "apps/web/package.json"
    if package_json.exists():
        manifest = json.loads(package_json.read_text())
        for section in ("dependencies", "devDependencies"):
            deps += [("npm", name) for name in manifest.get(section, {})]
    pyproject = ROOT / "services/api/pyproject.toml"
    if pyproject.exists():
        project = tomllib.loads(pyproject.read_text())
        requirements = list(project.get("project", {}).get("dependencies", []))
        for group in project.get("dependency-groups", {}).values():
            requirements += [r for r in group if isinstance(r, str)]
        deps += [
            ("pypi", re.match(r"[A-Za-z0-9._-]+", r).group(0)) for r in requirements
        ]
    return deps


def main() -> int:
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        print("GH_TOKEN is required to read GitHub activity.", file=sys.stderr)
        return 2
    deps = direct_dependencies()
    if not deps:
        print("No dependency manifests yet; nothing to check.")
        return 0

    repos: dict[str, list[str]] = {}
    released: dict[str, dt.datetime] = {}
    unresolved: list[str] = []
    for registry, name in deps:
        url, release = (npm_package if registry == "npm" else pypi_package)(name)
        if name in REPOSITORY_OVERRIDES:
            url = f"https://github.com/{REPOSITORY_OVERRIDES[name]}"
        match = GITHUB_REPO.search(url or "")
        if not match:
            unresolved.append(f"{name} ({registry})")
            continue
        repo = f"{match.group(1)}/{match.group(2)}".lower()
        repos.setdefault(repo, []).append(name)
        if release and (repo not in released or release > released[repo]):
            released[repo] = release

    rows, failed = [], 0
    for repo, names in sorted(repos.items()):
        active, share, top = activity(repo, token)
        release = released.get(repo)
        problems = []
        if not release or (TODAY - release).days > RELEASE_WINDOW_DAYS:
            problems.append("no release in 6 months")
        if active < MIN_ACTIVE_PEOPLE:
            problems.append(f"only {active} people active")
        if repo in EXCEPTIONS:
            status = f"accepted: {EXCEPTIONS[repo]}"
        elif problems:
            status, failed = "**fail**: " + "; ".join(problems), failed + 1
        elif share >= TOP_SHARE_REVIEW:
            status = "review: one person makes most commits; check who backs it"
        else:
            status = "pass"
        last = release.date().isoformat() if release else "unknown"
        rows.append(
            f"| {repo} | {', '.join(sorted(names))} | {last} | {active} | {share:.0%} ({top}) | {status} |"
        )

    print(f"## Dependency health, {TODAY.date().isoformat()}\n")
    print(
        f"Rules (ADR 0010): a release in the last 6 months; at least {MIN_ACTIVE_PEOPLE} people committing in the last {ACTIVITY_WINDOW_DAYS} days.\n"
    )
    print(
        "| Repository | Packages | Last release | Active people | Top person's share | Result |"
    )
    print("| --- | --- | --- | --- | --- | --- |")
    print("\n".join(rows))
    if unresolved:
        print(
            f"\nNo GitHub repository found for: {', '.join(unresolved)}. Check these by hand."
        )
    print(f"\n{failed} failing, {len(rows) - failed} passing or accepted.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
