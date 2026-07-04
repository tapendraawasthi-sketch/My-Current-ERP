"""No-API-key web search via DuckDuckGo (server-side scraping)."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from html import unescape
from urllib.parse import parse_qs, unquote, urlparse

import httpx

try:
    from duckduckgo_search import DDGS
except ImportError:  # pragma: no cover
    DDGS = None

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0 Safari/537.36"
)
DDG_LITE = "https://lite.duckduckgo.com/lite/"


def _decode_html(text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", " ", text or "")
    cleaned = unescape(cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _extract_target_url(href: str) -> str:
    if not href:
        return ""
    try:
        absolute = f"https:{href}" if href.startswith("//") else href
        parsed = urlparse(absolute)
        query = parse_qs(parsed.query)
        uddg = query.get("uddg", [""])[0]
        if uddg:
            return unquote(uddg)
        if parsed.hostname and parsed.hostname != "duckduckgo.com":
            return absolute
    except Exception:
        pass
    return href


def _search_via_ddg_lite(query: str, max_results: int) -> list[dict]:
    response = httpx.get(
        DDG_LITE,
        params={"q": query},
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
        timeout=12.0,
        follow_redirects=True,
    )
    response.raise_for_status()
    html = response.text

    results: list[dict] = []
    link_pattern = re.compile(
        r"<a[^>]*href=['\"]([^'\"]+)['\"][^>]*class=['\"]result-link['\"][^>]*>([\s\S]*?)</a>",
        re.IGNORECASE,
    )

    for match in link_pattern.finditer(html):
        href = match.group(1)
        title = _decode_html(match.group(2))
        tail = html[match.start() : match.start() + 1200]
        snippet_match = re.search(
            r"class=['\"]result-snippet['\"][^>]*>([\s\S]*?)</td>",
            tail,
            re.IGNORECASE,
        )
        snippet = _decode_html(snippet_match.group(1)) if snippet_match else title
        url = _extract_target_url(href)
        if not title and not snippet:
            continue
        results.append(
            {
                "title": title or url,
                "snippet": snippet[:400],
                "url": url,
                "source": "duckduckgo",
                "relevanceScore": max(50, 85 - len(results) * 5),
            }
        )
        if len(results) >= max_results:
            break

    return results


def _search_via_ddgs(query: str, max_results: int) -> list[dict]:
    if DDGS is None:
        return []

    with DDGS() as ddgs:
        raw = list(ddgs.text(query, max_results=max_results))

    results = []
    for index, item in enumerate(raw):
        title = (item.get("title") or "").strip()
        url = (item.get("href") or "").strip()
        snippet = (item.get("body") or "").strip()
        if not title and not snippet:
            continue
        results.append(
            {
                "title": title or url,
                "snippet": snippet[:400],
                "url": url,
                "source": "duckduckgo",
                "relevanceScore": max(50, 85 - index * 5),
            }
        )
    return results


def search_web_structured(query: str, max_results: int = 5) -> dict:
    """Return structured web search results without any paid API key."""
    query = (query or "").strip()
    if not query:
        return {
            "query": query,
            "results": [],
            "searchedAt": datetime.now(timezone.utc).isoformat(),
            "sourcesUsed": [],
            "totalResultsFound": 0,
            "error": "Query cannot be empty",
        }

    results: list[dict] = []
    error: str | None = None

    try:
        results = _search_via_ddgs(query, max_results)
    except Exception as exc:
        error = str(exc)

    if not results:
        try:
            results = _search_via_ddg_lite(query, max_results)
            error = None
        except Exception as exc:
            error = error or str(exc)

    return {
        "query": query,
        "results": results,
        "directAnswer": results[0]["snippet"] if results else None,
        "searchedAt": datetime.now(timezone.utc).isoformat(),
        "sourcesUsed": ["duckduckgo"] if results else [],
        "totalResultsFound": len(results),
        "error": None if results else (error or "No web results found for this query."),
    }
