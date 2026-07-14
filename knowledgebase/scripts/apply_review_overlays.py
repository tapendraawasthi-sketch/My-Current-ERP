#!/usr/bin/env python3
"""Apply human review overlays into metadata DB (never rewrites raw KB files)."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any, Iterator

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import (  # noqa: E402
    REPO_ROOT,
    atomic_write_json,
    load_config,
    rel_to_repo,
    setup_logging,
    utc_now_iso,
)

logger = setup_logging("apply_review_overlays")

DECISION_TO_STATUS = {
    "approve": "approved",
    "approve_with_edit": "approved",
    "promote_to_gold": "gold",
    "reject": "rejected",
    "needs_clarification": "needs_clarification",
    "defer": "deferred",
}


def iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    if not path.exists():
        return
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                yield json.loads(line)


def run(*, repo_root: Path, overlays_path: Path | None = None) -> int:
    cfg = load_config(repo_root)
    records_dir = repo_root / cfg["paths"]["processed_records_dir"]
    overlays = overlays_path or (records_dir / "review_overlays.jsonl")
    meta_path = repo_root / cfg["paths"]["indexes_metadata_dir"] / "kb_metadata.sqlite"
    lex_path = repo_root / cfg["paths"]["indexes_lexical_dir"] / "kb_lexical.sqlite"

    if not overlays.exists():
        logger.error("No overlays file at %s — import reviews first", overlays)
        return 1
    if not meta_path.exists():
        logger.error("Metadata DB missing: %s", meta_path)
        return 1

    rows = list(iter_jsonl(overlays))
    if not rows:
        logger.warning("Overlays file is empty (all pending?). Nothing to apply.")
        atomic_write_json(
            records_dir / "review_overlays_apply_summary.json",
            {
                "generated_at": utc_now_iso(),
                "applied": 0,
                "note": "No completed review decisions to apply",
            },
        )
        return 0

    meta = sqlite3.connect(str(meta_path))
    meta.execute(
        """
        CREATE TABLE IF NOT EXISTS kb_review_overlays (
            record_id TEXT PRIMARY KEY,
            review_decision TEXT,
            review_status TEXT,
            reviewer TEXT,
            reviewed_at TEXT,
            imported_at TEXT,
            notes TEXT
        )
        """
    )
    applied = 0
    for row in rows:
        rid = row.get("record_id")
        if not rid:
            continue
        decision = (row.get("review_decision") or "").strip().lower()
        status = DECISION_TO_STATUS.get(decision, decision or "pending")
        meta.execute(
            """
            INSERT OR REPLACE INTO kb_review_overlays(
                record_id, review_decision, review_status, reviewer, reviewed_at, imported_at, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rid,
                decision,
                status,
                row.get("reviewer"),
                row.get("reviewed_at"),
                row.get("imported_at") or utc_now_iso(),
                row.get("reviewer_notes") or "",
            ),
        )
        meta.execute(
            "UPDATE kb_records SET review_status = ? WHERE record_id = ?",
            (status, rid),
        )
        if decision == "reject":
            meta.execute(
                "UPDATE kb_records SET eligibility = 'human_review_required' WHERE record_id = ?",
                (rid,),
            )
        elif decision in {"approve", "approve_with_edit", "promote_to_gold"}:
            meta.execute(
                "UPDATE kb_records SET eligibility = 'eligible' WHERE record_id = ?",
                (rid,),
            )
        applied += 1
    meta.commit()

    # Optional FTS mirror — skip by default: UPDATEs on multi-million-row FTS
    # without a supporting index are extremely slow. Metadata overlays are authoritative.
    updated_fts = 0
    skip_fts = os.environ.get("ORBIX_NP_KB_SKIP_FTS_OVERLAY", "1").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if lex_path.exists() and not skip_fts:
        lex = sqlite3.connect(str(lex_path))
        lex.execute("PRAGMA busy_timeout = 5000")
        for row in rows:
            rid = row.get("record_id")
            decision = (row.get("review_decision") or "").strip().lower()
            status = DECISION_TO_STATUS.get(decision, "")
            if not rid or not status:
                continue
            for table in ("prod_fts", "eval_fts"):
                try:
                    cur = lex.execute(
                        f"UPDATE {table} SET review_status = ? WHERE record_id = ?",
                        (status, rid),
                    )
                    updated_fts += cur.rowcount or 0
                except sqlite3.DatabaseError:
                    pass
        lex.commit()
        lex.close()
    elif skip_fts:
        logger.info("Skipping FTS overlay mirror (ORBIX_NP_KB_SKIP_FTS_OVERLAY=1); metadata overlays applied.")

    meta.close()
    summary = {
        "generated_at": utc_now_iso(),
        "overlays_path": rel_to_repo(repo_root, overlays),
        "applied": applied,
        "fts_rows_touched": updated_fts,
        "fts_skipped": skip_fts,
        "raw_unchanged": True,
        "note": "Overlays applied to metadata/FTS review_status only; raw source files untouched.",
    }
    atomic_write_json(records_dir / "review_overlays_apply_summary.json", summary)
    logger.info("Applied %s overlays (fts_touched=%s)", applied, updated_fts)
    print(json.dumps(summary, indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    cfg = load_config()
    p = argparse.ArgumentParser(description="Apply review overlays to metadata index")
    p.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    p.add_argument("--overlays", type=Path, default=None)
    args = p.parse_args(argv)
    repo = args.repo_root.resolve()
    return run(
        repo_root=repo,
        overlays_path=args.overlays.resolve() if args.overlays else None,
    )


if __name__ == "__main__":
    sys.exit(main())
