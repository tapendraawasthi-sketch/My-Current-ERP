"""No-key web search + fetch tools for tax/legal/current-fact questions.

Runs the blocking duckduckgo/requests calls in a thread so the async loop is
never blocked. Every result carries a web EvidenceRef with the source URL.
"""

from __future__ import annotations

import asyncio
import hashlib
import re
import textwrap

from ..schemas import EvidenceRef, ToolResult
from .registry import ToolRegistry, ToolSpec

_WEB_SEQ = 0


def _next_evidence_id() -> str:
    global _WEB_SEQ
    _WEB_SEQ += 1
    return f"ev_web_{_WEB_SEQ:04d}"


def _sync_search(query: str, max_results: int) -> list[dict]:
    from duckduckgo_search import DDGS

    with DDGS() as ddgs:
        return list(ddgs.text(query, max_results=max_results))


async def _web_search(args: dict) -> ToolResult:
    query = str(args.get("query", "")).strip()
    if not query:
        return ToolResult(ok=False, error="query is required")
    max_results = int(args.get("max_results", 5))

    try:
        results = await asyncio.to_thread(_sync_search, query, max_results)
    except Exception as exc:
        return ToolResult(ok=False, error=f"web search failed: {exc}")

    if not results:
        return ToolResult(ok=True, summary="No web results found.", data={"results": []})

    evidence: list[EvidenceRef] = []
    for r in results:
        url = r.get("href", "")
        body = (r.get("body", "") or "")[:400]
        evidence.append(
            EvidenceRef(
                id=_next_evidence_id(),
                source_type="web",
                uri=url,
                title=r.get("title"),
                snippet=body,
                content_hash=hashlib.sha256(url.encode()).hexdigest()[:16],
            )
        )
    return ToolResult(
        ok=True,
        summary=f"Found {len(evidence)} web results for '{query}'.",
        evidence=evidence,
        data={"results": [{"title": r.get("title"), "url": r.get("href")} for r in results]},
    )


def _sync_fetch(url: str) -> str:
    import requests
    from bs4 import BeautifulSoup

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        )
    }
    resp = requests.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    return re.sub(r"\s{2,}", " ", text)


async def _fetch_webpage(args: dict) -> ToolResult:
    url = str(args.get("url", "")).strip()
    if not url:
        return ToolResult(ok=False, error="url is required")
    try:
        text = await asyncio.to_thread(_sync_fetch, url)
    except Exception as exc:
        return ToolResult(ok=False, error=f"fetch failed: {exc}")

    short = textwrap.shorten(text, width=3000, placeholder=" …[truncated]")
    ev = EvidenceRef(
        id=_next_evidence_id(),
        source_type="web",
        uri=url,
        snippet=short[:600],
        content_hash=hashlib.sha256(short.encode()).hexdigest()[:16],
    )
    return ToolResult(
        ok=True,
        summary=f"Fetched {url}.",
        evidence=[ev],
        data={"url": url, "content": short},
    )


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="web_search",
            description="Search the web (DuckDuckGo, no key) for tax rules, IRD notices, laws, or current facts. Returns URLs.",
            input_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "max_results": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        ),
        _web_search,
    )
    registry.register(
        ToolSpec(
            name="fetch_webpage",
            description="Fetch and read the plain text of a webpage found via web_search.",
            input_schema={
                "type": "object",
                "properties": {"url": {"type": "string"}},
                "required": ["url"],
            },
        ),
        _fetch_webpage,
    )
