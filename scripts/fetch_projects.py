#!/usr/bin/env python3
"""Build the project-index data file from the GitHub REST API.

Run this before building the web app. It writes a single JSON document
(``web/src/data/projects.json`` by default) that the React page imports at build
time, so the deployed page is static but never hand-maintained.

    python scripts/fetch_projects.py --user adenyadegar

Only the standard library is used, so CI needs no pip install.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Iterable

API_ROOT = "https://api.github.com"
USER_AGENT = "github-project-index (+https://github.com/adenyadegar/github-project-index)"
DESCRIPTION_LIMIT = 180
DEFAULT_USER = "adenyadegar"
DEFAULT_OUTPUT = os.path.join("web", "src", "data", "projects.json")
SCHEMA_VERSION = 1

# Sentence-ending periods that are really abbreviations.
_ABBREVIATIONS = {"e.g", "i.e", "vs", "etc", "mr", "mrs", "ms", "dr", "no", "fig", "approx"}


def log(message: str, *, quiet: bool = False) -> None:
    if not quiet:
        print(message, file=sys.stderr)


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------


def _request(
    url: str,
    *,
    token: str | None = None,
    accept: str = "application/vnd.github+json",
    method: str = "GET",
    timeout: float = 20.0,
) -> tuple[int, bytes, dict[str, str]]:
    """Perform one HTTP request. Raises urllib errors for the caller to handle."""
    request = urllib.request.Request(url, method=method)
    request.add_header("Accept", accept)
    request.add_header("User-Agent", USER_AGENT)
    request.add_header("X-GitHub-Api-Version", "2022-11-28")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, response.read(), dict(response.headers.items())


def api_json(
    url: str,
    *,
    token: str | None = None,
    accept: str = "application/vnd.github+json",
) -> tuple[Any, dict[str, str]]:
    """GET a GitHub API URL and decode the body."""
    _status, body, headers = _request(url, token=token, accept=accept)
    if accept.endswith("raw"):
        return body.decode("utf-8", "replace"), headers
    if not body:
        return None, headers
    return json.loads(body.decode("utf-8")), headers


def next_page_url(link_header: str | None) -> str | None:
    """Extract the rel="next" URL from a GitHub Link header."""
    if not link_header:
        return None
    for part in link_header.split(","):
        section = part.split(";")
        if len(section) < 2:
            continue
        url = section[0].strip().lstrip("<").rstrip(">")
        if any(bit.strip() == 'rel="next"' for bit in section[1:]):
            return url
    return None


def fetch_paginated(url: str, *, token: str | None = None, max_pages: int = 10) -> list[dict[str, Any]]:
    """Follow Link headers and concatenate the JSON array pages."""
    items: list[dict[str, Any]] = []
    pages = 0
    while url and pages < max_pages:
        payload, headers = api_json(url, token=token)
        if not isinstance(payload, list):
            raise ValueError(f"expected a JSON array from {url}")
        items.extend(payload)
        url = next_page_url(headers.get("Link") or headers.get("link")) or ""
        pages += 1
    return items


def fetch_profile(user: str, *, token: str | None = None) -> dict[str, Any]:
    payload, _ = api_json(f"{API_ROOT}/users/{urllib.parse.quote(user)}", token=token)
    return payload or {}


def fetch_repos(user: str, *, token: str | None = None, include_private: bool = False) -> list[dict[str, Any]]:
    """List the user's repositories, newest push first.

    ``include_private`` swaps to /user/repos, which needs a personal access
    token for that same account: the Actions-provided GITHUB_TOKEN is scoped to
    this repository and cannot see the others.
    """
    if include_private:
        if not token:
            raise ValueError("--include-private needs a personal access token (GITHUB_TOKEN)")
        url = f"{API_ROOT}/user/repos?per_page=100&sort=pushed&affiliation=owner&visibility=all"
    else:
        url = f"{API_ROOT}/users/{urllib.parse.quote(user)}/repos?per_page=100&sort=pushed&type=owner"
    return fetch_paginated(url, token=token)


def fetch_readme(full_name: str, *, token: str | None = None) -> str | None:
    """Return a repository's README as raw markdown, or None when there isn't one."""
    try:
        text, _ = api_json(
            f"{API_ROOT}/repos/{full_name}/readme",
            token=token,
            accept="application/vnd.github.raw",
        )
    except (urllib.error.URLError, ValueError, TimeoutError):
        return None
    return text if isinstance(text, str) else None


def url_is_live(url: str, *, timeout: float = 8.0) -> bool | None:
    """True/False when the URL answered, None when the check itself failed."""
    for method in ("HEAD", "GET"):
        try:
            status, _body, _headers = _request(url, method=method, accept="*/*", timeout=timeout)
            return status < 400
        except urllib.error.HTTPError as error:
            if method == "HEAD" and error.code in (403, 405, 501):
                continue  # some hosts refuse HEAD; try GET
            return error.code < 400
        except (urllib.error.URLError, TimeoutError, ValueError):
            return None
    return None


# ---------------------------------------------------------------------------
# Pure transforms (unit-tested in tests/test_fetch_projects.py)
# ---------------------------------------------------------------------------

_INLINE_IMAGE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_INLINE_LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")
_EMPHASIS = re.compile(r"(\*\*|__|\*|_|`)")
_HTML_TAG = re.compile(r"<[^>]+>")
_WHITESPACE = re.compile(r"\s+")
_LIST_ITEM = re.compile(r"^\s*([-*+]\s|\d+[.)]\s)")


def flatten_markdown(text: str) -> str:
    """Reduce inline markdown to plain prose."""
    text = _INLINE_IMAGE.sub("", text)
    text = _INLINE_LINK.sub(r"\1", text)
    text = _HTML_TAG.sub("", text)
    text = _EMPHASIS.sub("", text)
    text = text.replace("\\", "")
    return _WHITESPACE.sub(" ", text).strip()


def first_sentence(text: str) -> str:
    """The first sentence, keeping common abbreviations intact."""
    for match in re.finditer(r"[.!?](?=\s|$)", text):
        head = text[: match.start()]
        last_word = re.split(r"[\s(]", head)[-1].lower().rstrip(".")
        if last_word in _ABBREVIATIONS or len(last_word) <= 1:
            continue
        return text[: match.end()].strip()
    return text.strip()


def truncate(text: str, limit: int = DESCRIPTION_LIMIT) -> str:
    """Clip to ``limit`` characters on a word boundary, with an ellipsis."""
    text = text.strip()
    if len(text) <= limit:
        return text
    clipped = text[: limit - 1].rstrip()
    if " " in clipped:
        clipped = clipped[: clipped.rindex(" ")].rstrip()
    return clipped.rstrip(",;:.") + "…"


def clean_description(text: str | None, limit: int = DESCRIPTION_LIMIT) -> str | None:
    """Normalise a description into a single tidy line."""
    if not text:
        return None
    flat = flatten_markdown(text)
    if not flat:
        return None
    if len(flat) > limit:
        flat = first_sentence(flat)
    return truncate(flat, limit) or None


def _is_prose(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if stripped.startswith(("#", ">", "|", "<", "```", "~~~", "---", "===", "[!", "![", "[[")):
        return False
    if _LIST_ITEM.match(line):
        return False
    if line.startswith(("    ", "\t")):  # indented code block
        return False
    if "img.shields.io" in stripped or "badge.svg" in stripped:
        return False
    # A line that is only links or images carries no prose of its own.
    if not flatten_markdown(stripped):
        return False
    return True


def description_from_readme(markdown: str | None, limit: int = DESCRIPTION_LIMIT) -> str | None:
    """Fall back to the README's first real paragraph.

    Plenty of repositories have no ``description`` set, and the opening
    paragraph of the README is almost always the one-liner we want.
    """
    if not markdown:
        return None
    paragraph: list[str] = []
    in_fence = False
    in_comment = False
    for raw_line in markdown.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if in_comment:
            if "-->" in stripped:
                in_comment = False
            continue
        if stripped.startswith("<!--"):
            in_comment = "-->" not in stripped
            continue
        if stripped.startswith(("```", "~~~")):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if _is_prose(line):
            paragraph.append(stripped)
        elif paragraph:
            break  # the paragraph ended
    if not paragraph:
        return None
    return clean_description(" ".join(paragraph), limit)


def normalise_homepage(homepage: str | None) -> str | None:
    """Accept only real http(s) links; add a scheme when the field omits one."""
    if not homepage:
        return None
    url = homepage.strip()
    if not url or url.lower() in {"-", "n/a", "none"}:
        return None
    if url.startswith("//"):
        url = "https:" + url
    if "://" not in url:
        if "." not in url.split("/")[0]:
            return None
        url = "https://" + url
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    return url


def derive_live_url(repo: dict[str, Any], login: str) -> tuple[str | None, str | None]:
    """The project's live link, and where we learned about it."""
    homepage = normalise_homepage(repo.get("homepage"))
    if homepage:
        return homepage, "homepage"
    if repo.get("has_pages"):
        host = f"{login.lower()}.github.io"
        name = (repo.get("name") or "").strip()
        if name.lower() == host:
            return f"https://{host}/", "pages"
        return f"https://{host}/{urllib.parse.quote(name)}/", "pages"
    return None, None


