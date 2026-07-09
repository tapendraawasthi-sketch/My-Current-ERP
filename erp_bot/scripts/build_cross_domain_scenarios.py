#!/usr/bin/env python3
"""Build cross-domain reasoning scenario golden corpus from user paste JSONL."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG = ROOT / "data" / "nepal-ai" / "language"
PASTE = LANG / "_user_xdomain_paste.jsonl"
OUT_JSONL = LANG / "cross_domain_scenarios.jsonl"
OUT_EXPORT = LANG / "cross_domain_scenarios_export.json"
OUT_MAP = LANG / "cross_domain_scenario_query_map.json"
OUT_BY_DOMAINS = LANG / "cross_domain_scenarios_by_domain.json"


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
        domains = row.get("domains_involved") or []
        out.append(
            {
                "id": str(row.get("scenario_id") or ""),
                "source": "user_exact",
                "scenario_id": row.get("scenario_id"),
                "domains_involved": domains,
                "domain_keys": domains,
                "input": row["input"],
                "input_normalized": normalize_key(row["input"]),
                "domain_knowledge_required": row.get("domain_knowledge_required") or [],
                "reasoning_chain": row.get("reasoning_chain") or [],
                "answer_ne": row.get("answer_ne") or "",
                "journal_entries": row.get("journal_entries") or [],
                "intent": "cross_domain_reasoning",
                "NOT_transaction": True,
                "domain": "cross_domain_nepal_business",
            }
        )
    return out


def build_query_map(rows: list[dict]) -> dict:
    query_map: dict = {}

    for row in rows:
        meta = {
            "id": row["id"],
            "domainsInvolved": row["domains_involved"],
        }

        def add(alias: str) -> None:
            if not alias:
                return
            key = alias if alias == row["input"] else normalize_key(alias)
            if key in query_map:
                return
            query_map[key] = meta

        add(row["input"])
        add(row["input_normalized"])
        add(row["scenario_id"])

    return query_map


def build_by_domain(rows: list[dict]) -> dict:
    by_domain: dict[str, list[str]] = {}
    for row in rows:
        for dom in row.get("domain_keys") or []:
            by_domain.setdefault(str(dom), []).append(row["id"])
    return by_domain


def main() -> int:
    if not PASTE.exists():
        print(f"Missing paste file: {PASTE}")
        return 1

    rows = enrich(load_paste_rows())
    query_map = build_query_map(rows)
    by_domain = build_by_domain(rows)

    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    OUT_EXPORT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MAP.write_text(json.dumps(query_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_BY_DOMAINS.write_text(
        json.dumps(by_domain, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"rows={len(rows)}")
    print(f"first={rows[0]['id']} domains={rows[0]['domains_involved']}")
    print(f"last={rows[-1]['id']} domains={rows[-1]['domains_involved']}")
    print(f"domain_keys={len(by_domain)}")
    print(f"aliases={len(query_map)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
