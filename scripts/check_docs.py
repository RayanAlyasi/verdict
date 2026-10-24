#!/usr/bin/env python3
"""Check that the docs still match the repository.

- Every relative link and heading anchor in the tracked Markdown files resolves.
- Every secret and variable the workflows read is listed in docs/DEPLOYMENT.md.

Usage: python3 scripts/check_docs.py
Standard library only. Prints each problem and exits 1 if there are any.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FENCE = re.compile(r"^(```|~~~).*?^\1", re.MULTILINE | re.DOTALL)
INLINE_CODE = re.compile(r"`[^`\n]*`")
HEADING = re.compile(r"^#{1,6}\s+(.+?)\s*#*\s*$", re.MULTILINE)
LINK = re.compile(r"\]\(([^)\s]+)\)|(?:src|href)=\"([^\"]+)\"")
SCHEME = re.compile(r"^[a-z][a-z0-9+.-]*:", re.IGNORECASE)
WORKFLOW_SETTING = re.compile(r"\$\{\{\s*(?:secrets|vars)\.([A-Za-z0-9_]+)")
BUILT_IN = {"GITHUB_TOKEN"}


def slug(heading: str) -> str:
    """The anchor GitHub gives a heading."""
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", heading)
    text = re.sub(r"[`*]|<[^>]+>", "", text).strip().lower()
    return re.sub(r"[^\w\- ]", "", text).replace(" ", "-")


def heading_anchors(markdown: str) -> set[str]:
    anchors, seen = set(), {}
    for heading in HEADING.findall(FENCE.sub("", markdown)):
        base = slug(heading)
        count = seen.get(base, 0)
        seen[base] = count + 1
        anchors.add(base if count == 0 else f"{base}-{count}")
    return anchors


def broken_links(files: list[Path], root: Path) -> list[str]:
    problems = []
    for file in files:
        text = INLINE_CODE.sub("", FENCE.sub("", file.read_text()))
        for match in LINK.finditer(text):
            target = match.group(1) or match.group(2)
            if SCHEME.match(target):
                continue
            path, _, fragment = target.partition("#")
            dest = (file.parent / path).resolve() if path else file
            where = file.relative_to(root)
            if not dest.exists():
                problems.append(f"{where}: broken link {target}")
            elif (
                fragment
                and dest.suffix == ".md"
                and fragment not in heading_anchors(dest.read_text())
            ):
                problems.append(f"{where}: missing anchor {target}")
    return problems


def undocumented_settings(root: Path) -> list[str]:
    names = set()
    for workflow in sorted((root / ".github/workflows").glob("*.y*ml")):
        names |= set(WORKFLOW_SETTING.findall(workflow.read_text()))
    documented = (root / "docs/DEPLOYMENT.md").read_text()
    return [
        f"docs/DEPLOYMENT.md: `{name}` is read by a workflow but isn't listed"
        for name in sorted(names - BUILT_IN)
        if f"`{name}`" not in documented
    ]


def main() -> int:
    tracked = subprocess.run(
        ["git", "ls-files", "*.md"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.split()
    files = [ROOT / path for path in tracked]
    problems = broken_links(files, ROOT) + undocumented_settings(ROOT)
    for problem in problems:
        print(problem)
    if problems:
        return 1
    print(f"Docs OK: {len(files)} Markdown files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
