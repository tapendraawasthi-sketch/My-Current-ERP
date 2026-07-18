"""MAI-07R3F-SEAL-NEW — fresh non-frozen holdout evaluation (one-shot after RC lock).

Does not open frozen V2. Does not reuse old R3F holdout as release evidence.
Reuses R3F scoring/gate logic with seal-contract V2 prediction hashes.
"""

from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import eval_mai07_r3f as r3f
from .eval_mai07_r3f_differential import run_differential
from .. import ENABLE_PROMOTION_OVERLAY, RESOURCE_PACK_VERSION, RUNTIME_VERSION
from ..infrastructure import resource_repository as xlrr
from ..infrastructure.english_identity_guard import EVAL_VERSION, GUARD_VERSION
from ..infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
    predictions_canonical_list_sha256,
    predictions_jsonl_raw_sha256,
    predictions_semantic_sha256,
    pretty_report_bytes,
    report_raw_and_semantic,
    sha256_bytes,
    sha256_file,
)

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3f_seal_new"
REPORTS = OUT / "reports"
RC_PATH = OUT / "MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001.manifest.json"
CANONICAL_SCORER = "mai-07.r3f.sealnew.canonical.1.0.0"
AUDIT_SCORER = "mai-07.r3f.sealnew.audit.1.0.0"
_HOLDOUT_EXECUTED = False


def load_split(split: str, repo: Path = REPO) -> list[dict[str, Any]]:
    path = OUT / f"{split.lower()}.jsonl"
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return sorted(rows, key=lambda c: c["case_id"])


def _assert_rc_locked() -> dict[str, Any]:
    if not RC_PATH.exists():
        raise RuntimeError("RC not locked")
    rc = json.loads(RC_PATH.read_text(encoding="utf-8"))
    if not rc.get("locked") or not rc.get("locked_before_holdout"):
        raise RuntimeError("RC not locked before holdout")
    if rc.get("status") not in {"LOCKED_NOT_RUN", "HOLDOUT_EXECUTED", "PASSED_NEW_RC", "NEW_RC_HOLDOUT_FAILED"}:
        raise RuntimeError(f"unexpected RC status {rc.get('status')}")
    return rc


