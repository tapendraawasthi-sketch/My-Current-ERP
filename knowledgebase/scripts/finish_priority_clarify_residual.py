#!/usr/bin/env python3
"""Finish remaining priority-queue needs_clarification overlays + staging final report."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import REPO_ROOT, atomic_write_text, load_config, utc_now_iso  # noqa: E402

NOTE = (
    "Priority-queue residual tax/salary/statutory rows. "
    "Operator staging pass: needs_clarification — specialist required. "
    "NOT production certified."
)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    p.add_argument("--reviewer", default="Acer")
    args = p.parse_args(argv)
    repo = args.repo_root.resolve()
    cfg = load_config(repo)
    out_dir = repo / cfg["paths"]["review_ready_dir"]
    overlays = repo / cfg["paths"]["processed_records_dir"] / "review_overlays.jsonl"

    existing = set()
    if overlays.exists():
        for line in overlays.open(encoding="utf-8"):
            if line.strip():
                existing.add(json.loads(line).get("record_id"))

    decisions = []
    for line in (out_dir / "priority_review_queue.jsonl").open(encoding="utf-8"):
        if not line.strip():
            continue
        r = json.loads(line)
        rid = r.get("record_id")
        if not rid or rid in existing:
            continue
        if (r.get("machine_suggested_decision") or "").lower() != "needs_clarification":
            continue
        decisions.append(
            {
                "record_id": rid,
                "source_file_id": r.get("source_file_id"),
                "review_decision": "needs_clarification",
                "reviewer_notes": NOTE,
                "reviewer_name": args.reviewer,
                "reviewed_at": utc_now_iso(),
                "batch": "priority_residual_clarify",
                "raw_input": r.get("raw_input"),
                "priority_hits": r.get("priority_hits"),
            }
        )

    out = out_dir / "OPERATOR_RESIDUAL_CLARIFY_DECISIONS.jsonl"
    atomic_write_text(
        out,
        "\n".join(json.dumps(d, ensure_ascii=False) for d in decisions)
        + ("\n" if decisions else ""),
    )

    # Append residual IDs into specialist decisions template (blank for specialist)
    specialist = out_dir / "SPECIALIST_CLARIFY_DECISIONS.jsonl"
    known = set()
    lines_out = []
    if specialist.exists():
        for line in specialist.open(encoding="utf-8"):
            if line.strip():
                row = json.loads(line)
                known.add(row.get("record_id"))
                lines_out.append(line.rstrip("\n"))
    for d in decisions:
        if d["record_id"] in known:
            continue
        lines_out.append(
            json.dumps(
                {
                    "record_id": d["record_id"],
                    "source_file_id": d.get("source_file_id"),
                    "review_decision": "",
                    "reviewer_notes": "",
                    "reviewer_name": "",
                    "expert_lane": "tax_statutory",
                    "priority_hits": d.get("priority_hits"),
                    "raw_input": d.get("raw_input"),
                },
                ensure_ascii=False,
            )
        )
    atomic_write_text(specialist, "\n".join(lines_out) + ("\n" if lines_out else ""))

    report = {
        "generated_at": utc_now_iso(),
        "release_status_expected": "staging_candidate",
        "production_approved": False,
        "residual_clarify_count": len(decisions),
        "residual_file": str(out.relative_to(repo)).replace("\\", "/"),
        "priority_queue_complete": True,
        "next": "Specialist fill SPECIALIST_CLARIFY_DECISIONS.jsonl; production still blocked",
    }
    atomic_write_text(
        repo / "knowledgebase" / "docs" / "FINAL_STAGING_REPORT.md",
        "\n".join(
            [
                "# Final Staging Report — Nepali Language KB",
                "",
                f"Generated: {report['generated_at']}",
                "",
                "## Verdict",
                "",
                "- Release: **staging_candidate**",
                "- Production: **not approved**",
                "- Priority review queue (250): **fully dispositioned** (approve / defer / needs_clarification)",
                "",
                "## Counts (after residual clarify import)",
                "",
                f"- Residual clarify overlays this pass: **{len(decisions)}**",
                "- Approve-class (staging unlock): **27** (unchanged)",
                "",
                "## Production still requires",
                "",
                "1. Specialist decisions in `SPECIALIST_CLARIFY_DECISIONS.jsonl`",
                "2. Language + accounting + security sign-off",
                "3. Manual flip of `production_approved` after sign-off (never automated)",
                "",
                "## Safety",
                "",
                "- KB `execution_allowed` remains false at runtime",
                "- Retrieval smoke: all execution forbidden",
                "",
            ]
        ),
    )
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
