"""Deterministic navigation path lookup from ERP menu/route source files."""

from __future__ import annotations

import re
from pathlib import Path

from ..config import ERP_PATH

# ── synonym hints for feature queries ─────────────────────────────────────────
_FEATURE_ALIASES: dict[str, list[str]] = {
    "journal": ["journal", "journal-entry", "journal-voucher", "jv"],
    "payment": ["payment", "payment-voucher", "pay"],
    "receipt": ["receipt", "receipt-voucher"],
    "contra": ["contra", "contra-voucher"],
    "sales": ["sales", "sales-invoice", "sales-voucher", "billing"],
    "purchase": ["purchase", "purchase-invoice", "purchase-voucher"],
    "accounts": ["accounts", "chart-of-accounts", "coa"],
    "parties": ["parties", "party", "customers", "suppliers"],
    "day-book": ["day-book", "daybook"],
    "trial-balance": ["trial-balance", "trial", "tb"],
    "balance-sheet": ["balance-sheet", "balance", "bs"],
    "ledger-report": ["ledger-report", "general-ledger", "ledger", "gl"],
    "vat-reports": ["vat-reports", "vat", "gst"],
    "items": ["items", "item-master", "stock"],
}


def _normalize(text: str) -> str:
    return re.sub(r"[^\w\s-]", " ", text.lower()).strip()


def _tokens(text: str) -> list[str]:
    return [t for t in _normalize(text).split() if t]


def _parse_page_shortcuts(source: str) -> dict[str, str]:
    shortcuts: dict[str, str] = {}
    start = source.find("PAGE_SHORTCUTS")
    if start == -1:
        return shortcuts
    brace_start = source.find("{", start)
    if brace_start == -1:
        return shortcuts

    depth = 0
    end = brace_start
    for i in range(brace_start, len(source)):
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break

    block = source[brace_start + 1 : end]
    for route, key in re.findall(r'["\']?([\w-]+)["\']?\s*:\s*"([^"]+)"', block):
        shortcuts[route] = key
    return shortcuts


def _parse_busy_menu_tree(source: str) -> dict[str, list[str]]:
    route_paths: dict[str, list[str]] = {}
    idx = source.find("const MENU_TREE")
    if idx == -1:
        return route_paths

    section = ""
    subgroup = ""
    for line in source[idx:].splitlines():
        if line.strip().startswith("];") and "children" not in line:
            break

        title_m = re.match(r'\s*title:\s*"([^"]+)"', line)
        if title_m:
            section = title_m.group(1)
            subgroup = ""
            continue

        subgroup_m = re.search(r'label:\s*"([^"]+)".*children:\s*\[', line)
        if subgroup_m:
            subgroup = subgroup_m.group(1)
            continue

        page_m = re.search(r'label:\s*"([^"]+)".*page:\s*"([^"]+)"', line)
        if page_m:
            label, page = page_m.group(1), page_m.group(2)
            parts = [p for p in (section, subgroup, label) if p]
            path = " → ".join(parts)
            route_paths.setdefault(page, [])
            if path not in route_paths[page]:
                route_paths[page].append(path)
    return route_paths


def _parse_sidebar_menus(source: str) -> dict[str, list[str]]:
    route_paths: dict[str, list[str]] = {}
    for group_m in re.finditer(
        r'title:\s*"([^"]+)"[\s\S]*?items:\s*\[([\s\S]*?)\]', source
    ):
        group = group_m.group(1)
        for label, page in re.findall(
            r'label:\s*"([^"]+)"[\s\S]*?page:\s*"([^"]+)"', group_m.group(2)
        ):
            path = f"{group} → {label}"
            route_paths.setdefault(page, [])
            if path not in route_paths[page]:
                route_paths[page].append(path)
    return route_paths


def _parse_app_routes(source: str) -> dict[str, str]:
    """route/alias → component file path (best effort)."""
    route_files: dict[str, str] = {}
    block = re.search(
        r"switch\s*\(\s*currentPage\s*\)\s*\{([\s\S]*?)\n\s*default:", source
    )
    if not block:
        return route_files

    pending: list[str] = []
    for line in block.group(1).splitlines():
        case_m = re.match(r'\s*case\s+"([^"]+)":', line)
        if case_m:
            pending.append(case_m.group(1))
            continue
        ret_m = re.match(r"\s*return\s+<(\w+)", line)
        if ret_m and pending:
            component = ret_m.group(1)
            for route in pending:
                for folder in ("pages", "components"):
                    candidate = ERP_PATH / "src" / folder / f"{component}.tsx"
                    if candidate.exists():
                        route_files[route] = str(candidate.relative_to(ERP_PATH))
                        break
                else:
                    route_files[route] = f"src/pages/{component}.tsx"
            pending = []
    return route_files


