#!/usr/bin/env python3
"""Export a top-N must-review packet for same-day human review."""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import REPO_ROOT, atomic_write_text, load_config, utc_now_iso  # noqa: E402

MUST_HINTS = (
    "tenant",
    "legal",
    "privacy",
    "payroll",
    "destructive",
    "mutation",
    "authorization",
    "maker",
    "vat",
    "tds",
    "tax",
    "security",
)


def main(argv: list[str] | None = None) -> int:
    cfg = load_config()
    p = argparse.ArgumentParser()
    p.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    p.add_argument("--n", type=int, default=25)
    args = p.parse_args(argv)
    repo = args.repo_root.resolve()
    src = repo / cfg["paths"]["review_ready_dir"] / "priority_review_queue.jsonl"
    rows = [json.loads(l) for l in src.open(encoding="utf-8") if l.strip()]

    def rank(r: dict) -> tuple:
        hits = str(r.get("priority_hits") or "").casefold()
        score = sum(20 for h in MUST_HINTS if h in hits)
        if r.get("machine_suggested_decision") == "needs_clarification":
            score += 50
        return (-score, int(r.get("priority_rank") or 9999))

    selected = sorted(rows, key=rank)[: args.n]
    out_dir = repo / cfg["paths"]["review_ready_dir"]
    md_lines = [
        "# ONLI Must-Review Packet (Top 25)",
        "",
        f"Generated: {utc_now_iso()}",
        "",
        "Complete these first in the review lab or CSV. This is not approval — it is a work queue.",
        "",
    ]
    for i, r in enumerate(selected, 1):
        md_lines.extend(
            [
                f"## {i}. `{r.get('record_id')}` (file {r.get('source_file_id')})",
                "",
                f"- priority_hits: `{r.get('priority_hits')}`",
                f"- suggestion: **{r.get('machine_suggested_decision')}** — {r.get('machine_suggestion_rationale')}",
                f"- execution_allowed: `{r.get('execution_allowed')}`",
                f"- raw_input: {r.get('raw_input') or '_(empty)_'}",
                f"- intent: {r.get('intent')}",
                "",
                "Decision: [ ] approve  [ ] approve_with_edit  [ ] reject  [ ] needs_clarification  [ ] defer  [ ] promote_to_gold",
                "",
                "Notes:",
                "",
                "---",
                "",
            ]
        )
    atomic_write_text(out_dir / "MUST_REVIEW_TOP25.md", "\n".join(md_lines))

    fields = [
        "packet_rank",
        "record_id",
        "source_file_id",
        "priority_hits",
        "machine_suggested_decision",
        "raw_input",
        "intent",
        "execution_allowed",
        "review_decision",
        "reviewer_notes",
        "reviewer_name",
    ]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for i, r in enumerate(selected, 1):
        w.writerow(
            {
                "packet_rank": i,
                "record_id": r.get("record_id"),
                "source_file_id": r.get("source_file_id"),
                "priority_hits": r.get("priority_hits"),
                "machine_suggested_decision": r.get("machine_suggested_decision"),
                "raw_input": r.get("raw_input"),
                "intent": r.get("intent"),
                "execution_allowed": r.get("execution_allowed"),
                "review_decision": "",
                "reviewer_notes": "",
                "reviewer_name": "",
            }
        )
    atomic_write_text(out_dir / "MUST_REVIEW_TOP25.csv", buf.getvalue())

    # Fillable JSONL template (same rows) for batch import via import_human_reviews.py
    decision_lines = []
    for i, r in enumerate(selected, 1):
        decision_lines.append(
            json.dumps(
                {
                    "packet_rank": i,
                    "record_id": r.get("record_id"),
                    "source_file_id": r.get("source_file_id"),
                    "machine_suggested_decision": r.get("machine_suggested_decision"),
                    "raw_input": r.get("raw_input"),
                    "review_decision": "",
                    "reviewer_notes": "",
                    "reviewer_name": "",
                },
                ensure_ascii=False,
            )
        )
    atomic_write_text(
        out_dir / "MUST_REVIEW_DECISIONS.jsonl",
        "\n".join(decision_lines) + ("\n" if decision_lines else ""),
    )
    print(
        json.dumps(
            {
                "n": len(selected),
                "md": "knowledgebase/processed/review_ready/MUST_REVIEW_TOP25.md",
                "csv": "knowledgebase/processed/review_ready/MUST_REVIEW_TOP25.csv",
                "jsonl": "knowledgebase/processed/review_ready/MUST_REVIEW_DECISIONS.jsonl",
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
