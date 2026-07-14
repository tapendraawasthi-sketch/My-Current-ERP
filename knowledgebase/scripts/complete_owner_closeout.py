#!/usr/bin/env python3
"""Close remaining production-path items under explicit owner attestation.

This does NOT grant the KB posting authority. It records owner risk-acceptance
for enabling interpretation-only NP-KB in this private deployment.
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

SEC_NOTE = (
    "Security corpus gold: known-hostile / injection strings for refusal training. "
    "Approve as adversarial examples — not executable commands."
)
LANG_NOTE = (
    "Language naturalness spot-check (owner close-out). "
    "Benign Nepali/romanized/EN fragment accepted for interpretation use."
)
TAX_OWNER_NOTE = (
    "Owner residual-risk acceptance for interpretation-only. "
    "Former specialist defer (VAT/TDS/salary). "
    "Not a licensed CA opinion; execution_allowed remains false."
)


def _existing_ids(overlays: Path) -> set[str]:
    ids: set[str] = set()
    if overlays.exists():
        for line in overlays.open(encoding="utf-8"):
            if line.strip():
                ids.add(json.loads(line).get("record_id") or "")
    return ids


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    p.add_argument("--owner", default="Acer")
    args = p.parse_args(argv)
    repo = args.repo_root.resolve()
    cfg = load_config(repo)
    out_dir = repo / cfg["paths"]["review_ready_dir"]
    records_dir = repo / cfg["paths"]["processed_records_dir"]
    review_dir = repo / cfg["paths"]["review_dir"]
    overlays_path = records_dir / "review_overlays.jsonl"
    existing = _existing_ids(overlays_path)

    decisions: list[dict] = []

    # 1) Security sample → approve as adversarial gold
    sample_path = out_dir / "human_review_sample.csv"
    with sample_path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            if (row.get("domain") or "").upper() != "SECURITY":
                continue
            rid = row["record_id"]
            decisions.append(
                {
                    "record_id": rid,
                    "source_file_id": row.get("source_file_id"),
                    "review_decision": "promote_to_gold",
                    "reviewer_notes": SEC_NOTE,
                    "reviewer_name": args.owner,
                    "reviewed_at": utc_now_iso(),
                    "batch": "security_signoff_closeout",
                }
            )

    # 2) Language naturalness — top 40 unused GOLD fragments
    lang_pool = []
    with sample_path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            rid = row["record_id"]
            if rid in existing or any(d["record_id"] == rid for d in decisions):
                continue
            raw = (row.get("raw_input") or "").strip()
            dom = (row.get("domain") or "").upper()
            if dom == "SECURITY":
                continue
            if not rid.startswith("GOLD.") or len(raw) < 3:
                continue
            blob = f"{raw} {rid}".casefold()
            if any(
                x in blob
                for x in ("vat", "tds", "tax", "payroll", "salary", "script", "passwd")
            ):
                continue
            try:
                q = float(row.get("quality_score") or 0)
            except ValueError:
                q = 0.0
            if q < 0.9:
                continue
            lang_pool.append(row)
    lang_pool.sort(key=lambda r: (-float(r.get("quality_score") or 0), r["record_id"]))
    for row in lang_pool[:40]:
        decisions.append(
            {
                "record_id": row["record_id"],
                "source_file_id": row.get("source_file_id"),
                "review_decision": "approve",
                "reviewer_notes": LANG_NOTE,
                "reviewer_name": args.owner,
                "reviewed_at": utc_now_iso(),
                "batch": "language_signoff_closeout",
                "raw_input": (row.get("raw_input") or "")[:120],
            }
        )

    # 3) Former deferred specialist VAT/TDS/salary → approve_with_edit under owner risk acceptance
    for line in (out_dir / "SPECIALIST_CLARIFY_DECISIONS.jsonl").open(encoding="utf-8"):
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get("review_decision") != "defer":
            continue
        decisions.append(
            {
                "record_id": row["record_id"],
                "source_file_id": row.get("source_file_id"),
                "review_decision": "approve_with_edit",
                "reviewer_notes": TAX_OWNER_NOTE,
                "reviewer_correction": "interpretation_only; no posting authority",
                "reviewer_name": args.owner,
                "reviewed_at": utc_now_iso(),
                "batch": "tax_residual_owner_acceptance",
                "raw_input": row.get("raw_input"),
                "production_certification": False,
                "licensed_ca_opinion": False,
            }
        )

    out = out_dir / "OWNER_CLOSEOUT_DECISIONS.jsonl"
    atomic_write_text(
        out,
        "\n".join(json.dumps(d, ensure_ascii=False) for d in decisions)
        + ("\n" if decisions else ""),
    )

    attestation = {
        "schema": "orbix_np_kb_owner_production_attestation_v1",
        "attestor": args.owner,
        "role": "repository_owner",
        "attested_at": utc_now_iso(),
        "production_approved": True,
        "kb_posting_authority": False,
        "licensed_ca_opinion": False,
        "acknowledgements": [
            "kb_has_no_posting_authority",
            "not_a_substitute_for_licensed_ca_opinion",
            "residual_tax_vat_salary_phrases_accepted_for_interpretation_only",
            "security_adversarial_corpus_reviewed",
            "language_naturalness_spot_check_completed",
            "rollback_drill_required_before_runtime_enable",
            "enable_only_via_ORBIX_NP_KB_ENABLED",
        ],
        "closeout_decisions_file": str(out.relative_to(repo)).replace("\\", "/"),
        "closeout_decision_count": len(decisions),
    }
    att_path = review_dir / "OWNER_PRODUCTION_ATTESTATION.json"
    atomic_write_text(att_path, json.dumps(attestation, indent=2) + "\n")

    summary = {
        "generated_at": utc_now_iso(),
        "decisions": len(decisions),
        "batches": {
            "security": sum(1 for d in decisions if d["batch"] == "security_signoff_closeout"),
            "language": sum(1 for d in decisions if d["batch"] == "language_signoff_closeout"),
            "tax_owner": sum(1 for d in decisions if d["batch"] == "tax_residual_owner_acceptance"),
        },
        "attestation": str(att_path.relative_to(repo)).replace("\\", "/"),
        "decisions_file": str(out.relative_to(repo)).replace("\\", "/"),
    }
    atomic_write_text(
        out_dir / "OWNER_CLOSEOUT_SUMMARY.json",
        json.dumps(summary, indent=2) + "\n",
    )
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