def build_project(
    repo: dict[str, Any],
    login: str,
    *,
    readme_description: str | None = None,
    live: tuple[str | None, str | None] | None = None,
) -> dict[str, Any]:
    """Map one API repository object onto the record the page renders."""
    description = clean_description(repo.get("description"))
    source = "github"
    if not description and readme_description:
        description, source = readme_description, "readme"
    if not description:
        source = "none"
    live_url, live_source = live if live is not None else derive_live_url(repo, login)
    return {
        "name": repo.get("name") or "",
        "full_name": repo.get("full_name") or f"{login}/{repo.get('name') or ''}",
        "description": description,
        "description_source": source,
        "language": repo.get("language") or None,
        "topics": sorted(repo.get("topics") or []),
        "pushed_at": repo.get("pushed_at") or repo.get("updated_at") or "",
        "created_at": repo.get("created_at") or "",
        "repo_url": repo.get("html_url") or "",
        "live_url": live_url,
        "live_url_source": live_source,
        "stars": int(repo.get("stargazers_count") or 0),
        "forks": int(repo.get("forks_count") or 0),
        "is_fork": bool(repo.get("fork")),
        "is_archived": bool(repo.get("archived")),
        "is_private": bool(repo.get("private")),
    }


def select_repos(repos: Iterable[dict[str, Any]], *, exclude_forks: bool = False) -> list[dict[str, Any]]:
    """Drop repositories that should never appear in the index."""
    keep: list[dict[str, Any]] = []
    for repo in repos:
        if repo.get("disabled"):
            continue
        if exclude_forks and repo.get("fork"):
            continue
        keep.append(repo)
    return keep


