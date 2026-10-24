"""Tests for dependency_health.py. Run: python3 -m unittest discover -s scripts"""

import unittest

from dependency_health import GITHUB_REPO


class GitHubRepoTest(unittest.TestCase):
    def test_finds_owner_and_repository_in_package_links(self) -> None:
        cases = {
            "https://github.com/pydantic/pydantic": ("pydantic", "pydantic"),
            "https://github.com/fastapi/fastapi/issues": ("fastapi", "fastapi"),
            "git+https://github.com/vercel/next.js.git": ("vercel", "next.js"),
            "git+ssh://git@github.com/colinhacks/zod.git": ("colinhacks", "zod"),
            "git@github.com:tailwindlabs/tailwindcss.git": (
                "tailwindlabs",
                "tailwindcss",
            ),
        }
        for url, expected in cases.items():
            with self.subTest(url=url):
                match = GITHUB_REPO.search(url)
                self.assertIsNotNone(match)
                self.assertEqual(match.groups(), expected)

    def test_ignores_github_links_that_are_not_repositories(self) -> None:
        # PyPI sorts project links by label, so a "Funding" link can come before "Source".
        for url in (
            "https://github.com/sponsors/samuelcolvin",
            "https://github.com/orgs/pydantic/discussions",
        ):
            with self.subTest(url=url):
                self.assertIsNone(GITHUB_REPO.search(url))


if __name__ == "__main__":
    unittest.main()