def _match_route(query: str, busy_paths: dict, sidebar_paths: dict) -> tuple[str | None, list[str]]:
    q_norm = _normalize(query)
    q_tokens = set(_tokens(query))

    # Direct route key match from known paths
    all_routes = set(busy_paths) | set(sidebar_paths)
    for route in all_routes:
        if route in q_norm.replace(" ", "-") or route.replace("-", " ") in q_norm:
            paths = busy_paths.get(route, []) + sidebar_paths.get(route, [])
            return route, paths

    # Alias table
    for route_key, aliases in _FEATURE_ALIASES.items():
        if any(a in q_norm or a.replace("-", " ") in q_norm for a in aliases):
            if route_key in all_routes:
                paths = busy_paths.get(route_key, []) + sidebar_paths.get(route_key, [])
                return route_key, paths
        if any(tok in aliases for tok in q_tokens):
            if route_key in all_routes:
                paths = busy_paths.get(route_key, []) + sidebar_paths.get(route_key, [])
                return route_key, paths

    # Token overlap scoring
    best_route: str | None = None
    best_score = 0
    best_paths: list[str] = []
    for route in all_routes:
        route_tokens = set(route.replace("-", " ").split())
        score = len(q_tokens & route_tokens)
        for alias_list in _FEATURE_ALIASES.values():
            if route in alias_list:
                score += len(q_tokens & set(alias_list))
        if score > best_score:
            best_score = score
            best_route = route
            best_paths = busy_paths.get(route, []) + sidebar_paths.get(route, [])

    if best_score > 0 and best_route:
        return best_route, best_paths
    return None, []


def resolve_navigation(feature_query: str) -> dict:
    """Return path, shortcut, sources for a natural-language feature query."""
    busy_path = ERP_PATH / "src" / "components" / "BusyMenuBar.tsx"
    sidebar_path = ERP_PATH / "src" / "components" / "Sidebar.tsx"
    app_path = ERP_PATH / "src" / "App.tsx"

    sources: list[str] = []
    shortcuts: dict[str, str] = {}
    busy_paths: dict[str, list[str]] = {}
    sidebar_paths: dict[str, list[str]] = {}
    route_files: dict[str, str] = {}

    if busy_path.exists():
        busy_src = busy_path.read_text(encoding="utf-8", errors="ignore")
        shortcuts = _parse_page_shortcuts(busy_src)
        busy_paths = _parse_busy_menu_tree(busy_src)
        sources.append("src/components/BusyMenuBar.tsx")

    if sidebar_path.exists():
        sidebar_src = sidebar_path.read_text(encoding="utf-8", errors="ignore")
        sidebar_paths = _parse_sidebar_menus(sidebar_src)
        if "src/components/Sidebar.tsx" not in sources:
            sources.append("src/components/Sidebar.tsx")

    if app_path.exists():
        app_src = app_path.read_text(encoding="utf-8", errors="ignore")
        route_files = _parse_app_routes(app_src)
        sources.append("src/App.tsx")

    route, paths = _match_route(feature_query, busy_paths, sidebar_paths)
    if not route or not paths:
        return {
            "found": False,
            "answer": (
                f"I searched the codebase and could not find a navigation path for "
                f'"{feature_query.strip()}". Please check if this feature exists in your version.'
            ),
            "sources": sources,
        }

    # Prefer BusyMenuBar path (more detailed) over Sidebar
    path = paths[0]
    for p in paths:
        if p.count("→") >= 2:
            path = p
            break

    shortcut = shortcuts.get(route, "")
    file_path = route_files.get(route, "")

    answer = f"Path: {path}"
    if shortcut:
        answer += f" · Shortcut: {shortcut}"
    if file_path:
        sources.append(file_path)

    return {
        "found": True,
        "route": route,
        "path": path,
        "shortcut": shortcut,
        "file": file_path,
        "answer": answer,
        "sources": sorted(set(sources)),
    }
