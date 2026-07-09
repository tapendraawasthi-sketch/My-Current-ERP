#!/usr/bin/env python3
"""Build system-prompt A/B variant golden corpus from user paste JSONL."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BEHAVIOR = ROOT / "data" / "nepal-ai" / "behavior"
PASTE = BEHAVIOR / "_user_prompt_variant_paste.jsonl"
OUT_JSONL = BEHAVIOR / "prompt_variants.jsonl"
OUT_EXPORT = BEHAVIOR / "prompt_variants_export.json"
OUT_MAP = BEHAVIOR / "prompt_variant_query_map.json"
OUT_BY_BEHAVIOR = BEHAVIOR / "prompt_variants_by_behavior.json"


def slug_behavior(behavior: str) -> str:
    key = re.sub(r"[^a-zA-Z0-9]+", "_", (behavior or "").lower()).strip("_")
    return re.sub(r"_+", "_", key) or "unknown"


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
    for i, row in enumerate(rows, start=1):
        variant_id = str(row.get("variant_id") or f"prompt_v{i}")
        target_behavior = str(row.get("target_behavior") or "")
        out.append(
            {
                "id": variant_id,
                "source": "user_exact",
                "variant_id": variant_id,
                "target_behavior": target_behavior,
                "target_behavior_key": slug_behavior(target_behavior),
                "system_prompt": row.get("system_prompt") or "",
                "key_instructions": row.get("key_instructions") or [],
                "expected_strengths": row.get("expected_strengths") or [],
                "expected_weaknesses": row.get("expected_weaknesses") or [],
                "test_inputs": row.get("test_inputs") or [],
                "evaluation_criteria": row.get("evaluation_criteria") or [],
                "intent": "prompt_variant_ab_test",
                "NOT_transaction": True,
                "domain": "system_prompt_ab_testing",
            }
        )
    return out


def build_query_map(rows: list[dict]) -> dict:
    query_map: dict = {}

    for row in rows:
        meta = {
            "id": row["id"],
            "variantId": row["variant_id"],
            "targetBehavior": row["target_behavior"],
            "targetBehaviorKey": row["target_behavior_key"],
        }

        def add(alias: str) -> None:
            if not alias:
                return
            key = normalize_key(alias)
            if key in query_map:
                return
            query_map[key] = meta

        # variant_id + behavior keys only — test_inputs are eval harness goldens, not chat aliases
        add(row["variant_id"])
        add(row["target_behavior"])
        add(row["target_behavior_key"])

    return query_map


def build_by_behavior(rows: list[dict]) -> dict:
    by_behavior: dict[str, list[str]] = {}
    for row in rows:
        key = row["target_behavior_key"]
        by_behavior.setdefault(key, []).append(row["id"])
    return by_behavior


def main() -> int:
    if not PASTE.exists():
        print(f"Missing paste file: {PASTE}")
        return 1

    rows = enrich(load_paste_rows())
    query_map = build_query_map(rows)
    by_behavior = build_by_behavior(rows)

    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    OUT_EXPORT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MAP.write_text(json.dumps(query_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_BY_BEHAVIOR.write_text(
        json.dumps(by_behavior, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"rows={len(rows)}")
    print(f"first={rows[0]['id']} behavior={rows[0]['target_behavior_key']}")
    print(f"last={rows[-1]['id']} behavior={rows[-1]['target_behavior_key']}")
    print(f"behavior_keys={len(by_behavior)}")
    print(f"aliases={len(query_map)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
