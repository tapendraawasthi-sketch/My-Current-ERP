#!/usr/bin/env python3
"""Export a prioritized high-risk human review queue from the full sample."""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from pathlib import Path
from typing import Any

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import (  # noqa: E402
    REPO_ROOT,
    atomic_write_text,
    load_config,
    setup_logging,
    utc_now_iso,
)

logger = setup_logging("export_priority_review_queue")

PRIORITY_WEIGHTS: list[tuple[str, int]] = [
    ("tenant", 100),
    ("cross-tenant", 100),
    ("legal hold", 95),
    ("legal_hold", 95),
    ("payroll", 90),
    ("salary", 88),
    ("destructive", 92),
    ("mutation", 85),
    ("authorization", 84),
    ("maker", 84),
    ("checker", 84),
    ("security", 83),
    ("privacy", 82),
    ("period", 80),
    ("vat", 78),
    ("tds", 78),
    ("tax", 77),
    ("banking", 75),
    ("audit", 74),
    ("deployment", 70),
    ("accounting", 60),
]


def score_row(row: dict[str, Any]) -> int:
    blob = " ".join(
        str(row.get(k) or "")
        for k in (
            "domain",
            "raw_input",
            "intent",
            "operation_class",
            "expected_behavior",
            "machine_precheck_notes",
            "record_id",
        )
    ).casefold()
    score = 0
    hits = []
    for kw, w in PRIORITY_WEIGHTS:
        if kw in blob:
            score += w
            hits.append(kw)
    if row.get("execution_allowed") in (True, "true", "True", 1, "1"):
        score += 200
        hits.append("execution_allowed_true")
    if row.get("contradiction_group"):
        score += 40
        hits.append("contradiction")
    row["_priority_hits"] = ",".join(hits)
    return score


def main(argv: list[str] | None = None) -> int:
    cfg = load_config()
    p = argparse.ArgumentParser(description="Export priority review queue")
    p.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    p.add_argument("--target", type=int, default=250)
    args = p.parse_args(argv)
    repo = args.repo_root.resolve()
    src = repo / cfg["paths"]["review_ready_dir"] / "human_review_sample.jsonl"
    out_dir = repo / cfg["paths"]["review_ready_dir"]
    rows = [json.loads(l) for l in src.open(encoding="utf-8") if l.strip()]
    ranked = sorted(rows, key=lambda r: (-score_row(r), str(r.get("record_id"))))
    selected = ranked[: args.target]

    # Ensure diversification: at least one from each high-risk keyword bucket when possible
    for kw, _w in PRIORITY_WEIGHTS[:12]:
        if any(kw in str(r.get("_priority_hits", "")) for r in selected):
            continue
        for r in ranked:
            if kw in str(r.get("_priority_hits", "")) and r not in selected:
                selected.append(r)
                break
    selected = selected[: max(args.target, 250)]

    jsonl_path = out_dir / "priority_review_queue.jsonl"
    csv_path = out_dir / "priority_review_queue.csv"
    with jsonl_path.open("w", encoding="utf-8", newline="\n") as fh:
        for i, row in enumerate(selected, start=1):
            row = dict(row)
            row["priority_rank"] = i
            row["priority_hits"] = row.pop("_priority_hits", "")
            fh.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")

    fields = [
        "priority_rank",
        "priority_hits",
        "review_id",
        "source_file_id",
        "record_id",
        "domain",
        "language_form",
        "raw_input",
        "intent",
        "operation_class",
        "execution_allowed",
        "quality_score",
        "safety_correct",
        "language_naturalness",
        "intent_correct",
        "accounting_correct",
        "review_decision",
        "review_status",
        "reviewer_notes",
        "reviewer_name",
        "reviewed_at",
    ]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for i, row in enumerate(selected, start=1):
        out = dict(row)
        out["priority_rank"] = i
        out["priority_hits"] = out.get("priority_hits") or out.pop("_priority_hits", "")
        w.writerow(out)
    atomic_write_text(csv_path, buf.getvalue())

    summary = {
        "generated_at": utc_now_iso(),
        "source_sample_size": len(rows),
        "priority_queue_size": len(selected),
        "outputs": [
            str(jsonl_path.relative_to(repo).as_posix()),
            str(csv_path.relative_to(repo).as_posix()),
        ],
        "instruction": (
            "Review this queue first. Fill review_decision "
            "(approve|approve_with_edit|reject|needs_clarification|defer|promote_to_gold), "
            "then import with import_human_reviews.py"
        ),
    }
    atomic_write_text(
        out_dir / "priority_review_queue_summary.json",
        json.dumps(summary, indent=2) + "\n",
    )
    logger.info("Wrote priority queue n=%s", len(selected))
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