def build_index(
    projects: list[dict[str, Any]],
    *,
    login: str,
    profile: dict[str, Any] | None = None,
    generated_at: str | None = None,
) -> dict[str, Any]:
    """Assemble the document the React app imports."""
    profile = profile or {}
    ordered = sorted(
        projects,
        key=lambda project: (project.get("pushed_at") or "", project.get("name") or ""),
        reverse=True,
    )
    return {
        "schema": SCHEMA_VERSION,
        "generated_at": generated_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stale": False,
        "owner": {
            "login": profile.get("login") or login,
            "name": profile.get("name") or profile.get("login") or login,
            "html_url": profile.get("html_url") or f"https://github.com/{login}",
            "avatar_url": profile.get("avatar_url") or None,
            "bio": clean_description(profile.get("bio")),
        },
        "projects": ordered,
    }


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def collect(
    user: str,
    *,
    token: str | None = None,
    include_private: bool = False,
    exclude_forks: bool = False,
    readme_fallback: bool = True,
    check_links: bool = True,
    quiet: bool = False,
) -> dict[str, Any]:
    """Fetch everything and return the finished index document."""
    profile = fetch_profile(user, token=token)
    login = profile.get("login") or user
    repos = select_repos(
        fetch_repos(user, token=token, include_private=include_private),
        exclude_forks=exclude_forks,
    )
    log(f"fetched {len(repos)} repositories for {login}", quiet=quiet)

    projects: list[dict[str, Any]] = []
    for repo in repos:
        readme_description = None
        if readme_fallback and not clean_description(repo.get("description")):
            readme_description = description_from_readme(fetch_readme(repo["full_name"], token=token))
        live_url, live_source = derive_live_url(repo, login)
        if live_url and check_links and url_is_live(live_url) is False:
            log(f"  {repo['name']}: {live_url} did not answer, dropping the live link", quiet=quiet)
            live_url, live_source = None, None
        project = build_project(
            repo,
            login,
            readme_description=readme_description,
            live=(live_url, live_source),
        )
        projects.append(project)
        notes = []
        if project["live_url"]:
            notes.append("live")
        if project["description_source"] == "readme":
            notes.append("readme description")
        if project["description_source"] == "none":
            notes.append("no description")
        log(f"  {project['name']}" + (f" ({', '.join(notes)})" if notes else ""), quiet=quiet)
    return build_index(projects, login=login, profile=profile)


