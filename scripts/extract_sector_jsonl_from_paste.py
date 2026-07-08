#!/usr/bin/env python3
"""Extract JSONL sector examples from a mixed paste (narrative + JSON lines)."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def extract_objects(text: str) -> list[dict]:
    rows: list[dict] = []
    # Normalize: split concatenated objects on }{ boundaries
    chunks = re.split(r"\}\s*(?:Copy\s*)?\n\s*\{", text)
    for i, chunk in enumerate(chunks):
        s = chunk.strip()
        if not s.startswith("{"):
            s = "{" + s
        if not s.endswith("}"):
            s = s + "}"
        s = re.sub(r'\s*Copy\s*$', '', s)
        try:
            obj = json.loads(s)
            if isinstance(obj, dict) and obj.get("sector"):
                rows.append(obj)
        except json.JSONDecodeError:
            continue
    # Also try line-by-line for clean JSONL
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("Copy"):
            line = line[4:].strip()
        if not line.startswith("{") or '"sector"' not in line:
            continue
        try:
            obj = json.loads(line)
            if isinstance(obj, dict) and obj.get("sector"):
                key = (obj.get("sector"), obj.get("user_input"))
                if not any((r.get("sector"), r.get("user_input")) == key for r in rows):
                    rows.append(obj)
        except json.JSONDecodeError:
            continue
    # dedupe by sector+user_input
    seen: set[tuple[str, str]] = set()
    out: list[dict] = []
    for r in rows:
        key = (str(r.get("sector") or ""), str(r.get("user_input") or ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/dev/stdin")
    text = path.read_text(encoding="utf-8") if str(path) != "/dev/stdin" else sys.stdin.read()
    rows = extract_objects(text)
    by_sector: dict[str, list[dict]] = {}
    for r in rows:
        by_sector.setdefault(str(r["sector"]), []).append(r)
    for sector, items in sorted(by_sector.items()):
        print(f"{sector}: {len(items)} examples")


if __name__ == "__main__":
    main()
