#!/usr/bin/env python3
"""Import completed human review CSV/JSONL overlays without modifying raw sources."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any, Iterator

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import (  # noqa: E402
    REPO_ROOT,
    atomic_write_text,
    load_config,
    rel_to_repo,
    setup_logging,
    update_phase,
    utc_now_iso,
)

logger = setup_logging("import_human_reviews")

ALLOWED_DECISIONS = {
    "approve",
    "approve_with_edit",
    "reject",
    "needs_clarification",
    "defer",
    "promote_to_gold",
}

# Map human_review_sample review_status values → import decisions when decision blank
STATUS_TO_DECISION = {
    "approved": "approve",
    "approve": "approve",
    "approve_with_edit": "approve_with_edit",
    "rejected": "reject",
    "reject": "reject",
    "needs_clarification": "needs_clarification",
    "deferred": "defer",
    "defer": "defer",
    "gold": "promote_to_gold",
    "promote_to_gold": "promote_to_gold",
}


def iter_review_rows(path: Path) -> Iterator[dict[str, Any]]:
    if path.suffix.lower() == ".jsonl":
        with path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    yield json.loads(line)
        return
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            yield dict(row)


def _resolve_decision(row: dict[str, Any]) -> str:
    decision = (row.get("review_decision") or "").strip().lower()
    if decision:
        return decision
    status = (row.get("review_status") or "").strip().lower()
    if status in {"pending", "unreviewed", ""}:
        return ""
    return STATUS_TO_DECISION.get(status, status)


def run(
    *,
    repo_root: Path,
    input_path: Path,
    records_dir: Path,
    reviewer: str = "human",
    replace: bool = False,
) -> int:
    cfg = load_config(repo_root)
    records_dir.mkdir(parents=True, exist_ok=True)
    out_path = records_dir / "review_overlays.jsonl"

    by_id: dict[str, dict[str, Any]] = {}
    if out_path.exists() and not replace:
        for line in out_path.open(encoding="utf-8"):
            if not line.strip():
                continue
            prev = json.loads(line)
            rid = prev.get("record_id")
            if rid:
                by_id[str(rid)] = prev

    skipped = 0
    imported = 0
    for row in iter_review_rows(input_path):
        decision = _resolve_decision(row)
        if not decision:
            skipped += 1
            continue
        if decision not in ALLOWED_DECISIONS:
            logger.warning("Unknown decision %s for %s", decision, row.get("record_id"))
            skipped += 1
            continue
        rid = row.get("record_id")
        if not rid:
            skipped += 1
            continue
        overlay = {
            "record_id": rid,
            "review_id": row.get("review_id"),
            "review_decision": decision,
            "review_status": row.get("review_status"),
            "reviewer_notes": row.get("reviewer_notes") or "",
            "reviewer_correction": row.get("reviewer_correction") or "",
            "language_naturalness": row.get("language_naturalness") or "",
            "intent_correct": row.get("intent_correct") or "",
            "entities_correct": row.get("entities_correct") or "",
            "accounting_correct": row.get("accounting_correct") or "",
            "safety_correct": row.get("safety_correct") or "",
            "reviewed_at": row.get("reviewed_at") or utc_now_iso(),
            "reviewer": row.get("reviewer_name") or reviewer,
            "reviewer_name": row.get("reviewer_name") or reviewer,
            "imported_at": utc_now_iso(),
            "source_review_file": input_path.name,
            "source_file_id": row.get("source_file_id"),
            "quality_score_at_sample": row.get("quality_score"),
            "raw_unchanged": True,
        }
        by_id[str(rid)] = overlay
        imported += 1

    overlays = list(by_id.values())
    lines = [json.dumps(o, ensure_ascii=False, sort_keys=True) for o in overlays]
    atomic_write_text(out_path, "\n".join(lines) + ("\n" if lines else ""))

    summary = {
        "imported_at": utc_now_iso(),
        "input": rel_to_repo(repo_root, input_path),
        "overlay_count": len(overlays),
        "imported_this_run": imported,
        "skipped_pending_or_empty": skipped,
        "merge_mode": not replace,
        "note": "Overlays only — raw KB files and historical JSONL records are never rewritten.",
    }
    atomic_write_text(
        records_dir / "review_overlays_summary.json",
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n",
    )

    update_phase(
        "4",
        name="Human-Review Sample and Gold Promotion Workflow",
        status="passed",
        finish=True,
        commands=[f"python knowledgebase/scripts/import_human_reviews.py --input {input_path}"],
        outputs=[rel_to_repo(repo_root, out_path)],
        findings=[
            f"Imported overlays: {len(overlays)}",
            f"Skipped empty decisions: {skipped}",
        ],
        extra={"overlay_count": len(overlays)},
        next_phase="5",
    )
    logger.info(
        "Imported %d new overlays (total=%d skipped=%d merge=%s)",
        imported,
        len(overlays),
        skipped,
        not replace,
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    cfg = load_config()
    parser = argparse.ArgumentParser(description="Import human review overlays")
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--input", type=Path, required=True, help="CSV or JSONL review file")
    parser.add_argument("--records-dir", type=Path, default=None)
    parser.add_argument("--reviewer", type=str, default="human")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace entire overlays file instead of merging by record_id",
    )
    args = parser.parse_args(argv)
    repo_root = args.repo_root.resolve()
    records_dir = (args.records_dir or repo_root / cfg["paths"]["processed_records_dir"]).resolve()
    return run(
        repo_root=repo_root,
        input_path=args.input.resolve(),
        records_dir=records_dir,
        reviewer=args.reviewer,
        replace=args.replace,
    )


if __name__ == "__main__":
    sys.exit(main())