def write_index(index: dict[str, Any], output: str) -> None:
    directory = os.path.dirname(os.path.abspath(output))
    os.makedirs(directory, exist_ok=True)
    with open(output, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(index, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def mark_existing_stale(output: str) -> bool:
    """Flag the committed snapshot as stale so the page can say so."""
    try:
        with open(output, encoding="utf-8") as handle:
            index = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return False
    index["stale"] = True
    write_index(index, output)
    return True


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch a GitHub user's repositories into the project-index data file.",
    )
    parser.add_argument(
        "--user",
        default=os.environ.get("PROJECT_INDEX_USER", DEFAULT_USER),
        help=f"GitHub login to index (default: {DEFAULT_USER})",
    )
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help=f"where to write the JSON (default: {DEFAULT_OUTPUT})")
    parser.add_argument(
        "--token",
        default=os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN"),
        help="API token (default: $GITHUB_TOKEN)",
    )
    parser.add_argument(
        "--include-private",
        action="store_true",
        help="also index private repositories (needs a personal access token)",
    )
    parser.add_argument("--exclude-forks", action="store_true", help="leave forks out of the index")
    parser.add_argument("--no-readme-fallback", action="store_true", help="do not read descriptions from READMEs")
    parser.add_argument("--no-link-check", action="store_true", help="trust derived live links without an HTTP check")
    parser.add_argument(
        "--fallback-to-existing",
        action="store_true",
        help="on API failure, keep the existing file and mark it stale (used by CI)",
    )
    parser.add_argument("--quiet", action="store_true", help="only report errors")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if not args.token:
        log("no token given: using the unauthenticated API (60 requests/hour)", quiet=args.quiet)
    try:
        index = collect(
            args.user,
            token=args.token,
            include_private=args.include_private,
            exclude_forks=args.exclude_forks,
            readme_fallback=not args.no_readme_fallback,
            check_links=not args.no_link_check,
            quiet=args.quiet,
        )
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError) as error:
        detail = getattr(error, "reason", error)
        log(f"error: could not build the index from the GitHub API: {detail}")
        if args.fallback_to_existing and mark_existing_stale(args.output):
            log(f"warning: kept the existing {args.output} and marked it stale")
            return 0
        return 1
    write_index(index, args.output)
    live = sum(1 for project in index["projects"] if project["live_url"])
    log(f"wrote {args.output}: {len(index['projects'])} projects, {live} with a live link", quiet=args.quiet)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
