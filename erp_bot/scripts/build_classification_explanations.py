#!/usr/bin/env python3
"""Build classification-explanation teaching corpus from user paste JSONL."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANG = ROOT / "data" / "nepal-ai" / "language"
PASTE = LANG / "_user_cexplain_paste.jsonl"
OUT_JSONL = LANG / "classification_explanations.jsonl"
OUT_EXPORT = LANG / "classification_explanations_export.json"
OUT_MAP = LANG / "classification_explanation_query_map.json"
OUT_BY_TYPE = LANG / "classification_explanations_by_type.json"


def normalize_key(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().strip().rstrip("?!."))


def infer_explanation_type(ai_action: str) -> str:
    a = (ai_action or "").lower()
    if a.startswith("classified as"):
        return "classification"
    if "asked clarification" in a or a.startswith("asked '"):
        return "clarification_prompt"
    if "explained need for" in a or "explained importance" in a or "explained reason for" in a:
        return "why_field_asked"
    if (
        "explained knowledge source" in a
        or "explained evidence" in a
        or "explained reliance" in a
        or "explained source" in a
        or "explained detection" in a
        or "explained reconciliation" in a
    ):
        return "source_evidence"
    if (
        "correction" in a
        or "corrected" in a
        or "reclassif" in a
        or "normalized" in a
        or "specified" in a
        or "split" in a
        or "provided correction" in a
        or ("classified" in a and "generic" in a)
    ):
        return "correction"
    if "explained" in a:
        return "system_reasoning"
    return "other"


def extract_classified_intent(ai_action: str) -> str:
    m = re.search(r"classified as\s+([a-z0-9_]+)", ai_action or "", re.I)
    return m.group(1).lower() if m else ""


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
        explain_id = f"cexplain_{i:03d}"
        ai_action = row.get("ai_action") or ""
        explanation_type = infer_explanation_type(ai_action)
        out.append(
            {
                "id": explain_id,
                "source": "user_exact",
                "explain_id": explain_id,
                "scenario": row.get("scenario") or "",
                "ai_action": ai_action,
                "ai_classified_intent": extract_classified_intent(ai_action),
                "user_might_ask": row.get("user_might_ask") or "",
                "user_might_ask_normalized": normalize_key(row.get("user_might_ask") or ""),
                "explanation_ne": row.get("explanation_ne") or "",
                "explanation_en": row.get("explanation_en") or "",
                "concepts_explained": row.get("concepts_explained") or [],
                "teaching_value": row.get("teaching_value") or "medium",
                "explanation_type": explanation_type,
                "explanation_type_key": explanation_type,
                "intent": "classification_explanation",
                "NOT_transaction": True,
                "NOT_question": True,
                "domain": "ai_transparency_teaching",
            }
        )
    return out


def build_query_map(rows: list[dict]) -> dict:
    query_map: dict = {}

    for row in rows:
        meta = {
            "id": row["id"],
            "explanationType": row["explanation_type"],
            "explanationTypeKey": row["explanation_type_key"],
            "teachingValue": row["teaching_value"],
            "aiClassifiedIntent": row["ai_classified_intent"],
        }

        def add(alias: str) -> None:
            if not alias:
                return
            key = alias if alias == row["user_might_ask"] else normalize_key(alias)
            if key in query_map:
                return
            query_map[key] = meta

        add(row["user_might_ask"])
        add(row["user_might_ask_normalized"])
        add(row["explain_id"])

    return query_map


def build_by_type(rows: list[dict]) -> dict:
    by_type: dict[str, list[str]] = {}
    for row in rows:
        key = row["explanation_type_key"]
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
    print(f"first={rows[0]['id']} type={rows[0]['explanation_type']}")
    print(f"last={rows[-1]['id']} type={rows[-1]['explanation_type']}")
    print(f"type_keys={len(by_type)}")
    print(f"aliases={len(query_map)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
