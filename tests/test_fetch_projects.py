"""Tests for the data layer: python -m unittest discover -s tests"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))

import fetch_projects as fp  # noqa: E402


class TestDescriptionCleaning(unittest.TestCase):
    def test_plain_description_passes_through(self):
        self.assertEqual(fp.clean_description("A tiny CLI for tidying CSVs"), "A tiny CLI for tidying CSVs")

    def test_markdown_is_flattened(self):
        self.assertEqual(
            fp.clean_description("The **phone** half of `claude-remote`, see [docs](http://x.dev)"),
            "The phone half of claude-remote, see docs",
        )

    def test_empty_and_none_become_none(self):
        self.assertIsNone(fp.clean_description(None))
        self.assertIsNone(fp.clean_description("   "))
        self.assertIsNone(fp.clean_description("![badge](http://img.shields.io/x.svg)"))

    def test_long_text_is_cut_to_its_first_sentence(self):
        text = "First sentence here. " + ("padding " * 40)
        self.assertEqual(fp.clean_description(text), "First sentence here.")

    def test_abbreviations_do_not_end_the_sentence(self):
        text = "A parser for config files, e.g. TOML and YAML, with a friendly CLI. " + ("x" * 200)
        self.assertEqual(
            fp.clean_description(text),
            "A parser for config files, e.g. TOML and YAML, with a friendly CLI.",
        )

    def test_single_long_sentence_is_truncated_on_a_word_boundary(self):
        text = "A portfolio site " + "with filtering " * 20
        result = fp.clean_description(text)
        self.assertLessEqual(len(result), fp.DESCRIPTION_LIMIT)
        self.assertTrue(result.endswith("…"))
        self.assertFalse(result[:-1].endswith(" "))
        self.assertTrue(text.startswith(result[:-1].rstrip()))

    def test_custom_limit_is_respected(self):
        self.assertEqual(fp.clean_description("one two three four five", limit=12), "one two…")


class TestReadmeFallback(unittest.TestCase):
    README = """# claude-remote - dashboard