def run_split(
    split: str,
    *,
    write: bool = True,
    one_shot: bool = False,
    check_determinism: bool | None = None,
) -> dict[str, Any]:
    global _HOLDOUT_EXECUTED
    rc = _assert_rc_locked()
    if one_shot and split == "HOLDOUT_VALIDATION":
        if rc.get("status") != "LOCKED_NOT_RUN":
            raise RuntimeError("holdout already opened; prohibited_rerun")
        if _HOLDOUT_EXECUTED:
            raise RuntimeError("in-process holdout already executed")
        marker = REPORTS / "MAI_07R3F_SEAL_NEW_HOLDOUT_ATTEMPT.json"
        if marker.exists():
            raise RuntimeError("holdout attempt artifact exists; prohibited_rerun")

    cases = load_split(split)
    start = datetime.now(timezone.utc).isoformat()
    t0 = time.perf_counter()
    preds = r3f.run_predictions(cases)
    elapsed = time.perf_counter() - t0
    end = datetime.now(timezone.utc).isoformat()

    if check_determinism is None:
        check_determinism = split in {"HOLDOUT_VALIDATION", "CONTEXT_COUNTERFACTUAL"}

    # Differential vs unguarded ranker (same as R3F) using seal-new cases
    # Monkey-patch load_split used inside differential by passing cases explicitly
    from . import eval_mai07_r3f_differential as diffmod

    orig_load = diffmod.load_split

    def _load_override(s: str, repo: Path = REPO):
        if s == split:
            return cases
        return load_split(s, repo)

    diffmod.load_split = _load_override  # type: ignore[assignment]
    try:
        diff = run_differential(split, cases=cases, r3f_preds=preds)
    finally:
        diffmod.load_split = orig_load  # type: ignore[assignment]

    report = r3f.aggregate(
        cases,
        preds,
        check_determinism=check_determinism,
        candidate_set_preservation=float(diff.get("candidate_set_preservation", 1.0)),
    )
    report["scorer_version"] = CANONICAL_SCORER
    audit = r3f.audit_aggregate(report)
    audit["scorer_version"] = AUDIT_SCORER
    r3f.assert_scorers_agree(report, audit)
    thr = json.loads((OUT / "MAI_07R3F_SEAL_NEW_HOLDOUT_THRESHOLDS.json").read_text(encoding="utf-8"))
    harm = {
        "english_identity_harm": int(diff.get("english_identity_harm", 0)),
        "romanized_target_top1_harm": int(diff.get("romanized_target_top1_harm", 0)),
        "target_recall_at_5_harm": int(diff.get("target_recall_at_5_harm", 0)),
        "proper_name_harm": int(diff.get("proper_name_harm", 0)),
        "protected_harm": int(diff.get("protected_harm", 0)),
    }
    report["harm"] = harm
    report["differential"] = {
        k: diff.get(k)
        for k in (
            "english_identity_harm",
            "romanized_target_top1_harm",
            "target_recall_at_5_harm",
            "proper_name_harm",
            "protected_harm",
            "candidate_set_preservation",
            "note",
        )
    }
    gate = r3f.evaluate_gates(report, thr, harm)
    pred_canon = predictions_canonical_list_sha256(preds)
    pred_sem = predictions_semantic_sha256(preds)
    payload: dict[str, Any] = {
        "split": split,
        "report": report,
        "audit": audit,
        "gate_decision": gate,
        "predictions_canonical_list_sha256": pred_canon,
        "predictions_semantic_sha256": pred_sem,
        "prediction_ordering_contract": "sorted_by_case_id_ascending",
        "canonical_serialization_contract": "json.dumps(sort_keys,separators)",
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "QUALITY_GATES_PASSED": False,
        "evaluator_version": EVAL_VERSION,
        "runtime_version": RUNTIME_VERSION,
        "resource_version": RESOURCE_PACK_VERSION,
        "resource_hash": xlrr.compute_pack_content_hash(),
        "guard_version": GUARD_VERSION,
        "overlay_disabled": ENABLE_PROMOTION_OVERLAY is False,
        "rc_manifest_sha256": rc.get("manifest_sha256"),
    }
    if write:
        REPORTS.mkdir(parents=True, exist_ok=True)
        pred_path = REPORTS / f"MAI_07R3F_SEAL_NEW_{split}_PREDICTIONS.jsonl"
        with pred_path.open("w", encoding="utf-8", newline="\n") as fh:
            for p in preds:
                fh.write(json.dumps(p, ensure_ascii=False, sort_keys=True) + "\n")
        raw_pred = predictions_jsonl_raw_sha256(pred_path)
        payload["predictions_jsonl_raw_sha256"] = raw_pred
        payload["prediction_path"] = str(pred_path.relative_to(REPO)).replace("\\", "/")
        payload["prediction_count"] = len(preds)

        rep_path = REPORTS / f"MAI_07R3F_SEAL_NEW_{split}_SCORE_REPORT.json"
        audit_path = REPORTS / f"MAI_07R3F_SEAL_NEW_{split}_AUDIT_REPORT.json"
        # Write reports without self-hashes first
        core = dict(payload)
        rep_path.write_text(
            json.dumps(core, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        audit_only = {"scorer_version": AUDIT_SCORER, "metrics": audit["metrics"], "split": split}
        audit_path.write_text(
            json.dumps(audit_only, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        per_case = REPORTS / f"MAI_07R3F_SEAL_NEW_{split}_PER_CASE_AUDIT.jsonl"
        with per_case.open("w", encoding="utf-8", newline="\n") as fh:
            by = {c["case_id"]: c for c in cases}
            for p in preds:
                row = r3f.score_case(by[p["case_id"]], p)
                fh.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
        diff_path = REPORTS / f"MAI_07R3F_SEAL_NEW_{split}_DIFFERENTIAL.json"
        diff_path.write_text(
            json.dumps(diff, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        can_raw, can_sem = report_raw_and_semantic(path=rep_path)
        aud_raw, aud_sem = report_raw_and_semantic(path=audit_path)
        payload["canonical_report_raw_sha256"] = can_raw
        payload["canonical_report_semantic_sha256"] = can_sem
        payload["audit_report_raw_sha256"] = aud_raw
        payload["audit_report_semantic_sha256"] = aud_sem
        payload["per_case_audit_raw_sha256"] = sha256_file(per_case)
        payload["report_path"] = str(rep_path.relative_to(REPO)).replace("\\", "/")
        # Rewrite score report with hash fields
        rep_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )

        if one_shot and split == "HOLDOUT_VALIDATION":
            attempt = {
                "attempt_id": f"mai07-r3f-sealnew-holdout-{sha256_bytes(start.encode())[:12]}",
                "split": split,
                "start_time": start,
                "end_time": end,
                "elapsed_seconds": round(elapsed, 3),
                "submitted_count": len(cases),
                "completed_count": len(preds),
                "exceptions": 0,
                "timeouts": 0,
                "runtime_version": RUNTIME_VERSION,
                "resource_pack_version": RESOURCE_PACK_VERSION,
                "resource_content_sha256": xlrr.compute_pack_content_hash(),
                "predictions_jsonl_raw_sha256": raw_pred,
                "predictions_canonical_list_sha256": pred_canon,
                "predictions_semantic_sha256": pred_sem,
                "prediction_path": payload["prediction_path"],
                "mutation_attempts": 0,
                "successful_mutations": 0,
                "gate_all_pass": gate["all_pass"],
                "prohibited_rerun": True,
                "frozen_v2_opened": False,
            }
            marker.write_text(
                json.dumps(attempt, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            # Update RC status
            rc["status"] = "HOLDOUT_EXECUTED" if gate["all_pass"] else "NEW_RC_HOLDOUT_FAILED"
            rc["holdout_attempt"] = attempt
            rc["holdout_gate_all_pass"] = gate["all_pass"]
            # Preserve semantic hash fields; rewrite carefully
            core_rc = {
                k: v
                for k, v in rc.items()
                if k
                not in {
                    "manifest_sha256",
                    "rc_manifest_raw_sha256",
                    "rc_manifest_semantic_sha256",
                }
            }
            sem = hashlib.sha256(
                (json.dumps(core_rc, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode(
                    "utf-8"
                )
            ).hexdigest()
            rc["rc_manifest_semantic_sha256"] = sem
            rc["manifest_sha256"] = sem
            with_sem = {k: v for k, v in rc.items() if k != "rc_manifest_raw_sha256"}
            rc["rc_manifest_raw_sha256"] = hashlib.sha256(
                (json.dumps(with_sem, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode(
                    "utf-8"
                )
            ).hexdigest()
            RC_PATH.write_text(
                json.dumps(rc, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            _HOLDOUT_EXECUTED = True
            payload["attempt"] = attempt
    return payload


def main() -> int:
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--split", required=True)
    p.add_argument("--no-write", action="store_true")
    p.add_argument("--one-shot", action="store_true")
    args = p.parse_args()
    out = run_split(args.split, write=not args.no_write, one_shot=args.one_shot)
    print(
        json.dumps(
            {
                "split": args.split,
                "all_pass": out["gate_decision"]["all_pass"],
                "metrics": out["report"]["metrics"],
                "harm": out["report"]["harm"],
                "predictions_canonical_list_sha256": out.get("predictions_canonical_list_sha256"),
                "predictions_jsonl_raw_sha256": out.get("predictions_jsonl_raw_sha256"),
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0 if out["gate_decision"]["all_pass"] or args.split == "DEVELOPMENT" else 1


if __name__ == "__main__":
    raise SystemExit(main())
