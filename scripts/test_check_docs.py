"""Tests for check_docs.py. Run: python3 -m unittest discover -s scripts"""

import tempfile
import unittest
from pathlib import Path

from check_docs import broken_links, heading_anchors, slug, undocumented_settings


class AnchorTest(unittest.TestCase):
    def test_matches_github_anchors(self) -> None:
        cases = {
            "Getting started": "getting-started",
            "Issues, labels and milestones": "issues-labels-and-milestones",
            "0009. Licence: AGPL-3.0": "0009-licence-agpl-30",
            "`ci-ok` and **checks**": "ci-ok-and-checks",
            "See [ADR 0011](adr/0011.md)": "see-adr-0011",
        }
        for heading, expected in cases.items():
            with self.subTest(heading=heading):
                self.assertEqual(slug(heading), expected)

    def test_numbers_repeated_headings_and_skips_code_blocks(self) -> None:
        markdown = "## Setup\n## Setup\n```\n## Not a heading\n```\n"
        self.assertEqual(heading_anchors(markdown), {"setup", "setup-1"})


class CheckTest(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = tempfile.TemporaryDirectory()
        self.root = Path(self.dir.name)
        (self.root / "docs").mkdir()
        (self.root / ".github/workflows").mkdir(parents=True)

    def tearDown(self) -> None:
        self.dir.cleanup()

    def test_reports_missing_files_and_anchors(self) -> None:
        (self.root / "docs/A.md").write_text("# Title\n## Part one\n")
        readme = self.root / "README.md"
        readme.write_text(
            "[ok](docs/A.md#part-one) [gone](docs/B.md) [bad](docs/A.md#part-two)\n"
            '[web](https://example.org) `[code](nope.md)` <img src="logo.svg">\n'
        )
        self.assertEqual(
            broken_links([readme], self.root),
            [
                "README.md: broken link docs/B.md",
                "README.md: missing anchor docs/A.md#part-two",
                "README.md: broken link logo.svg",
            ],
        )

    def test_reports_workflow_settings_missing_from_deployment_doc(self) -> None:
        (self.root / ".github/workflows/deploy.yml").write_text(
            "env:\n  A: ${{ secrets.LISTED }}\n  B: ${{ vars.MISSING }}\n  C: ${{ secrets.GITHUB_TOKEN }}\n"
        )
        (self.root / "docs/DEPLOYMENT.md").write_text("| `LISTED` | secret |\n")
        self.assertEqual(
            undocumented_settings(self.root),
            ["docs/DEPLOYMENT.md: `MISSING` is read by a workflow but isn't listed"],
        )


if __name__ == "__main__":
    unittest.main()
