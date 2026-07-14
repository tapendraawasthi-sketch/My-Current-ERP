#!/usr/bin/env python3
"""Build specialist clarification dossier + import priority-queue deferrals."""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import REPO_ROOT, atomic_write_text, load_config, utc_now_iso  # noqa: E402

DEFER_NOTE = (
    "Operator deferred per priority-queue machine suggestion. "
    "Not rejected; not production-certified. Revisit in specialist pass if needed."
)


def build_specialist_packet(repo: Path, cfg: dict) -> dict:
    out_dir = repo / cfg["paths"]["review_ready_dir"]
    must = list(
        csv.DictReader((out_dir / "MUST_REVIEW_TOP25.csv").open(encoding="utf-8", newline=""))
    )
    sample_by_id: dict[str, dict] = {}
    sample_path = out_dir / "human_review_sample.csv"
    if sample_path.exists():
        with sample_path.open(encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh):
                sample_by_id[row["record_id"]] = row
    pri_by_id: dict[str, dict] = {}
    pri_path = out_dir / "priority_review_queue.jsonl"
    if pri_path.exists():
        for line in pri_path.open(encoding="utf-8"):
            if line.strip():
                r = json.loads(line)
                pri_by_id[r["record_id"]] = r

    meta_by_id: dict[str, dict] = {}
    meta_path = repo / cfg["paths"]["indexes_metadata_dir"] / "kb_metadata.sqlite"
    if meta_path.exists():
        con = sqlite3.connect(str(meta_path))
        con.row_factory = sqlite3.Row
        cols = [c[1] for c in con.execute("PRAGMA table_info(kb_records)")]
        for row in must:
            rid = row["record_id"]
            rec = con.execute(
                "SELECT * FROM kb_records WHERE record_id = ? LIMIT 1", (rid,)
            ).fetchone()
            if rec:
                meta_by_id[rid] = {k: rec[k] for k in cols}
        con.close()

    lines = [
        "# Specialist Clarification Packet (Top 25)",
        "",
        f"Generated: {utc_now_iso()}",
        "",
        "Status: **awaiting domain specialist** (tax/VAT/statutory/accounting).",
        "These rows remain `needs_clarification` — automation will not approve them.",
        "",
    ]
    for i, row in enumerate(must, 1):
        rid = row["record_id"]
        s = sample_by_id.get(rid, {})
        p = pri_by_id.get(rid, {})
        m = meta_by_id.get(rid, {})
        raw = (
            row.get("raw_input")
            or s.get("raw_input")
            or p.get("raw_input")
            or m.get("raw_input")
            or ""
        )
        intent = row.get("intent") or s.get("intent") or p.get("intent") or m.get("intent")
        hits = (row.get("priority_hits") or p.get("priority_hits") or "").casefold()
        expert = "Tax/VAT & ERP posting semantics"
        if "payroll" in hits:
            expert = "Payroll / HR statutory"
        if "privacy" in hits or "tenant" in hits:
            expert = "Security / tenancy"
        if "period" in hits:
            expert = "Tax period / fiscal calendar"

        lines.extend(
            [
                f"## {i}. `{rid}`",
                "",
                f"- **Expert needed:** {expert}",
                f"- **source_file_id:** {row.get('source_file_id') or s.get('source_file_id')}",
                f"- **priority_hits:** `{row.get('priority_hits') or p.get('priority_hits')}`",
                f"- **machine_suggestion:** {row.get('machine_suggested_decision') or p.get('machine_suggested_decision')}",
                "- **current_decision:** needs_clarification",
                f"- **execution_allowed:** {row.get('execution_allowed') or s.get('execution_allowed') or False}",
                f"- **raw_input:** {raw or '_(empty)_'}",
                f"- **intent:** {intent}",
                f"- **domain:** {s.get('domain') or m.get('domain')}",
                f"- **normalized_input:** {s.get('normalized_input') or m.get('normalized_input') or ''}",
                f"- **expected_behavior:** {s.get('expected_behavior') or m.get('expected_behavior') or ''}",
                "",
                "### Specialist checklist",
                "- [ ] Language naturalness OK for Nepali/romanized forms",
                "- [ ] Intent / entities correct for ERP use",
                "- [ ] Accounting / tax semantics verified",
                "- [ ] Safety: no false execution path",
                "",
                "**Decision:** [ ] approve  [ ] approve_with_edit  [ ] reject  [ ] defer  [ ] promote_to_gold",
                "",
                "Notes:",
                "",
                "---",
                "",
            ]
        )

    atomic_write_text(out_dir / "SPECIALIST_CLARIFY_PACKET.md", "\n".join(lines))
    dec_lines = []
    for row in must:
        dec_lines.append(
            json.dumps(
                {
                    "record_id": row["record_id"],
                    "source_file_id": row.get("source_file_id"),
                    "review_decision": "",
                    "reviewer_notes": "",
                    "reviewer_name": "",
                    "expert_lane": "tax_statutory",
                },
                ensure_ascii=False,
            )
        )
    atomic_write_text(
        out_dir / "SPECIALIST_CLARIFY_DECISIONS.jsonl",
        "\n".join(dec_lines) + ("\n" if dec_lines else ""),
    )
    return {"must_rows": len(must), "meta_hits": len(meta_by_id)}


