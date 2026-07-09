#!/usr/bin/env python3
"""Build complex reasoning scenario golden corpus from user paste JSONL."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG = ROOT / "data" / "nepal-ai" / "language"
PASTE = LANG / "_user_complex_paste.jsonl"
OUT_JSONL = LANG / "complex_reasoning_scenarios.jsonl"
OUT_EXPORT = LANG / "complex_reasoning_scenarios_export.json"
OUT_MAP = LANG / "complex_reasoning_scenario_query_map.json"
OUT_BY_TYPE = LANG / "complex_reasoning_scenarios_by_type.json"


def normalize_key(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().strip().rstrip("?!."))


def load_paste_rows() -> list[dict]:
    rows: list[dict] = []
    for line in PASTE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def enrich(rows: list[dict]) -> list[dict]:
    out: list[dict] = []
    for row in rows:
        scenario_type = str(row.get("scenario_type") or "")
        out.append(
            {
                "id": str(row.get("scenario_id") or ""),
                "source": "user_exact",
                "scenario_id": row.get("scenario_id"),
                "scenario_type": scenario_type,
                "scenario_type_key": scenario_type,
                "input": row["input"],
                "input_normalized": normalize_key(row["input"]),
                "surface_contradiction": row.get("surface_contradiction") or "",
                "reasoning_required": row.get("reasoning_required") or [],
                "clarification_needed": bool(row.get("clarification_needed")),
                "clarify_question": row.get("clarify_question"),
                "possible_resolutions": row.get("possible_resolutions") or [],
                "intent": "complex_reasoning",
                "NOT_transaction": True,
                "domain": "nepal_business_reasoning",
            }
        )
    return out


def build_query_map(rows: list[dict]) -> dict:
    query_map: dict = {}

    for row in rows:
        meta = {
            "id": row["id"],
            "scenarioType": row["scenario_type"],
            "scenarioTypeKey": row["scenario_type_key"],
            "clarificationNeeded": row["clarification_needed"],
        }

        def add(alias: str) -> None:
            key = normalize_key(alias) if alias != row["input"] else alias
            if not key or key in query_map:
                return
            query_map[key] = meta

        add(row["input"])
        add(row["input_normalized"])
        add(row["scenario_id"])

    return query_map


def build_by_type(rows: list[dict]) -> dict:
    by_type: dict[str, list[str]] = {}
    for row in rows:
        key = row["scenario_type_key"]
        by_type.setdefault(key, []).append(row["id"])
    return by_type


def main() -> int:
    if not PASTE.exists():
        print(f"Missing paste file: {PASTE}")
        return 1

    rows = enrich(load_paste_rows())
    query_map = build_query_map(rows)
    by_type = build_by_type(rows)

    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    OUT_EXPORT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MAP.write_text(json.dumps(query_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_BY_TYPE.write_text(json.dumps(by_type, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"rows={len(rows)}")
    print(f"first={rows[0]['id']} {rows[0]['scenario_type']}")
    print(f"last={rows[-1]['id']} {rows[-1]['scenario_type']}")
    print(f"types={len(by_type)}")
    print(f"aliases={len(query_map)}")
    clarify = sum(1 for r in rows if r["clarification_needed"])
    print(f"clarify_needed={clarify}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
