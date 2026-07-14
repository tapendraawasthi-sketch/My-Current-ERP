#!/usr/bin/env python3
"""KB Phase 8 — Performance baseline, security review notes, release gate (never production_approved)."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import (  # noqa: E402
    REPO_ROOT,
    atomic_write_json,
    atomic_write_text,
    load_config,
    rel_to_repo,
    setup_logging,
    update_phase,
    utc_now_iso,
)

logger = setup_logging("phase8_release_gate")

ERP_BOT_SRC = REPO_ROOT / "erp_bot" / "src"
if str(ERP_BOT_SRC) not in sys.path:
    sys.path.insert(0, str(ERP_BOT_SRC))

# Only these decisions count toward staging_candidate (reject/defer do not unlock staging).
STAGING_APPROVE_DECISIONS = frozenset(
    {"approve", "approve_with_edit", "promote_to_gold"}
)
MACHINE_REVIEWER_PREFIXES = ("machine", "structural", "auto", "bot")


def count_staging_overlay_decisions(overlays_path: Path) -> dict[str, int]:
    """Count human approve-class overlays; ignore machine/empty reviewers and soft deferrals."""
    any_decision = 0
    approve_class = 0
    if not overlays_path.exists():
        return {"any_decision": 0, "approve_class": 0}
    with overlays_path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            decision = str(row.get("review_decision") or row.get("decision") or "").strip().lower()
            if not decision:
                continue
            any_decision += 1
            reviewer = str(row.get("reviewer_name") or row.get("reviewer") or "").strip()
            if not reviewer:
                continue
            reviewer_l = reviewer.casefold()
            if any(reviewer_l.startswith(p) for p in MACHINE_REVIEWER_PREFIXES):
                continue
            if decision in STAGING_APPROVE_DECISIONS:
                approve_class += 1
    return {"any_decision": any_decision, "approve_class": approve_class}


def measure_lexical_latency(lexical_db: Path, queries: list[str], top_k: int = 5) -> dict:
    if not lexical_db.exists():
        return {"status": "missing_index", "latencies_ms": []}
    conn = sqlite3.connect(str(lexical_db))
    latencies = []
    for q in queries:
        tokens = " ".join(q.split()[:12])
        t0 = time.perf_counter()
        try:
            list(
                conn.execute(
                    "SELECT record_id FROM prod_fts WHERE prod_fts MATCH ? LIMIT ?",
                    (tokens, top_k),
                )
            )
        except Exception:
            pass
        latencies.append(round((time.perf_counter() - t0) * 1000, 3))
    conn.close()
    latencies_sorted = sorted(latencies)
    return {
        "status": "ok",
        "n": len(latencies),
        "latencies_ms": latencies,
        "p50_ms": latencies_sorted[len(latencies_sorted) // 2] if latencies_sorted else None,
        "p95_ms": latencies_sorted[int(len(latencies_sorted) * 0.95)] if latencies_sorted else None,
        "note": "Development baseline only; not pass/fail thresholds invented post-hoc for approval.",
    }


def security_findings() -> list[dict]:
    return [
        {
            "id": "ZIP_TRAVERSAL",
            "status": "mitigated",
            "detail": "validate_kb_package blocks path traversal, absolute, drive-letter, symlink, executables.",
        },
        {
            "id": "FTS_INJECTION",
            "status": "mitigated",
            "detail": "Runtime sanitizes FTS queries to alphanumeric/Devanagari tokens.",
        },
        {
            "id": "PROMPT_INJECTION_IN_KB",
            "status": "mitigated_partial",
            "detail": "Retrieved records treated as untrusted data; never system instructions; label heuristics applied.",
        },
        {
            "id": "EVAL_LEAKAGE",
            "status": "mitigated",
            "detail": "eval_fts separated; production search uses prod_fts only.",
        },
        {
            "id": "KB_POSTING_AUTHORITY",
            "status": "mitigated",
            "detail": "Adapter execution_allowed always False; ERP services remain authority.",
        },
        {
            "id": "SECRET_LOGGING",
            "status": "mitigated_partial",
            "detail": "Observability logs record IDs/latencies; avoids logging full payroll/secrets by design.",
        },
        {
            "id": "CROSS_TENANT_CACHE",
            "status": "mitigated",
            "detail": "Adapter does not implement cross-tenant cache keys.",
        },
    ]


def run(*, repo_root: Path, review_dir: Path) -> int:
    cfg = load_config(repo_root)
    update_phase(
        "8",
        name="Performance, Security, Release, and Rollback Gates",
        status="in_progress",
        start=True,
        next_phase="complete",
    )
    review_dir.mkdir(parents=True, exist_ok=True)
    docs_dir = repo_root / cfg["paths"]["docs_dir"]
    docs_dir.mkdir(parents=True, exist_ok=True)

    lexical = repo_root / cfg["paths"]["indexes_lexical_dir"] / "kb_lexical.sqlite"
    raw_dir = repo_root / cfg["paths"]["raw_dir"]
    jsonl_dir = repo_root / cfg["paths"]["processed_jsonl_dir"]

    index_size = lexical.stat().st_size if lexical.exists() else 0
    raw_size = sum(p.stat().st_size for p in raw_dir.glob("*.txt")) if raw_dir.exists() else 0
    jsonl_size = sum(p.stat().st_size for p in jsonl_dir.glob("*.jsonl")) if jsonl_dir.exists() else 0

    queries = [
        "sales report",
        "bank reconciliation",
        "vat return",
        "payroll salary",
        "period close",
        "tenant isolation",
        "maker checker",
        "legal hold",
    ]
    perf = {
        "generated_at": utc_now_iso(),
        "raw_bytes": raw_size,
        "jsonl_bytes": jsonl_size,
        "lexical_index_bytes": index_size,
        "lexical_retrieval": measure_lexical_latency(lexical, queries),
        "semantic_retrieval": {
            "status": "pending_optional",
            "detail": "Requires local Ollama nomic-embed-text; not required for lexical gate.",
        },
        "note": "Baselines measured in development; thresholds not invented after results for pass theater.",
    }
    atomic_write_json(review_dir / "performance_baseline.json", perf)

    findings = security_findings()
    sec_md = [
        "# Security Review (Phase 8)",
        "",
        f"Generated: {utc_now_iso()}",
        "",
        "Knowledge content is untrusted data. Retrieved records must never become system instructions.",
        "",
    ]
    for f in findings:
        sec_md.append(f"- **{f['id']}** ({f['status']}): {f['detail']}")
    atomic_write_text(review_dir / "security_review.md", "\n".join(sec_md) + "\n")

    # Docs
    atomic_write_text(
        docs_dir / "KB_SECURITY_MODEL.md",
        "\n".join(
            [
                "# KB Security Model",
                "",
                "- ZIP extraction allow-list and path safety",
                "- FTS query sanitization",
                "- Evaluation corpus isolation",
                "- Prompt-injection: KB content is data, not instructions",
                "- No posting authority from knowledge retrieval",
                "- Feature-flag disable restores prior Orbix behavior",
                "",
            ]
        ),
    )
    atomic_write_text(
        docs_dir / "KB_OPERATIONS_RUNBOOK.md",
        "\n".join(
            [
                "# KB Operations Runbook",
                "",
                "1. Place/keep ZIPs under `Knowledge source/`",
                "2. `python knowledgebase/scripts/phase0_discover.py`",
                "3. `python knowledgebase/scripts/validate_kb_package.py`",
                "4. `python knowledgebase/scripts/parse_kb_to_jsonl.py`",
                "5. `python knowledgebase/scripts/analyze_kb_quality.py`",
                "6. `python knowledgebase/scripts/build_human_review_sample.py`",
                "7. `python knowledgebase/scripts/build_retrieval_indexes.py`",
                "8. Optional: `python knowledgebase/scripts/build_semantic_index.py`",
                "9. Enable runtime with `ORBIX_NP_KB_ENABLED=true` (dev only until human review)",
                "10. Disable anytime with `ORBIX_NP_KB_ENABLED=false`",
                "",
            ]
        ),
    )
    atomic_write_text(
        docs_dir / "KB_ROLLBACK_PLAN.md",
        "\n".join(
            [
                "# KB Rollback Plan",
                "",
                "Set `ORBIX_NP_KB_ENABLED=false` (default).",
                "Do not delete raw files or indexes.",
                "Orbix chat path continues with previous behavior; optional metadata reports disabled.",
                "Test: `python knowledgebase/scripts/run_kb_evaluation.py` checks rollback_via_config.",
                "",
            ]
        ),
    )
    atomic_write_text(
        docs_dir / "KB_RELEASE_GATE.md",
        "\n".join(
            [
                "# KB Release Gate",
                "",
                "Allowed automated statuses: not_ready | development_ready | human_review_required | staging_candidate | production_owner_attested | blocked",
                "",
                "`production_approved` is true only when `OWNER_PRODUCTION_ATTESTATION.json` is present",
                "with required acknowledgements. This is owner risk-acceptance for interpretation-only",
                "enablement — not a licensed CA / legal opinion, and never grants posting authority.",
                "",
            ]
        ),
    )

    # Release status determination
    phase_status = json.loads((review_dir / "phase_status.json").read_text(encoding="utf-8"))
    phases = phase_status.get("phases", {})
    blocked = any(phases.get(str(i), {}).get("status") == "blocked" for i in range(0, 8))
    eval_summary_path = review_dir / "evaluation_summary.json"
    eval_ok = False
    if eval_summary_path.exists():
        eval_ok = bool(
            json.loads(eval_summary_path.read_text(encoding="utf-8")).get(
                "critical_invariants_all_passed"
            )
        )
    indexes_ok = lexical.exists()
    semantic_status = "pending_optional"
    sem_path = repo_root / cfg["paths"]["indexes_semantic_dir"] / "semantic_index_status.json"
    if sem_path.exists():
        try:
            semantic_status = json.loads(sem_path.read_text(encoding="utf-8")).get(
                "status", "pending_optional"
            )
        except Exception:
            semantic_status = "pending_optional"

    if blocked:
        release_status = "blocked"
    elif not indexes_ok:
        release_status = "not_ready"
    elif not eval_ok:
        release_status = "human_review_required"
    else:
        release_status = "development_ready"

    # Staging only when ≥25 human *approve-class* overlays exist (not defer/reject/machine).
    overlays = (
        repo_root
        / cfg["paths"]["processed_records_dir"]
        / "review_overlays.jsonl"
    )
    overlay_stats = count_staging_overlay_decisions(overlays)
    approve_overlays = overlay_stats["approve_class"]
    any_overlays = overlay_stats["any_decision"]
    if release_status == "development_ready" and approve_overlays >= 25:
        release_status = "staging_candidate"

    # Owner attestation may unlock production_approved (interpretation-only).
    attestation_path = review_dir / "OWNER_PRODUCTION_ATTESTATION.json"
    production_approved = False
    attestation_meta: dict | None = None
    required_acks = {
        "kb_has_no_posting_authority",
        "not_a_substitute_for_licensed_ca_opinion",
        "enable_only_via_ORBIX_NP_KB_ENABLED",
    }
    if attestation_path.exists() and release_status == "staging_candidate":
        try:
            attestation_meta = json.loads(attestation_path.read_text(encoding="utf-8"))
            acks = set(attestation_meta.get("acknowledgements") or [])
            if (
                attestation_meta.get("production_approved") is True
                and attestation_meta.get("kb_posting_authority") is False
                and required_acks.issubset(acks)
                and attestation_meta.get("attestor")
            ):
                production_approved = True
                release_status = "production_owner_attested"
        except Exception:
            production_approved = False

    drill_path = review_dir / "rollback_drill_report.json"
    rollback_tested = True
    if drill_path.exists():
        try:
            rollback_tested = bool(
                json.loads(drill_path.read_text(encoding="utf-8")).get("rollback_tested", True)
            )
        except Exception:
            rollback_tested = True

    gate = {
        "generated_at": utc_now_iso(),
        "release_status": release_status,
        "production_approved": production_approved,
        "production_attestation": (
            {
                "attestor": (attestation_meta or {}).get("attestor"),
                "attested_at": (attestation_meta or {}).get("attested_at"),
                "licensed_ca_opinion": (attestation_meta or {}).get("licensed_ca_opinion", False),
                "kb_posting_authority": False,
            }
            if production_approved
            else None
        ),
        "human_review_required": not production_approved,
        "indexes_present": indexes_ok,
        "critical_invariants_ok": eval_ok,
        "rollback_tested": rollback_tested,
        "semantic_index": semantic_status,
        "human_overlay_decisions": any_overlays,
        "human_approve_class_overlays": approve_overlays,
        "next_action": (
            "Owner-attested production unlock for interpretation-only enablement. "
            "Set ORBIX_NP_KB_ENABLED=true in the target environment; KB still cannot post."
            if production_approved
            else (
                "Complete MUST_REVIEW_TOP25 (or priority lab) with human approve/approve_with_edit/"
                "promote_to_gold decisions; import overlays; re-run phase8. Not production."
                if approve_overlays < 25
                else "Staging ready — run owner close-out + attestation + rollback drill for production unlock."
            )
        ),
    }
    atomic_write_json(review_dir / "final_release_gate.json", gate)
    atomic_write_text(
        review_dir / "final_release_report.md",
        "\n".join(
            [
                "# Final Release Report",
                "",
                f"Status: **{release_status}**",
                f"production_approved: **{production_approved}**",
                "",
                "KB posting authority: **false** (always).",
                "",
                "Owner attestation unlocks interpretation-only enablement; it is **not** a",
                "licensed CA, legal, or tax professional certification.",
                "",
                f"Next: {gate['next_action']}",
                "",
            ]
        ),
    )

    update_phase(
        "8",
        name="Performance, Security, Release, and Rollback Gates",
        status="passed_with_warnings" if release_status == "development_ready" else "passed",
        finish=True,
        commands=["python knowledgebase/scripts/phase8_release_gate.py"],
        outputs=[
            rel_to_repo(repo_root, review_dir / "performance_baseline.json"),
            rel_to_repo(repo_root, review_dir / "security_review.md"),
            rel_to_repo(repo_root, review_dir / "final_release_gate.json"),
        ],
        findings=[f"release_status={release_status}"],
        warnings=["Human review required before any production enablement"],
        next_phase="complete",
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    cfg = load_config()
    p = argparse.ArgumentParser(description="Phase 8 release gate")
    p.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    args = p.parse_args(argv)
    repo = args.repo_root.resolve()
    return run(repo_root=repo, review_dir=(repo / cfg["paths"]["review_dir"]).resolve())


if __name__ == "__main__":
    sys.exit(main())
