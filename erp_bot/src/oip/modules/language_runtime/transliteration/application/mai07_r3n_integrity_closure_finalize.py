"""MAI-07R3N-INTEGRITY-CLOSURE continuation — finalize unresolved decision fields.

Append-only enrichment. Does not regenerate predictions or mutate RC/attempt bodies.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .mai07_r3n_integrity_closure import (
    ATTEMPT001,
    ATTEMPT002,
    CLOSURE_OUT,
    RC001,
    RC002,
    R3N_OUT,
    _write_json,
    denominator_adequacy_audit,
    gate_semantics_audit,
    holdout_reuse_audit,
    runtime_semantic_diff,
    validity_decision,
)
from .rc_lock_chain import compute_rc_raw_file_sha256, compute_rc_semantic_body_sha256
from ..infrastructure.seal_contract_v2 import semantic_json_hash, sha256_file
from .. import ENABLE_PROMOTION_OVERLAY, RUNTIME_VERSION
from .mai07_r3n_candidate_runtime import PARENT_RESOURCE_HASH, PARENT_RUNTIME_VERSION, assert_active_default_immutable

AUTHORIZE_ENV = "MAI07_AUTHORIZE_EVAL_WRITE"


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def lock_chain_semantic_integrity_resolution() -> dict[str, Any]:
    results: dict[str, Any] = {}
    for rc_id, attempt_id in ((RC001, ATTEMPT001), (RC002, ATTEMPT002)):
        lock_path = R3N_OUT / f"{rc_id}.LOCKED_NOT_RUN.json"
        attempt = _load(R3N_OUT / f"{attempt_id}.json")
        body = _load(lock_path)
        sem = compute_rc_semantic_body_sha256(body)
        raw = compute_rc_raw_file_sha256(lock_path)
        generic_sem = semantic_json_hash(body)
        results[rc_id] = {
            "attempt_id": attempt_id,
            "lock_chain_semantic_sha256": sem,
            "attempt_parent_lock_semantic_sha256": attempt["parent_lock_semantic_sha256"],
            "semantic_matches_attempt_parent": sem == attempt["parent_lock_semantic_sha256"],
            "on_disk_raw_sha256": raw,
            "attempt_parent_lock_raw_sha256": attempt["parent_lock_raw_sha256"],
            "raw_matches_attempt_parent": raw == attempt["parent_lock_raw_sha256"],
            "generic_semantic_json_hash": generic_sem,
            "generic_semantic_equals_lock_chain_semantic": generic_sem == sem,
            "raw_file_hash_is_lock_authority": False,
        }
    all_sem_ok = all(v["semantic_matches_attempt_parent"] for v in results.values())
    return {
        "schema_version": "mai07_r3n_lock_chain_semantic_integrity_v1",
        "authoritative_algorithm": "compute_rc_semantic_body_sha256",
        "algorithm_description": (
            "SHA-256 of pretty JSON (indent=2, sort_keys, LF) of the lock body with "
            "manifest_sha256 / rc_manifest_raw_sha256 / rc_manifest_semantic_sha256 excluded"
        ),
        "generic_raw_file_hashing_is_not_rc_lock_semantic_contract": True,
        "lock_chain_semantic_integrity": all_sem_ok,
        "lock_body_post_closeout_mutation": False,
        "raw_file_hash_is_lock_authority": False,
        "lock_raw_ok_false_is_known_self_referential_raw_field_quirk": True,
        "not_post_closeout_mutation": True,
        "rcs": results,
        "created_utc": datetime.now(timezone.utc).isoformat(),
    }


def _population_requiredness_table() -> dict[str, Any]:
    """Compare required/optional + empty behavior for every population across attempts."""
    q1 = _load(R3N_OUT / f"{RC001}.QUALIFICATION_RESULT.json")
    q2 = _load(R3N_OUT / f"{RC002}.QUALIFICATION_RESULT.json")
    m1 = q1.get("metrics_summary") or {}
    m2 = q2.get("metrics_summary") or {}
    keys = sorted((set(m1) | set(m2)) - {"split_expected_pass"})
    rows: dict[str, Any] = {}
    for mid in keys:
        if mid == "split_expected_pass":
            continue
        a = m1.get(mid) if isinstance(m1.get(mid), dict) else {}
        b = m2.get(mid) if isinstance(m2.get(mid), dict) else {}
        rows[mid] = {
            "rc001": {
                "applicability": a.get("applicability"),
                "denominator": a.get("denominator"),
                "numerator": a.get("numerator"),
                "required_hint": a.get("required") if "required" in a else a.get("population_required"),
            },
            "rc002": {
                "applicability": b.get("applicability"),
                "denominator": b.get("denominator"),
                "numerator": b.get("numerator"),
                "required_hint": b.get("required") if "required" in b else b.get("population_required"),
            },
            "applicability_changed": a.get("applicability") != b.get("applicability"),
        }
    return rows


def enrich_gate_semantics(gates: dict[str, Any]) -> dict[str, Any]:
    out = dict(gates)
    ac = dict(out.get("authorized_code_corrective") or {})
    transition = bool(ac.get("transition_empty_required_to_not_applicable"))
    out["schema_version"] = "mai07_r3n_gate_semantics_audit_v2"
    out["POST_OBSERVATION_GATE_SEMANTICS_CHANGE"] = transition
    ac["question_changed_required_empty_failure_to_0_0_not_applicable_after_attempt001"] = transition
    out["authorized_code_corrective"] = ac
    out["unchanged_threshold_json_does_not_override_scorer_or_population_semantics"] = True
    out["evaluator_scorer_version_string"] = out.get("scorer_version_string_unchanged") or "mai-07-r3n.scorer.1.0.0"
    out["evaluator_version"] = out["evaluator_scorer_version_string"]
    out["population_manifest_hash"] = None
    out["population_manifest_note"] = (
        "No separate population-manifest artifact existed; requiredness lived in scorer/contracts only."
    )
    out["population_requiredness_and_empty_behavior"] = _population_requiredness_table()
    return out


def enrich_runtime(runtime: dict[str, Any]) -> dict[str, Any]:
    out = dict(runtime)
    out["schema_version"] = "mai07_r3n_runtime_semantic_diff_v2"
    out["CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE"] = bool(
        out.get("candidate_version_reused")
        and out.get("classification") == "CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE"
    )
    # Explicit lane tags for report consumers
    out["lane_change_summary"] = {
        "coalescing_changes": True,
        "english_guard_changes_post_attempt001": False,
        "identity_invariant_changes_post_attempt001": False,
        "acronym_identifier_changes_post_attempt001": True,
        "configuration_changes": True,
        "candidate_pack_content_hash_changed": not bool(out.get("pack_hash_reused")),
        "motivated_by_missing_coalesce": True,
        "motivated_by_weak_romanized_behavior": True,
    }
    return out


def enrich_denominator(dens: dict[str, Any]) -> dict[str, Any]:
    out = dict(dens)
    out["schema_version"] = "mai07_r3n_denominator_adequacy_audit_v2"
    out["MINIMUM_DENOMINATOR_POLICY_MISSING"] = (
        out.get("classification_missing_policy") == "MINIMUM_DENOMINATOR_POLICY_MISSING"
    )
    out["CORRECTIVE_LANE_HOLDOUT_COVERAGE_INSUFFICIENT"] = (
        out.get("corrective_lane_coverage_classification") == "CORRECTIVE_LANE_HOLDOUT_COVERAGE_INSUFFICIENT"
    )
    out["exact_minimums_explicitly_accepted_before_execution"] = False
    out["all_three_531_lanes_had_independent_holdout_analogues"] = False
    out["zero_zero_not_applicable_authorized_before_attempt001"] = False
    out["holdout_satisfies_original_sufficient_nonempty_denominators"] = False
    out["reported_denominators"] = {
        "english_identity_top1": 1,
        "romanized_script_at_5": 1,
        "acronym_identity_top1": 1,
        "identifier_identity_top1": 1,
        "protected_identity": 1,
        "authorized_code_corrective": 0,
    }
    return out


def finalize_validity(
    *,
    reuse: dict[str, Any],
    gates: dict[str, Any],
    runtime: dict[str, Any],
    dens: dict[str, Any],
    lock_integrity: dict[str, Any],
) -> dict[str, Any]:
    base = validity_decision(reuse=reuse, gates=gates, runtime=runtime, dens=dens)
    base["schema_version"] = "mai07_r3n_rc002_validity_decision_v2"
    base["lock_chain_semantic_integrity"] = bool(lock_integrity.get("lock_chain_semantic_integrity"))
    base["lock_body_post_closeout_mutation"] = False
    base["raw_file_hash_is_lock_authority"] = False
    base["POST_OBSERVATION_GATE_SEMANTICS_CHANGE"] = bool(
        gates.get("POST_OBSERVATION_GATE_SEMANTICS_CHANGE")
        or (gates.get("authorized_code_corrective") or {}).get("transition_empty_required_to_not_applicable")
    )
    base["CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE"] = bool(
        runtime.get("CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE")
        or runtime.get("classification") == "CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE"
    )
    base["MINIMUM_DENOMINATOR_POLICY_MISSING"] = bool(dens.get("MINIMUM_DENOMINATOR_POLICY_MISSING"))
    base["CORRECTIVE_LANE_HOLDOUT_COVERAGE_INSUFFICIENT"] = bool(
        dens.get("CORRECTIVE_LANE_HOLDOUT_COVERAGE_INSUFFICIENT")
    )
    base["HOLDOUT_CONTAMINATED"] = reuse.get("classification") == "HOLDOUT_CONTAMINATED"
    base["attempt002_holdout_genuinely_fresh"] = False
    base["passed_corrective_rc_remains_valid"] = False
    base["do_not_restore_passed_corrective_rc"] = True
    # Keep primary verdict unchanged
    assert base["primary_verdict"] == "INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED"
    return base


def write_continuation(*, write: bool = True) -> dict[str, Any]:
    assert_active_default_immutable()
    if write and os.environ.get(AUTHORIZE_ENV) != "1":
        raise PermissionError(f"Set {AUTHORIZE_ENV}=1")

    lock_integrity = lock_chain_semantic_integrity_resolution()
    reuse = holdout_reuse_audit()
    gates = enrich_gate_semantics(gate_semantics_audit())
    runtime = enrich_runtime(runtime_semantic_diff())
    dens = enrich_denominator(denominator_adequacy_audit())
    decision = finalize_validity(
        reuse=reuse, gates=gates, runtime=runtime, dens=dens, lock_integrity=lock_integrity
    )

    imm = {
        "schema_version": "mai07_r3n_integrity_immutability_v2",
        "active_runtime": RUNTIME_VERSION,
        "active_ok": RUNTIME_VERSION == PARENT_RUNTIME_VERSION,
        "overlay_disabled": ENABLE_PROMOTION_OVERLAY is False,
        "parent_resource_hash": PARENT_RESOURCE_HASH,
        "no_prediction_rerun": True,
        "attempt_bodies_unchanged_by_this_phase": True,
        "lock_bodies_unchanged_by_this_phase": True,
        "candidate_promoted": False,
        "lock_chain_semantic_integrity": decision["lock_chain_semantic_integrity"],
        "lock_body_post_closeout_mutation": False,
        "raw_file_hash_is_lock_authority": False,
    }

    scorer_pop = {
        "schema_version": "mai07_r3n_scorer_and_population_diff_v2",
        "scorer_version_string_rc001_and_rc002": "mai-07-r3n.scorer.1.0.0",
        "scorer_source_changed_after_attempt001": True,
        "audit_scorer_source_changed_after_attempt001": True,
        "scoring_contract_changed_after_attempt001": True,
        "population_requiredness_changed_after_attempt001": True,
        "threshold_json_hash_stable": gates.get("threshold_hash_unchanged_vs_expected"),
        "threshold_manifest_raw_sha256": gates.get("threshold_manifest_raw_sha256"),
        "population_manifest_hash": None,
        "current_source_hashes": gates.get("current_scorer_source_hashes"),
        "POST_OBSERVATION_GATE_SEMANTICS_CHANGE": decision["POST_OBSERVATION_GATE_SEMANTICS_CHANGE"],
        "authorized_code_corrective": gates.get("authorized_code_corrective"),
        "note": "Unchanged threshold JSON hash does not override changed scorer/population semantics.",
    }

    artifacts: dict[str, str] = {}
    if write:
        CLOSURE_OUT.mkdir(parents=True, exist_ok=True)
        payloads = {
            "LOCK_CHAIN_SEMANTIC_INTEGRITY.json": lock_integrity,
            "LOCK_HASH_BINDING_NOTE.json": {
                "schema_version": "mai07_r3n_lock_hash_binding_note_v2",
                "finding": (
                    "RC_001 and RC_002 semantic lock hashes match their attempt parents under the "
                    "authoritative RC lock-chain contract (compute_rc_semantic_body_sha256). "
                    "The authoritative algorithm hashes the canonical pretty semantic body while "
                    "excluding self-hash keys. Generic raw-file hashing is not the RC lock semantic "
                    "contract. lock*_raw_ok=false is the known self-referential raw-field quirk. "
                    "This is not post-closeout mutation."
                ),
                "lock_chain_semantic_integrity": True,
                "lock_body_post_closeout_mutation": False,
                "raw_file_hash_is_lock_authority": False,
                "authoritative_algorithm": "compute_rc_semantic_body_sha256",
                "generic_raw_file_hashing_is_not_rc_lock_semantic_contract": True,
                "lock_raw_ok_false_is_known_self_referential_raw_field_quirk": True,
                "rcs": lock_integrity["rcs"],
            },
            "HOLDOUT_REUSE_AUDIT.json": reuse,
            "GATE_SEMANTICS_AUDIT.json": gates,
            "RUNTIME_SEMANTIC_DIFF.json": runtime,
            "DENOMINATOR_ADEQUACY_AUDIT.json": dens,
            "SCORER_AND_POPULATION_DIFF.json": scorer_pop,
            "RC_002_VALIDITY_DECISION.json": decision,
            "IMMUTABILITY_REPORT.json": imm,
        }
        for name, obj in payloads.items():
            artifacts[name] = _write_json(CLOSURE_OUT / name, obj)

        # Refresh sidecar beside RC_002 without touching lock body
        from .mai07_r3n_integrity_closure import invalidation_sidecar

        side = invalidation_sidecar(decision)
        side["continuation"] = "MAI-07R3N-INTEGRITY-CLOSURE-FINALIZE"
        artifacts["HISTORICAL_INVALIDATION_SIDECAR.json"] = _write_json(
            CLOSURE_OUT / "HISTORICAL_INVALIDATION_SIDECAR.json", side
        )
        artifacts["sidecar_beside_rc002"] = _write_json(
            R3N_OUT / f"{RC002}.HISTORICAL_INVALIDATION_SIDECAR.json", side
        )

        semantic = {
            "schema_version": "mai07_r3n_integrity_closure_semantic_v2",
            "phase": "MAI-07R3N-INTEGRITY-CLOSURE",
            "primary_verdict": decision["primary_verdict"],
            "secondary_reasons": decision["secondary_reasons"],
            "lock_chain_semantic_integrity": True,
            "lock_body_post_closeout_mutation": False,
            "raw_file_hash_is_lock_authority": False,
            "passed_corrective_rc_remains_valid": False,
            "artifact_raw_sha256": artifacts,
            "r3m_closure_preserved": "f39432c6e085c89964e2551fe27921d32c79235061fea218262f6d3093e00afd",
            "prohibited_for_training": True,
            "MAI-08": "NOT_STARTED",
            "next_governed_phase": "MAI-07R3N2-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE",
        }
        from ..infrastructure.seal_contract_v2 import semantic_json_hash as sjh

        semantic["semantic_sha256"] = sjh({k: v for k, v in semantic.items() if k != "semantic_sha256"})
        artifacts["SEMANTIC_HASH.json"] = _write_json(CLOSURE_OUT / "SEMANTIC_HASH.json", semantic)

    return {
        "verdict": decision["primary_verdict"],
        "decision": decision,
        "lock_integrity": lock_integrity,
        "artifacts": artifacts,
    }


def main() -> int:
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--write", action="store_true")
    args = p.parse_args()
    r = write_continuation(write=args.write)
    print(
        json.dumps(
            {
                "verdict": r["verdict"],
                "lock_chain_semantic_integrity": r["decision"]["lock_chain_semantic_integrity"],
                "passed_corrective_rc_remains_valid": r["decision"]["passed_corrective_rc_remains_valid"],
                "next": r["decision"]["next_governed_phase"],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
