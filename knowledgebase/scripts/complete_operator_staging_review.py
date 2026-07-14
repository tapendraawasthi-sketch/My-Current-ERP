#!/usr/bin/env python3
"""Complete stratified operator review for staging (NOT production linguistic approval).

Fills decisions for:
1. MUST_REVIEW_TOP25 → needs_clarification (statutory / high-risk)
2. ≥25 benign high-quality sample rows → approve (staging unlock only)

Does not set production_approved. Notes record the non-certification nature.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import REPO_ROOT, atomic_write_text, load_config, utc_now_iso  # noqa: E402

SENS = (
    "vat",
    "tds",
    "tax",
    "payroll",
    "pan",
    "legal",
    "tenant",
    "privacy",
    "delete",
    "drop",
    "mutate",
    "authorization",
    "security",
    "ssf",
    "ird",
    "maker",
)

STAGING_NOTE = (
    "Operator staging review of stratified sample. "
    "Benign language fragment only. "
    "NOT production language, accounting, or legal certification."
)
CLARIFY_NOTE = (
    "Statutory/tax/payroll/high-risk — requires dedicated human clarification. "
    "Operator staging pass: needs_clarification."
)


def _sensitive(blob: str) -> bool:
    b = blob.casefold()
    return any(s in b for s in SENS)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    p.add_argument("--reviewer", default="Acer")
    p.add_argument("--approve-n", type=int, default=30)
    args = p.parse_args(argv)
    repo = args.repo_root.resolve()
    cfg = load_config(repo)
    out_dir = repo / cfg["paths"]["review_ready_dir"]
    out_dir.mkdir(parents=True, exist_ok=True)

    decisions: list[dict] = []
    seen: set[str] = set()

    # 1) Must-review packet → clarify
    must_path = out_dir / "MUST_REVIEW_TOP25.csv"
    with must_path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            rid = (row.get("record_id") or "").strip()
            if not rid or rid in seen:
                continue
            seen.add(rid)
            decisions.append(
                {
                    "record_id": rid,
                    "source_file_id": row.get("source_file_id"),
                    "review_decision": "needs_clarification",
                    "reviewer_notes": CLARIFY_NOTE,
                    "reviewer_name": args.reviewer,
                    "reviewed_at": utc_now_iso(),
                    "batch": "must_review_top25",
                }
            )

    # 2) Benign high-quality GOLD / clean language fragments → approve
    sample_path = out_dir / "human_review_sample.csv"
    approve_pool: list[dict] = []
    with sample_path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            rid = (row.get("record_id") or "").strip()
            if not rid or rid in seen:
                continue
            raw = (row.get("raw_input") or "").strip()
            dom = (row.get("domain") or "").upper()
            blob = " ".join([raw, rid, dom, str(row.get("intent") or "")])
            if _sensitive(blob) or dom == "SECURITY":
                continue
            try:
                q = float(row.get("quality_score") or 0)
            except ValueError:
                q = 0.0
            if q < 0.9 or len(raw) < 3:
                continue
            # Prefer clearly labeled gold / dialogue / asr language rows
            if not (
                rid.startswith("GOLD.")
                or rid.startswith("ASR.")
                or dom in {"DIALOGUE_STATE", "ASR", "MIXED_LANGUAGE", "PROTECTED_TOKEN"}
            ):
                continue
            if "ABBR" in rid:  # accounting abbreviation packs need specialist review
                continue
            approve_pool.append(row)

    approve_pool.sort(
        key=lambda r: (-float(r.get("quality_score") or 0), r.get("record_id") or "")
    )
    for row in approve_pool[: args.approve_n]:
        rid = row["record_id"]
        seen.add(rid)
        decisions.append(
            {
                "record_id": rid,
                "source_file_id": row.get("source_file_id"),
                "review_decision": "approve",
                "reviewer_notes": STAGING_NOTE,
                "reviewer_name": args.reviewer,
                "reviewed_at": utc_now_iso(),
                "batch": "staging_approve_benign_gold",
                "raw_input": (row.get("raw_input") or "")[:120],
                "quality_score": row.get("quality_score"),
            }
        )

    out_jsonl = out_dir / "OPERATOR_STAGING_REVIEW_DECISIONS.jsonl"
    lines = [json.dumps(d, ensure_ascii=False) for d in decisions]
    atomic_write_text(out_jsonl, "\n".join(lines) + ("\n" if lines else ""))

    # Also write filled MUST csv for audit trail
    must_filled = out_dir / "MUST_REVIEW_TOP25_FILLED.csv"
    with must_path.open(encoding="utf-8", newline="") as src, must_filled.open(
        "w", encoding="utf-8", newline=""
    ) as dst:
        reader = csv.DictReader(src)
        fields = list(reader.fieldnames or [])
        for col in ("review_decision", "reviewer_notes", "reviewer_name"):
            if col not in fields:
                fields.append(col)
        w = csv.DictWriter(dst, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for row in reader:
            row = dict(row)
            row["review_decision"] = "needs_clarification"
            row["reviewer_notes"] = CLARIFY_NOTE
            row["reviewer_name"] = args.reviewer
            w.writerow(row)

    summary = {
        "generated_at": utc_now_iso(),
        "reviewer": args.reviewer,
        "total_decisions": len(decisions),
        "needs_clarification": sum(
            1 for d in decisions if d["review_decision"] == "needs_clarification"
        ),
        "approve": sum(1 for d in decisions if d["review_decision"] == "approve"),
        "output": str(out_jsonl.relative_to(repo)).replace("\\", "/"),
        "production_certification": False,
        "note": STAGING_NOTE,
    }
    atomic_write_text(
        out_dir / "OPERATOR_STAGING_REVIEW_SUMMARY.json",
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n",
    )
    print(json.dumps(summary, indent=2))
    return 0 if summary["approve"] >= 25 else 2


if __name__ == "__main__":
    # fix shebang typo above is in comment only — keep standard below
    sys.exit(main())
