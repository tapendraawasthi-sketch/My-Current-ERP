"""Live code-evidence tools. Every result carries EvidenceRef objects with
line ranges and content hashes so the verifier can enforce grounding.

Reuses the existing chroma_store search and nav_resolver rather than
reimplementing retrieval.
"""

from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path

from ...config import (
    CODE_EXTENSIONS,
    FALLBACK_EXTENSIONS,
    SKIP_FOLDERS,
    SQL_EXTENSIONS,
    WHOLE_FILE_EXTENSIONS,
)
from ..config import get_config
from ..schemas import EvidenceRef, ToolResult
from .registry import ToolRegistry, ToolSpec

_EVIDENCE_SEQ = 0


def _next_evidence_id(prefix: str) -> str:
    global _EVIDENCE_SEQ
    _EVIDENCE_SEQ += 1
    return f"ev_{prefix}_{_EVIDENCE_SEQ:04d}"


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()[:16]


def _erp_path() -> Path:
    return get_config().erp_path


def _is_denied(path: Path) -> bool:
    denied = get_config().denied_path_parts
    parts = set(path.parts)
    if any(d in parts for d in denied):
        return True
    return path.name in {".env"} or path.name.startswith(".env")


def _safe_resolve(rel_or_abs: str) -> Path | None:
    """Resolve a path and guarantee it stays inside ERP_PATH and is allowed."""
    erp = _erp_path()
    p = Path(rel_or_abs)
    full = p if p.is_absolute() else (erp / rel_or_abs)
    try:
        full = full.resolve()
    except Exception:
        return None
    try:
        full.relative_to(erp)
    except ValueError:
        return None
    if _is_denied(full):
        return None
    return full


# ── search_codebase ───────────────────────────────────────────────────────────
async def _search_codebase(args: dict) -> ToolResult:
    from ...vectorstore.chroma_store import search_codebase as _search

    query = str(args.get("query", "")).strip()
    if not query:
        return ToolResult(ok=False, error="query is required")
    k = int(args.get("k", 8))

    try:
        results = _search(query, k=k)
    except Exception as exc:
        return ToolResult(ok=False, error=f"search failed: {exc}")

    file_globs = args.get("file_globs") or []
    evidence: list[EvidenceRef] = []
    matches: list[dict] = []
    for r in results:
        source = r.get("source") or ""
        if file_globs and not any(_glob_match(source, g) for g in file_globs):
            continue
        snippet = (r.get("text") or "")[:800]
        ev = EvidenceRef(
            id=_next_evidence_id("code"),
            source_type="code",
            uri=source,
            title=r.get("function_name") or r.get("class_name") or None,
            content_hash=_hash(snippet),
            snippet=snippet,
        )
        evidence.append(ev)
        matches.append(
            {
                "source": source,
                "function_name": r.get("function_name"),
                "class_name": r.get("class_name"),
                "language": r.get("language"),
                "evidence_id": ev.id,
            }
        )

    if not evidence:
        return ToolResult(ok=True, summary=f"No code matches for '{query}'.", data={"matches": []})

    return ToolResult(
        ok=True,
        summary=f"Found {len(evidence)} code chunks for '{query}'.",
        evidence=evidence,
        data={"matches": matches},
    )


def _glob_match(path: str, pattern: str) -> bool:
    import fnmatch

    return fnmatch.fnmatch(path, pattern) or fnmatch.fnmatch(path, f"*{pattern}*")


# ── read_code_file ──────────────────────────────────────────────────────────────
async def _read_code_file(args: dict) -> ToolResult:
    raw = str(args.get("path", "")).strip()
    if not raw:
        return ToolResult(ok=False, error="path is required")
    full = _safe_resolve(raw)
    if full is None:
        return ToolResult(ok=False, error=f"Path not allowed or outside repo: {raw}")
    if not full.exists() or not full.is_file():
        return ToolResult(ok=False, error=f"File not found: {raw}")
    if full.stat().st_size > 500_000:
        return ToolResult(ok=False, error="File too large; use search_codebase.")

    text = full.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    start = int(args.get("start_line", 1))
    end = int(args.get("end_line", len(lines)))
    start = max(1, start)
    end = min(len(lines), end)
    excerpt = "\n".join(lines[start - 1 : end])

    rel = str(full.relative_to(_erp_path()))
    ev = EvidenceRef(
        id=_next_evidence_id("file"),
        source_type="code",
        uri=rel,
        line_start=start,
        line_end=end,
        content_hash=_hash(excerpt),
        snippet=excerpt[:1500],
    )
    return ToolResult(
        ok=True,
        summary=f"Read {rel} lines {start}-{end}.",
        evidence=[ev],
        data={"path": rel, "content": excerpt, "total_lines": len(lines)},
    )


