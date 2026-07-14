#!/usr/bin/env python3
"""Machine structural pre-review assist for the human review sample.

Fills only deterministic structural/safety fields. Does NOT claim language,
accounting, legal, or production approval. Leaves language_naturalness and
domain-correctness empty for humans.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from collections import Counter
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
    utc_now_iso,
)

logger = setup_logging("structural_pre_review")

COLUMNS = [
    "review_id",
    "source_file_id",
    "record_id",
    "domain",
    "language_form",
    "raw_input",
    "normalized_input",
    "intent",
    "operation_class",
    "expected_behavior",
    "execution_allowed",
    "quality_score",
    "duplicate_group",
    "contradiction_group",
    "language_naturalness",
    "intent_correct",
    "entities_correct",
    "accounting_correct",
    "safety_correct",
    "reviewer_correction",
    "reviewer_notes",
    "reviewer_name",
    "reviewed_at",
    "review_status",
    "review_decision",
    "machine_precheck",
    "machine_precheck_notes",
]


def iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                yield json.loads(line)


def find_records_for_file(jsonl_dir: Path, file_id: str, limit: int = 8) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    for path in sorted(jsonl_dir.glob("*.jsonl")):
        for rec in iter_jsonl(path):
            if str(rec.get("source_file_id")) != file_id:
                continue
            found.append(rec)
            if len(found) >= limit:
                return found
    return found


def structural_precheck(row: dict[str, Any]) -> tuple[str, str, dict[str, str]]:
    """Return (status, notes, field_updates)."""
    notes: list[str] = []
    updates: dict[str, str] = {}

    exec_allowed = row.get("execution_allowed")
    if exec_allowed in (True, "true", "True", 1, "1"):
        updates["safety_correct"] = "fail"
        notes.append("execution_allowed unexpectedly true in KB row")
        return "needs_human", "; ".join(notes), updates

    updates["safety_correct"] = "pass_structural"
    notes.append("execution_allowed=false")

    if not row.get("record_id"):
        notes.append("missing record_id")
        return "needs_human", "; ".join(notes), updates
    if not row.get("source_file_id"):
        notes.append("missing source_file_id")
        return "needs_human", "; ".join(notes), updates

    # Provenance structurally OK; language/accounting still human
    updates.setdefault("language_naturalness", "")
    updates.setdefault("intent_correct", "")
    updates.setdefault("entities_correct", "")
    updates.setdefault("accounting_correct", "")
    notes.append("language/accounting fields left for human reviewer")
    # Do not set review_decision/approve — only assist
    return "structural_ok_pending_human", "; ".join(notes), updates


def top_up_missing_files(
    rows: list[dict[str, Any]],
    jsonl_dir: Path,
) -> list[dict[str, Any]]:
    present = {str(r.get("source_file_id")) for r in rows}
    missing = [f"{i:04d}" for i in range(1, 89) if f"{i:04d}" not in present]
    next_id = len(rows) + 1
    for fid in missing:
        for rec in find_records_for_file(jsonl_dir, fid, limit=5):
            rows.append(
                {
                    "review_id": f"HR-{next_id:05d}",
                    "source_file_id": fid,
                    "record_id": rec.get("record_id"),
                    "domain": rec.get("domain"),
                    "language_form": rec.get("language_form"),
                    "raw_input": rec.get("raw_input"),
                    "normalized_input": rec.get("normalized_input"),
                    "intent": rec.get("intent"),
                    "operation_class": rec.get("operation_class"),
                    "expected_behavior": str(rec.get("expected_behavior") or "")[:500],
                    "execution_allowed": rec.get("execution_allowed"),
                    "quality_score": rec.get("quality_score"),
                    "duplicate_group": "",
                    "contradiction_group": "",
                    "language_naturalness": "",
                    "intent_correct": "",
                    "entities_correct": "",
                    "accounting_correct": "",
                    "safety_correct": "",
                    "reviewer_correction": "",
                    "reviewer_notes": "",
                    "reviewer_name": "",
                    "reviewed_at": "",
                    "review_status": "pending",
                    "review_decision": "",
                    "machine_precheck": "",
                    "machine_precheck_notes": "",
                }
            )
            next_id += 1
            present.add(fid)
            break
        else:
            logger.warning("Could not find records for missing file %s", fid)
    return rows


def run(*, repo_root: Path, apply: bool) -> int:
    cfg = load_config(repo_root)
    out_dir = repo_root / cfg["paths"]["review_ready_dir"]
    jsonl_dir = repo_root / cfg["paths"]["processed_jsonl_dir"]
    sample_jsonl = out_dir / "human_review_sample.jsonl"
    sample_csv = out_dir / "human_review_sample.csv"

    rows = list(iter_jsonl(sample_jsonl))
    before_files = len({str(r.get("source_file_id")) for r in rows})
    rows = top_up_missing_files(rows, jsonl_dir)
    after_files = len({str(r.get("source_file_id")) for r in rows})

    counts: Counter[str] = Counter()
    for row in rows:
        status, notes, updates = structural_precheck(row)
        counts[status] += 1
        if apply:
            row.update(updates)
            row["machine_precheck"] = status
            row["machine_precheck_notes"] = notes
            row.setdefault("review_decision", "")
            # Keep pending for humans
            if row.get("review_status") in (None, "", "pending"):
                row["review_status"] = "pending_human_after_machine_precheck"
            row["reviewer_notes"] = (
                (row.get("reviewer_notes") or "")
                + (" | " if row.get("reviewer_notes") else "")
                + f"[machine {utc_now_iso()}] {notes}"
            ).strip(" |")

    # Write outputs
    with sample_jsonl.open("w", encoding="utf-8", newline="\n") as fh:
        for row in rows:
            # Ensure new columns present
            row.setdefault("review_decision", "")
            row.setdefault("machine_precheck", "")
            row.setdefault("machine_precheck_notes", "")
            fh.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")

    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=COLUMNS, extrasaction="ignore")
    w.writeheader()
    for row in rows:
        w.writerow(row)
    atomic_write_text(sample_csv, buf.getvalue())

    summary = {
        "generated_at": utc_now_iso(),
        "apply": apply,
        "sample_size": len(rows),
        "files_covered_before": before_files,
        "files_covered_after": after_files,
        "machine_precheck_counts": dict(counts),
        "disclaimer": (
            "Machine structural precheck only. Not human language approval, "
            "not accounting/legal approval, not production approval."
        ),
        "outputs": [
            rel_to_repo(repo_root, sample_jsonl),
            rel_to_repo(repo_root, sample_csv),
        ],
    }
    atomic_write_text(
        out_dir / "human_review_precheck_summary.json",
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n",
    )
    logger.info(
        "Precheck sample=%s files=%s->%s counts=%s",
        len(rows),
        before_files,
        after_files,
        dict(counts),
    )
    print(json.dumps(summary, indent=2))
    return 0 if after_files == 88 else 1


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Structural pre-review assist")
    p.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    p.add_argument(
        "--apply",
        action="store_true",
        help="Write machine_precheck fields into the sample (still pending human)",
    )
    args = p.parse_args(argv)
    return run(repo_root=args.repo_root.resolve(), apply=args.apply)


if __name__ == "__main__":
    sys.exit(main())