[![build](https://img.shields.io/badge/build-passing-green.svg)](https://ci.example)

The phone half of **claude-remote**: a small web app for queueing coding jobs
to the Claude Code runner on your desktop.

More prose that belongs to a second paragraph.

## Stack
"""

    def test_first_paragraph_after_the_title(self):
        self.assertEqual(
            fp.description_from_readme(self.README),
            "The phone half of claude-remote: a small web app for queueing coding jobs "
            "to the Claude Code runner on your desktop.",
        )

    def test_code_fences_and_comments_are_skipped(self):
        readme = """<!-- a comment
spanning lines -->
# Title

```bash
npm install
```

Real prose at last.
"""
        self.assertEqual(fp.description_from_readme(readme), "Real prose at last.")

    def test_lists_and_tables_are_not_prose(self):
        readme = "# Title\n\n- bullet one\n- bullet two\n\n| a | b |\n| - | - |\n"
        self.assertIsNone(fp.description_from_readme(readme))

    def test_missing_readme(self):
        self.assertIsNone(fp.description_from_readme(None))
        self.assertIsNone(fp.description_from_readme(""))


class TestLiveUrl(unittest.TestCase):
    def test_homepage_wins(self):
        repo = {"name": "thing", "homepage": "https://thing.dev", "has_pages": True}
        self.assertEqual(fp.derive_live_url(repo, "MOTOMOTO2"), ("https://thing.dev", "homepage"))

    def test_homepage_without_a_scheme_gets_https(self):
        repo = {"name": "thing", "homepage": "thing.dev/app"}
        self.assertEqual(fp.derive_live_url(repo, "MOTOMOTO2"), ("https://thing.dev/app", "homepage"))

    def test_junk_homepage_is_ignored(self):
        for junk in ("", "   ", "-", "not a url", "javascript:alert(1)"):
            self.assertIsNone(fp.normalise_homepage(junk), junk)

    def test_pages_url_is_derived_from_the_lowercased_login(self):
        repo = {"name": "Unity-Game", "homepage": None, "has_pages": True}
        self.assertEqual(
            fp.derive_live_url(repo, "MOTOMOTO2"),
            ("https://motomoto2.github.io/Unity-Game/", "pages"),
        )

    def test_user_site_repo_has_no_path_segment(self):
        repo = {"name": "motomoto2.github.io", "has_pages": True}
        self.assertEqual(
            fp.derive_live_url(repo, "MOTOMOTO2"),
            ("https://motomoto2.github.io/", "pages"),
        )

    def test_no_pages_and_no_homepage(self):
        self.assertEqual(fp.derive_live_url({"name": "x"}, "MOTOMOTO2"), (None, None))


class TestBuildProject(unittest.TestCase):
    repo = {
        "name": "super-octo-memory",
        "full_name": "MOTOMOTO2/super-octo-memory",
        "description": None,
        "language": "Python",
        "topics": ["memory", "cli"],
        "pushed_at": "2021-10-24T14:40:41Z",
        "created_at": "2021-10-24T14:00:00Z",
        "html_url": "https://github.com/MOTOMOTO2/super-octo-memory",
        "homepage": None,
        "has_pages": False,
        "stargazers_count": 3,
        "forks_count": 1,
        "fork": False,
        "archived": True,
        "private": False,
    }

    def test_fields_are_mapped(self):
        project = fp.build_project(self.repo, "MOTOMOTO2")
        self.assertEqual(project["name"], "super-octo-memory")
        self.assertEqual(project["language"], "Python")
        self.assertEqual(project["pushed_at"], "2021-10-24T14:40:41Z")
        self.assertEqual(project["topics"], ["cli", "memory"])
        self.assertEqual(project["stars"], 3)
        self.assertTrue(project["is_archived"])
        self.assertIsNone(project["live_url"])

    def test_description_source_is_recorded(self):
        self.assertEqual(fp.build_project(self.repo, "MOTOMOTO2")["description_source"], "none")

        from_readme = fp.build_project(self.repo, "MOTOMOTO2", readme_description="From the README.")
        self.assertEqual(from_readme["description"], "From the README.")
        self.assertEqual(from_readme["description_source"], "readme")

        with_github = dict(self.repo, description="Set on GitHub")
        project = fp.build_project(with_github, "MOTOMOTO2", readme_description="From the README.")
        self.assertEqual(project["description"], "Set on GitHub")
        self.assertEqual(project["description_source"], "github")

    def test_missing_language_is_null(self):
        self.assertIsNone(fp.build_project(dict(self.repo, language=None), "MOTOMOTO2")["language"])


class TestSelectAndBuildIndex(unittest.TestCase):
    def test_forks_can_be_excluded_and_disabled_repos_always_are(self):
        repos = [{"name": "a"}, {"name": "b", "fork": True}, {"name": "c", "disabled": True}]
        self.assertEqual([r["name"] for r in fp.select_repos(repos)], ["a", "b"])
        self.assertEqual([r["name"] for r in fp.select_repos(repos, exclude_forks=True)], ["a"])

    def test_index_is_sorted_by_last_push_descending(self):
        projects = [
            {"name": "old", "pushed_at": "2021-01-01T00:00:00Z", "live_url": None},
            {"name": "new", "pushed_at": "2026-10-01T00:00:00Z", "live_url": "https://x.dev"},
            {"name": "middle", "pushed_at": "2024-05-05T00:00:00Z", "live_url": None},
        ]
        index = fp.build_index(projects, login="MOTOMOTO2", generated_at="2026-10-08T00:00:00Z")
        self.assertEqual([p["name"] for p in index["projects"]], ["new", "middle", "old"])
        self.assertEqual(index["schema"], fp.SCHEMA_VERSION)
        self.assertFalse(index["stale"])
        self.assertEqual(index["generated_at"], "2026-10-08T00:00:00Z")

    def test_owner_falls_back_to_the_login_when_there_is_no_profile(self):
        index = fp.build_index([], login="MOTOMOTO2")
        self.assertEqual(index["owner"]["login"], "MOTOMOTO2")
        self.assertEqual(index["owner"]["html_url"], "https://github.com/MOTOMOTO2")
        self.assertIsNone(index["owner"]["avatar_url"])

    def test_profile_is_used_when_present(self):
        profile = {
            "login": "MOTOMOTO2",
            "name": "Moto",
            "html_url": "https://github.com/MOTOMOTO2",
            "avatar_url": "https://avatars.githubusercontent.com/u/1",
            "bio": "Builds **things**",
        }
        owner = fp.build_index([], login="MOTOMOTO2", profile=profile)["owner"]
        self.assertEqual(owner["name"], "Moto")
        self.assertEqual(owner["bio"], "Builds things")


class TestPagination(unittest.TestCase):
    def test_next_link_is_found(self):
        header = (
            '<https://api.github.com/user/repos?page=2>; rel="next", '
            '<https://api.github.com/user/repos?page=5>; rel="last"'
        )
        self.assertEqual(fp.next_page_url(header), "https://api.github.com/user/repos?page=2")

    def test_last_page_has_no_next(self):
        self.assertIsNone(fp.next_page_url('<https://api.github.com/user/repos?page=1>; rel="prev"'))
        self.assertIsNone(fp.next_page_url(None))


class TestStaleFallback(unittest.TestCase):
    def test_existing_file_is_marked_stale(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "projects.json")
            fp.write_index(fp.build_index([], login="MOTOMOTO2"), path)
            self.assertTrue(fp.mark_existing_stale(path))
            with open(path, encoding="utf-8") as handle:
                self.assertTrue(json.load(handle)["stale"])

    def test_missing_file_cannot_be_marked(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertFalse(fp.mark_existing_stale(os.path.join(directory, "nope.json")))


class TestCli(unittest.TestCase):
    def test_defaults(self):
        args = fp.parse_args([])
        self.assertEqual(args.user, os.environ.get("PROJECT_INDEX_USER", fp.DEFAULT_USER))
        self.assertEqual(args.output, fp.DEFAULT_OUTPUT)
        self.assertFalse(args.include_private)

    def test_flags(self):
        args = fp.parse_args(["--user", "octocat", "--output", "out.json", "--exclude-forks", "--no-link-check"])
        self.assertEqual(args.user, "octocat")
        self.assertEqual(args.output, "out.json")
        self.assertTrue(args.exclude_forks)
        self.assertTrue(args.no_link_check)


class TestCollectAgainstAFakeApi(unittest.TestCase):
    """collect() end to end with the HTTP layer stubbed out."""

    def setUp(self):
        self.profile = {"login": "MOTOMOTO2", "name": "Moto", "html_url": "https://github.com/MOTOMOTO2"}
        self.repos = [
            {
                "name": "with-pages",
                "full_name": "MOTOMOTO2/with-pages",
                "description": None,
                "language": "TypeScript",
                "pushed_at": "2026-10-01T00:00:00Z",
                "html_url": "https://github.com/MOTOMOTO2/with-pages",
                "has_pages": True,
            },
            {
                "name": "dead-pages",
                "full_name": "MOTOMOTO2/dead-pages",
                "description": "Has a stale Pages flag",
                "language": "Python",
                "pushed_at": "2026-09-01T00:00:00Z",
                "html_url": "https://github.com/MOTOMOTO2/dead-pages",
                "has_pages": True,
            },
        ]
        self._saved = (fp.fetch_profile, fp.fetch_repos, fp.fetch_readme, fp.url_is_live)
        fp.fetch_profile = lambda user, token=None: self.profile
        fp.fetch_repos = lambda user, token=None, include_private=False: list(self.repos)
        fp.fetch_readme = lambda full_name, token=None: "# T\n\nRead from the README.\n"
        fp.url_is_live = lambda url, timeout=8.0: "dead" not in url

    def tearDown(self):
        fp.fetch_profile, fp.fetch_repos, fp.fetch_readme, fp.url_is_live = self._saved

    def test_collect_builds_the_whole_document(self):
        index = fp.collect("MOTOMOTO2", quiet=True)
        self.assertEqual([p["name"] for p in index["projects"]], ["with-pages", "dead-pages"])

        live, dead = index["projects"]
        self.assertEqual(live["live_url"], "https://motomoto2.github.io/with-pages/")
        self.assertEqual(live["description"], "Read from the README.")
        self.assertEqual(live["description_source"], "readme")

        # The Pages flag is set but the site 404s, so no live link is published.
        self.assertIsNone(dead["live_url"])
        self.assertEqual(dead["description_source"], "github")

    def test_link_check_can_be_skipped(self):
        index = fp.collect("MOTOMOTO2", check_links=False, quiet=True)
        self.assertEqual(index["projects"][1]["live_url"], "https://motomoto2.github.io/dead-pages/")

    def test_readme_fallback_can_be_skipped(self):
        index = fp.collect("MOTOMOTO2", readme_fallback=False, quiet=True)
        self.assertIsNone(index["projects"][0]["description"])
        self.assertEqual(index["projects"][0]["description_source"], "none")


if __name__ == "__main__":
    unittest.main()