# ── find_symbol ─────────────────────────────────────────────────────────────────
async def _find_symbol(args: dict) -> ToolResult:
    symbol = str(args.get("symbol", "")).strip()
    if not symbol:
        return ToolResult(ok=False, error="symbol is required")

    erp = _erp_path()
    allowed = CODE_EXTENSIONS | SQL_EXTENSIONS | FALLBACK_EXTENSIONS | WHOLE_FILE_EXTENSIONS
    def_re = re.compile(
        rf"\b(function|const|class|interface|type|export\s+default\s+function|export\s+function)\s+{re.escape(symbol)}\b"
    )
    evidence: list[EvidenceRef] = []
    matches: list[dict] = []

    for root, dirs, files in os.walk(erp):
        dirs[:] = [d for d in dirs if d not in SKIP_FOLDERS]
        for filename in files:
            if Path(filename).suffix.lower() not in allowed:
                continue
            fpath = Path(root) / filename
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    for lineno, line in enumerate(f, 1):
                        if symbol in line and def_re.search(line):
                            rel = str(fpath.relative_to(erp))
                            ev = EvidenceRef(
                                id=_next_evidence_id("sym"),
                                source_type="code",
                                uri=rel,
                                line_start=lineno,
                                line_end=lineno,
                                content_hash=_hash(line),
                                snippet=line.strip()[:200],
                            )
                            evidence.append(ev)
                            matches.append({"path": rel, "line": lineno, "evidence_id": ev.id})
                            if len(evidence) >= 20:
                                break
            except Exception:
                continue
            if len(evidence) >= 20:
                break
        if len(evidence) >= 20:
            break

    if not evidence:
        return ToolResult(ok=True, summary=f"No definition found for symbol '{symbol}'.", data={"matches": []})
    return ToolResult(
        ok=True,
        summary=f"Found {len(evidence)} definition site(s) for '{symbol}'.",
        evidence=evidence,
        data={"matches": matches},
    )


# ── find_navigation_path ────────────────────────────────────────────────────────
async def _find_navigation_path(args: dict) -> ToolResult:
    from ...agent.nav_resolver import resolve_navigation

    feature = str(args.get("feature") or args.get("query") or "").strip()
    if not feature:
        return ToolResult(ok=False, error="feature is required")

    result = resolve_navigation(feature)
    sources = result.get("sources", [])
    evidence: list[EvidenceRef] = []
    for src in sources:
        evidence.append(
            EvidenceRef(
                id=_next_evidence_id("nav"),
                source_type="navigation",
                uri=src,
                snippet=result.get("answer", ""),
            )
        )

    if not result.get("found"):
        return ToolResult(
            ok=True,
            summary=result.get("answer", "No navigation path found."),
            evidence=evidence,
            data={"found": False},
        )

    return ToolResult(
        ok=True,
        summary=result["answer"],
        evidence=evidence,
        data={
            "found": True,
            "route": result.get("route"),
            "path": result.get("path"),
            "shortcut": result.get("shortcut"),
            "file": result.get("file"),
        },
    )


def register(registry: ToolRegistry) -> None:
    registry.register(
        ToolSpec(
            name="search_codebase",
            description="Search ERP source code for relevant files, routes, components, and functions.",
            input_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "k": {"type": "integer", "default": 8},
                    "file_globs": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["query"],
            },
            read_only=True,
        ),
        _search_codebase,
    )
    registry.register(
        ToolSpec(
            name="read_code_file",
            description="Read a source file (optionally a line range) from inside the ERP repo.",
            input_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "start_line": {"type": "integer"},
                    "end_line": {"type": "integer"},
                },
                "required": ["path"],
            },
        ),
        _read_code_file,
    )
    registry.register(
        ToolSpec(
            name="find_symbol",
            description="Find the definition site(s) of a function, component, hook, type, or class by exact name.",
            input_schema={
                "type": "object",
                "properties": {"symbol": {"type": "string"}},
                "required": ["symbol"],
            },
        ),
        _find_symbol,
    )
    registry.register(
        ToolSpec(
            name="find_navigation_path",
            description="Resolve the menu path and keyboard shortcut for an ERP screen from BusyMenuBar/Sidebar/App source.",
            input_schema={
                "type": "object",
                "properties": {"feature": {"type": "string"}},
                "required": ["feature"],
            },
        ),
        _find_navigation_path,
    )