def build_priority_defer_batch(repo: Path, cfg: dict, reviewer: str) -> Path:
    out_dir = repo / cfg["paths"]["review_ready_dir"]
    existing: set[str] = set()
    overlays = repo / cfg["paths"]["processed_records_dir"] / "review_overlays.jsonl"
    if overlays.exists():
        for line in overlays.open(encoding="utf-8"):
            if line.strip():
                existing.add(json.loads(line).get("record_id") or "")

    decisions: list[dict] = []
    pri_path = out_dir / "priority_review_queue.jsonl"
    for line in pri_path.open(encoding="utf-8"):
        if not line.strip():
            continue
        r = json.loads(line)
        rid = r.get("record_id")
        if not rid or rid in existing:
            continue
        suggestion = (r.get("machine_suggested_decision") or "").strip().lower()
        if suggestion != "defer":
            continue
        decisions.append(
            {
                "record_id": rid,
                "source_file_id": r.get("source_file_id"),
                "review_decision": "defer",
                "reviewer_notes": DEFER_NOTE,
                "reviewer_name": reviewer,
                "reviewed_at": utc_now_iso(),
                "batch": "priority_queue_defer",
            }
        )

    out = out_dir / "OPERATOR_PRIORITY_DEFER_DECISIONS.jsonl"
    atomic_write_text(
        out,
        "\n".join(json.dumps(d, ensure_ascii=False) for d in decisions)
        + ("\n" if decisions else ""),
    )
    atomic_write_text(
        out_dir / "OPERATOR_PRIORITY_DEFER_SUMMARY.json",
        json.dumps(
            {
                "generated_at": utc_now_iso(),
                "reviewer": reviewer,
                "deferred": len(decisions),
                "output": str(out.relative_to(repo)).replace("\\", "/"),
            },
            indent=2,
        )
        + "\n",
    )
    return out


def write_production_blockers(repo: Path) -> None:
    path = repo / "knowledgebase" / "docs" / "PRODUCTION_BLOCKERS.md"
    atomic_write_text(
        path,
        "\n".join(
            [
                "# Production blockers — Nepali Language KB",
                "",
                f"Updated: {utc_now_iso()}",
                "",
                "Current release status: **staging_candidate** (`production_approved: false`).",
                "",
                "## Must complete before production",
                "",
                "1. [ ] Specialist decisions for `SPECIALIST_CLARIFY_PACKET.md` (25 tax/statutory rows)",
                "2. [ ] Language naturalness sign-off (Nepali + romanized)",
                "3. [ ] Accounting / tax semantics sign-off",
                "4. [ ] Security / tenancy review of authorization-related records",
                "5. [ ] Ops: enable `ORBIX_NP_KB_ENABLED` only in staging first; smoke + rollback drill",
                "6. [ ] Explicit written decision to set `production_approved: true` (manual gate edit — never automated)",
                "",
                "## Explicitly out of scope for automation",
                "",
                "- Flipping `production_approved` to true",
                "- Approving VAT/TDS/payroll clarification rows without a specialist",
                "- Giving the KB any posting / execution authority",
                "",
            ]
        ),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--reviewer", default="Acer")
    parser.add_argument("--skip-defer", action="store_true")
    args = parser.parse_args(argv)
    repo = args.repo_root.resolve()
    cfg = load_config(repo)

    specialist = build_specialist_packet(repo, cfg)
    write_production_blockers(repo)
    defer_path = None
    if not args.skip_defer:
        defer_path = build_priority_defer_batch(repo, cfg, args.reviewer)

    print(
        json.dumps(
            {
                "specialist_packet": specialist,
                "defer_file": (
                    str(defer_path.relative_to(repo)).replace("\\", "/") if defer_path else None
                ),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
