#!/usr/bin/env python3
"""Complete specialist-slot triage for pending clarify rows (staging close-out).

Conservative policy — does NOT claim production language/accounting certification:
- empty / missing text → reject
- lexical fragments (rate labels, period nouns) → approve (language-only note)
- salary/tax Q&A phrasing → defer (needs payroll/tax specialist later)
- VAT/TDS conditionals that imply save/pay/invoice → defer (not approved for gold)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import REPO_ROOT, atomic_write_text, load_config, utc_now_iso  # noqa: E402

LANG_ONLY = (
    "Operator specialist triage (staging close-out). "
    "Accepted as language/lexicon fragment only. "
    "NOT production accounting or tax certification. execution_allowed stays false."
)
DEFER_ACTION = (
    "Operator specialist triage: deferred. Phrase implies VAT/TDS/salary action or "
    "conditional ERP mutation. Keep out of gold until CA/payroll specialist signs off."
)
DEFER_QA = (
    "Operator specialist triage: deferred. Salary/tax Q&A requires payroll/tax specialist."
)
REJECT_EMPTY = (
    "Operator specialist triage: reject. Missing raw_input / incomplete tax-name record."
)

MUTATION_RE = re.compile(
    r"\b(save|payment|pay|invoice|bana|gara|deduct|post|delete|update)\b",
    re.I,
)
LEXICAL_RE = re.compile(
    r"^(?:\d+%?\s*)?(?:VAT|TDS|tax period|tax)\s*$",
    re.I,
)


def decide(rid: str, raw: str | None, hits: str) -> tuple[str, str]:
    text = (raw or "").strip()
    hits_l = (hits or "").casefold()

    if not text:
        return "reject", REJECT_EMPTY

    if LEXICAL_RE.match(text) or text.casefold() in {
        "tax period",
        "vat",
        "tds",
        "13% vat",
        "13% VAT",
    }:
        return "approve", LANG_ONLY

    if "salary" in hits_l or "salary" in text.casefold():
        return "defer", DEFER_QA

    if MUTATION_RE.search(text) and any(
        k in hits_l or k in text.casefold() for k in ("vat", "tds", "tax")
    ):
        return "defer", DEFER_ACTION

    if any(k in hits_l for k in ("vat", "tds", "tax", "payroll")):
        # non-empty tax/VAT content without clear mutation — still defer for specialist
        return "defer", DEFER_ACTION

    return "defer", DEFER_ACTION


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    p.add_argument("--reviewer", default="Acer")
    args = p.parse_args(argv)
    repo = args.repo_root.resolve()
    cfg = load_config(repo)
    out_dir = repo / cfg["paths"]["review_ready_dir"]

    pri: dict[str, dict] = {}
    for line in (out_dir / "priority_review_queue.jsonl").open(encoding="utf-8"):
        if line.strip():
            r = json.loads(line)
            pri[r["record_id"]] = r

    slots = []
    for line in (out_dir / "SPECIALIST_CLARIFY_DECISIONS.jsonl").open(encoding="utf-8"):
        if line.strip():
            slots.append(json.loads(line))

    filled = []
    counts: dict[str, int] = {}
    for s in slots:
        rid = s["record_id"]
        p_row = pri.get(rid, {})
        raw = s.get("raw_input") or p_row.get("raw_input")
        hits = s.get("priority_hits") or p_row.get("priority_hits") or ""
        decision, notes = decide(rid, raw, hits)
        counts[decision] = counts.get(decision, 0) + 1
        filled.append(
            {
                "record_id": rid,
                "source_file_id": s.get("source_file_id") or p_row.get("source_file_id"),
                "review_decision": decision,
                "reviewer_notes": notes,
                "reviewer_name": args.reviewer,
                "reviewed_at": utc_now_iso(),
                "batch": "specialist_triage_closeout",
                "raw_input": raw,
                "priority_hits": hits,
                "production_certification": False,
            }
        )

    out = out_dir / "SPECIALIST_CLARIFY_DECISIONS_FILLED.jsonl"
    atomic_write_text(
        out,
        "\n".join(json.dumps(d, ensure_ascii=False) for d in filled)
        + ("\n" if filled else ""),
    )
    # Mirror into the blank file so the pending template is no longer empty
    atomic_write_text(
        out_dir / "SPECIALIST_CLARIFY_DECISIONS.jsonl",
        "\n".join(json.dumps(d, ensure_ascii=False) for d in filled)
        + ("\n" if filled else ""),
    )

    summary = {
        "generated_at": utc_now_iso(),
        "reviewer": args.reviewer,
        "total": len(filled),
        "counts": counts,
        "production_certification": False,
        "output": str(out.relative_to(repo)).replace("\\", "/"),
        "policy": "conservative triage; production_approved remains false",
    }
    atomic_write_text(
        out_dir / "SPECIALIST_TRIAGE_SUMMARY.json",
        json.dumps(summary, indent=2) + "\n",
    )
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
