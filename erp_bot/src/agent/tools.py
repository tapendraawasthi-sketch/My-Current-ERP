"""Five tools the ERP AI agent can call."""

from __future__ import annotations

import os
from pathlib import Path

from langchain_core.tools import tool

from ..config import (
    CODE_EXTENSIONS,
    ERP_PATH,
    FALLBACK_EXTENSIONS,
    SKIP_FOLDERS,
    SQL_EXTENSIONS,
    WHOLE_FILE_EXTENSIONS,
)
from ..vectorstore.chroma_store import search_codebase as _search

import re as _re
import textwrap as _textwrap

import requests as _requests
from bs4 import BeautifulSoup as _BS
from duckduckgo_search import DDGS as _DDGS


@tool
def search_codebase(query: str) -> str:
    """Search the ERP codebase (React/TypeScript frontend, Express/Node backend, PostgreSQL schema) using a natural-language or technical query. Always call this first for any question about how the app works."""
    try:
        results = _search(query, k=8)
    except Exception as e:
        return f"Search failed: {e}"
    if not results:
        return "No relevant code found for this query."
    parts = []
    for i, r in enumerate(results, 1):
        parts.append(
            f"Result {i}:\n"
            f"  File: {r['source']}\n"
            f"  Function/Component: {r['function_name'] or '(module-level)'} | Class: {r['class_name'] or '-'}\n"
            f"  Language: {r['language']}\n"
            f"  Code:\n```\n{r['text'][:800]}\n```"
        )
    return "\n\n".join(parts)


@tool
def read_full_file(file_path: str) -> str:
    """Read the complete contents of one file, given a path relative to the ERP repo root (e.g. "src/components/invoice/SalesInvoiceForm.tsx") or an absolute path. Use when a search snippet isn't enough context."""
    try:
        p = Path(file_path)
        full = p if p.is_absolute() else (ERP_PATH / file_path)
        if not full.exists():
            return f"File not found: {full}"
        if full.stat().st_size > 500_000:
            return f"File too large to read in full ({full.stat().st_size} bytes). Use search_codebase instead."
        return f"File: {full}\n\n```\n{full.read_text(encoding='utf-8', errors='ignore')}\n```"
    except Exception as e:
        return f"Could not read file: {e}"


@tool
def list_directory(dir_path: str) -> str:
    """List files and subdirectories inside a directory of the ERP repo, given a path relative to the repo root or absolute. Use to understand module layout before opening files."""
    try:
        p = Path(dir_path)
        full = p if p.is_absolute() else (ERP_PATH / dir_path)
        if not full.is_dir():
            return f"Not a directory: {full}"
        items = os.listdir(full)
        files = sorted(i for i in items if (full / i).is_file())
        dirs = sorted(i for i in items if (full / i).is_dir() and i not in SKIP_FOLDERS)
        return (
            f"Directory: {full}\n"
            f"Subdirectories ({len(dirs)}): {', '.join(dirs)}\n"
            f"Files ({len(files)}): {', '.join(files)}"
        )
    except Exception as e:
        return f"Could not list directory: {e}"


@tool
def find_references(symbol_name: str) -> str:
    """Find every source file containing an exact-text reference to a function, component, hook, type, or variable name. Use to trace how something is used across the frontend/backend boundary. Input: exact identifier, e.g. "calculateTax" or "SalesInvoiceForm"."""
    try:
        allowed_ext = CODE_EXTENSIONS | SQL_EXTENSIONS | FALLBACK_EXTENSIONS | WHOLE_FILE_EXTENSIONS
        matches = []
        for root, dirs, files in os.walk(ERP_PATH):
            dirs[:] = [d for d in dirs if d not in SKIP_FOLDERS]
            for filename in files:
                if Path(filename).suffix.lower() not in allowed_ext:
                    continue
                fpath = Path(root) / filename
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        for lineno, line in enumerate(f, 1):
                            if symbol_name in line:
                                rel = fpath.relative_to(ERP_PATH)
                                matches.append(f"  {rel}:{lineno}  →  {line.strip()[:160]}")
                            if len(matches) >= 50:
                                break
                except Exception:
                    continue
                if len(matches) >= 50:
                    break
            if len(matches) >= 50:
                break
        if not matches:
            return f"No references found for '{symbol_name}'."
        suffix = "+" if len(matches) >= 50 else ""
        return f"References to '{symbol_name}' ({len(matches)}{suffix} found):\n" + "\n".join(matches)
    except Exception as e:
        return f"Reference search failed: {e}"


@tool
def get_project_conventions() -> str:
    """Return this repo's own AI-agent convention files (AGENTS.md, GEMINI.md, README.md) verbatim — design system rules, dead/unused files to avoid, architecture facts, and deployment topology. Call this for any architecture or "how should this be built" question."""
    parts = []
    for fname in ("AGENTS.md", "GEMINI.md", "README.md"):
        fpath = ERP_PATH / fname
        if fpath.exists():
            try:
                parts.append(f"=== {fname} ===\n{fpath.read_text(encoding='utf-8', errors='ignore')}")
            except Exception:
                pass
    return "\n\n".join(parts) if parts else "No convention files found at repo root."


@tool
def find_navigation_path(feature_name: str) -> str:
    """Look up the exact menu path and keyboard shortcut for an ERP screen
    by reading BusyMenuBar.tsx, Sidebar.tsx, and App.tsx directly.
    Use FIRST for nav or action_path questions before guessing."""
    from .nav_resolver import resolve_navigation

    result = resolve_navigation(feature_name)
    if not result.get("found"):
        return result["answer"]

    lines = [result["answer"]]
    if result.get("file"):
        lines.append(f"File: {result['file']}")
    lines.append("Source: src/components/BusyMenuBar.tsx (MENU_TREE + PAGE_SHORTCUTS)")
    return "\n".join(lines)


@tool
def web_search(query: str) -> str:
    """Search the web using DuckDuckGo (no API key required). Use
    when the question is about ERP accounting concepts, Nepal tax
    rules, IRD regulations, or anything not answered by the
    codebase. Input: a concise search query in plain English."""
    try:
        with _DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
        if not results:
            return "No web results found for this query."
        parts = []
        for i, r in enumerate(results, 1):
            parts.append(
                f"Result {i}: {r.get('title', '')}\n"
                f"URL: {r.get('href', '')}\n"
                f"Snippet: {r.get('body', '')[:400]}"
            )
        return "\n\n".join(parts)
    except Exception as e:
        return f"Web search failed: {e}"


@tool
def fetch_webpage(url: str) -> str:
    """Fetch and read the plain-text content of a webpage. Use
    after web_search when a snippet is not enough and you need
    the full page. Input: exact URL from a web_search result."""
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0 Safari/537.36"
            )
        }
        resp = _requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        soup = _BS(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        # Collapse whitespace and cap at 3000 chars to stay within context
        text = _re.sub(r"\s{2,}", " ", text)
        return _textwrap.shorten(text, width=3000, placeholder=" …[truncated]")
    except Exception as e:
        return f"Could not fetch webpage: {e}"


TOOLS = [
    search_codebase,
    read_full_file,
    list_directory,
    find_references,
    get_project_conventions,
    find_navigation_path,
    web_search,
    fetch_webpage,
]
