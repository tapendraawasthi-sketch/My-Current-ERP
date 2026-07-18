"""MAI-07R3F-SEAL-LOCK-CHAIN — append-only holdout evaluation (Branch B).

Never mutates LOCKED_NOT_RUN body. Qualification is a separate artifact.
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
from .rc_lock_chain import (
    bind_predictions,
    compute_rc_raw_file_sha256,
    compute_rc_semantic_body_sha256,
    create_attempt,
    create_qualification_result,
    verify_complete_chain,
    verify_locked_rc,
)
from ..infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
    predictions_canonical_list_sha256,
    predictions_jsonl_raw_sha256,
    predictions_semantic_sha256,
    report_raw_and_semantic,
    sha256_bytes,
    sha256_file,
)

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3f_seal_lock_chain"
REPORTS = OUT / "reports"
RC_ID = "MAI_07R3F_LOCK_CHAIN_RELEASE_CANDIDATE_002"
LOCK_PATH = OUT / f"{RC_ID}.LOCKED_NOT_RUN.json"
ATTEMPT_PATH = OUT / f"{RC_ID}.HOLDOUT_ATTEMPT_001.json"
QUAL_PATH = OUT / f"{RC_ID}.QUALIFICATION_RESULT.json"
CHAIN_PATH = OUT / f"{RC_ID}.CHAIN_MANIFEST.json"
CANONICAL_SCORER = "mai-07.r3f.seal-lock-chain.canonical.1.0.0"
AUDIT_SCORER = "mai-07.r3f.seal-lock-chain.audit.1.0.0"
_HOLDOUT_EXECUTED = False


def load_split(split: str, repo: Path = REPO) -> list[dict[str, Any]]:
    path = OUT / f"{split.lower()}.jsonl"
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return sorted(rows, key=lambda c: c["case_id"])


def _assert_lock_immutable() -> tuple[dict[str, Any], str, str]:
    if not LOCK_PATH.exists():
        raise RuntimeError("LOCKED_NOT_RUN body missing")
    lock_bytes_before = LOCK_PATH.read_bytes()
    lock = json.loads(lock_bytes_before.decode("utf-8"))
    v = verify_locked_rc(lock)
    if not v["ok"]:
        raise RuntimeError(f"lock verification failed: {v['errors']}")
    sem = compute_rc_semantic_body_sha256(lock)
    raw = compute_rc_raw_file_sha256(LOCK_PATH)
    if lock.get("resource_content_sha256") != xlrr.compute_pack_content_hash():
        raise RuntimeError("resource hash mismatch at lock")
    ds = json.loads((OUT / "MAI_07R3F_SEAL_LOCK_CHAIN_DATASET_MANIFEST.json").read_text(encoding="utf-8"))
    if lock.get("fresh_holdout_dataset_sha256") != ds["splits"]["HOLDOUT_VALIDATION"]["sha256"]:
        raise RuntimeError("dataset hash mismatch at lock")
    thr = sha256_file(OUT / "MAI_07R3F_SEAL_LOCK_CHAIN_HOLDOUT_THRESHOLDS.json")
    if lock.get("threshold_sha256") != thr:
        raise RuntimeError("threshold hash mismatch at lock")
    return lock, sem, raw


def _assert_lock_unchanged(before: bytes) -> None:
    after = LOCK_PATH.read_bytes()
    if before != after:
        raise RuntimeError("LOCKED_NOT_RUN body mutated")


def run_split(
    split: str,
    *,
    write: bool = True,
    one_shot: bool = False,
    check_determinism: bool | None = None,
) -> dict[str, Any]:
    global _HOLDOUT_EXECUTED
    lock, lock_sem, lock_raw = _assert_lock_immutable()
    lock_bytes_before = LOCK_PATH.read_bytes()

    if one_shot and split == "HOLDOUT_VALIDATION":
        if ATTEMPT_PATH.exists():
            raise RuntimeError("holdout attempt exists; prohibited_rerun")
        if _HOLDOUT_EXECUTED:
            raise RuntimeError("in-process holdout already executed")

    cases = load_split(split)
    start = datetime.now(timezone.utc).isoformat()
    t0 = time.perf_counter()
    preds = r3f.run_predictions(cases)
    elapsed = time.perf_counter() - t0
    end = datetime.now(timezone.utc).isoformat()

    if check_determinism is None:
        check_determinism = split in {"HOLDOUT_VALIDATION", "CONTEXT_COUNTERFACTUAL"}

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
    thr = json.loads((OUT / "MAI_07R3F_SEAL_LOCK_CHAIN_HOLDOUT_THRESHOLDS.json").read_text(encoding="utf-8"))
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
        "parent_lock_semantic_sha256": lock_sem,
    }

    if write:
        REPORTS.mkdir(parents=True, exist_ok=True)
        pred_path = REPORTS / f"MAI_07R3F_LOCK_CHAIN_{split}_PREDICTIONS.jsonl"
        with pred_path.open("w", encoding="utf-8", newline="\n") as fh:
            for p in preds:
                fh.write(json.dumps(p, ensure_ascii=False, sort_keys=True) + "\n")
        raw_pred = predictions_jsonl_raw_sha256(pred_path)
        payload["predictions_jsonl_raw_sha256"] = raw_pred
        payload["prediction_path"] = str(pred_path.relative_to(REPO)).replace("\\", "/")
        payload["prediction_count"] = len(preds)

        canon_list_path = REPORTS / f"MAI_07R3F_LOCK_CHAIN_{split}_CANONICAL_PREDICTION_LIST.json"
        ordered = sorted(preds, key=lambda p: p["case_id"])
        canon_list_path.write_text(
            json.dumps(ordered, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        payload["canonical_prediction_list_path"] = str(canon_list_path.relative_to(REPO)).replace(
            "\\", "/"
        )
        payload["canonical_prediction_list_sha256"] = pred_canon

        rep_path = REPORTS / f"MAI_07R3F_LOCK_CHAIN_{split}_SCORE_REPORT.json"
        audit_path = REPORTS / f"MAI_07R3F_LOCK_CHAIN_{split}_AUDIT_REPORT.json"
        rep_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        audit_only = {"scorer_version": AUDIT_SCORER, "metrics": audit["metrics"], "split": split}
        audit_path.write_text(
            json.dumps(audit_only, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        per_case = REPORTS / f"MAI_07R3F_LOCK_CHAIN_{split}_PER_CASE_AUDIT.jsonl"
        with per_case.open("w", encoding="utf-8", newline="\n") as fh:
            by = {c["case_id"]: c for c in cases}
            for p in preds:
                row = r3f.score_case(by[p["case_id"]], p)
                fh.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
        diff_path = REPORTS / f"MAI_07R3F_LOCK_CHAIN_{split}_DIFFERENTIAL.json"
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
        rep_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="\n",
        )

        if one_shot and split == "HOLDOUT_VALIDATION":
            cmd = (
                "python -m src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3f_seal_lock_chain "
                "--split HOLDOUT_VALIDATION --one-shot"
            )
            attempt = create_attempt(
                attempt_id=f"mai07-r3f-lock-chain-holdout-{sha256_bytes(start.encode())[:12]}",
                rc_id=RC_ID,
                lock_semantic_sha256=lock_sem,
                lock_raw_sha256=lock_raw,
                command=cmd,
                split=split,
            )
            attempt["start_time"] = start
            attempt["end_time"] = end
            attempt["elapsed_seconds"] = round(elapsed, 3)
            attempt["submitted_count"] = len(cases)
            attempt["completed_count"] = len(preds)
            attempt["exceptions"] = 0
            attempt["timeouts"] = 0
            attempt["runtime_version"] = RUNTIME_VERSION
            attempt["resource_pack_version"] = RESOURCE_PACK_VERSION
            attempt["resource_content_sha256"] = xlrr.compute_pack_content_hash()
            attempt["gate_all_pass"] = gate["all_pass"]
            attempt = bind_predictions(attempt, pred_path=pred_path, preds=preds)
            ATTEMPT_PATH.write_text(
                json.dumps(attempt, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
                newline="\n",
            )

            qual = create_qualification_result(
                rc_id=RC_ID,
                lock_semantic_sha256=lock_sem,
                gate_all_pass=gate["all_pass"],
                attempt_id=attempt["attempt_id"],
                metrics_summary={
                    "all_pass": gate["all_pass"],
                    "metrics": report["metrics"],
                    "harm": harm,
                },
            )
            qual["canonical_report_semantic_sha256"] = can_sem
            qual["audit_report_semantic_sha256"] = aud_sem
            qual["predictions_jsonl_raw_sha256"] = raw_pred
            qual["predictions_canonical_list_sha256"] = pred_canon
            QUAL_PATH.write_text(
                json.dumps(qual, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
                newline="\n",
            )

            chain = {
                "schema_version": "2.0.0",
                "record_type": "CHAIN_MANIFEST",
                "rc_id": RC_ID,
                "phase": "MAI-07R3F-SEAL-LOCK-CHAIN",
                "branch": "B_APPEND_ONLY_NEW_RC",
                "verdict": "PASSED_NEW_LOCK_CHAIN_RC" if gate["all_pass"] else "FAILED_HOLDOUT_QUALITY",
                "locked_not_run_path": str(LOCK_PATH.relative_to(REPO)).replace("\\", "/"),
                "lock_record_path": str(
                    (OUT / f"{RC_ID}.LOCK_RECORD.json").relative_to(REPO)
                ).replace("\\", "/"),
                "holdout_attempt_path": str(ATTEMPT_PATH.relative_to(REPO)).replace("\\", "/"),
                "qualification_path": str(QUAL_PATH.relative_to(REPO)).replace("\\", "/"),
                "locked_semantic_sha256": lock_sem,
                "locked_raw_sha256": lock_raw,
                "predictions_jsonl_raw_sha256": raw_pred,
                "predictions_canonical_list_sha256": pred_canon,
                "canonical_report_semantic_sha256": can_sem,
                "audit_report_semantic_sha256": aud_sem,
                "scorer_agreement": audit["metrics"] == report["metrics"],
                "frozen_v2_opened": False,
                "LINGUIST_APPROVED": False,
                "PRODUCTION_APPROVED": False,
                "QUALITY_GATES_PASSED": False,
                "created_utc": datetime.now(timezone.utc).isoformat(),
            }
            CHAIN_PATH.write_text(
                json.dumps(chain, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            _HOLDOUT_EXECUTED = True
            payload["attempt"] = attempt
            payload["qualification"] = qual
            payload["chain_manifest"] = chain

    _assert_lock_unchanged(lock_bytes_before)
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
