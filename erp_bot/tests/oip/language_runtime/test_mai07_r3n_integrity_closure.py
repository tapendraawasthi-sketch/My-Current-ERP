"""MAI-07R3N-INTEGRITY-CLOSURE focused tests.

Never regenerates holdout predictions. Never mutates RC/attempt bodies.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from erp_bot.src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    RUNTIME_VERSION,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n_candidate_runtime import (
    CANDIDATE_RUNTIME_VERSION,
    PARENT_RUNTIME_VERSION,
    assert_active_default_immutable,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n_integrity_closure import (
    ATTEMPT001,
    ATTEMPT002,
    CLOSURE_OUT,
    EXPECTED_RC001_HOLDOUT_SHA,
    EXPECTED_RC002_LOCK_SEMANTIC,
    RC001,
    RC002,
    R3N_OUT,
    _jsonl_bytes,
    denominator_adequacy_audit,
    gate_semantics_audit,
    holdout_reuse_audit,
    reconstruct_attempt001_holdout,
    reject_candidate_version_reuse,
    reject_lock_missing_bindings,
    reject_required_to_not_applicable,
    reject_same_holdout_after_runtime_change,
    run_closure,
    runtime_semantic_diff,
    snapshot_forensics,
    validity_decision,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n_integrity_closure_finalize import (
    lock_chain_semantic_integrity_resolution,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.rc_lock_chain import (
    compute_rc_semantic_body_sha256,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.seal_contract_v2 import (
    semantic_json_hash,
    sha256_bytes,
    sha256_file,
)

REPO = Path(__file__).resolve().parents[4]


def _load(name: str) -> dict:
    return json.loads((CLOSURE_OUT / name).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def closure_artifacts():
    if not (CLOSURE_OUT / "RC_002_VALIDITY_DECISION.json").is_file():
        pytest.skip("integrity closure artifacts not written yet")
    return CLOSURE_OUT


def test_rc_artifact_hashes_and_anchors(closure_artifacts):
    snap = _load("FORENSIC_SNAPSHOT.manifest.json")
    assert snap["expected_anchors"]["rc001_holdout_sha256"] == EXPECTED_RC001_HOLDOUT_SHA
    assert snap["expected_anchors"]["rc002_lock_semantic_sha256"] == EXPECTED_RC002_LOCK_SEMANTIC
    assert (R3N_OUT / f"{RC001}.LOCKED_NOT_RUN.json").is_file()
    assert (R3N_OUT / f"{RC002}.LOCKED_NOT_RUN.json").is_file()
    assert snap["files"][f"{RC001}.LOCKED_NOT_RUN.json"]["exists"]


def test_timeline_reconstruction(closure_artifacts):
    tl = _load("ATTEMPT_TIMELINE.json")
    assert tl["events"][1]["attempt_id"] == ATTEMPT001
    assert tl["events"][5]["attempt_id"] == ATTEMPT002
    assert tl["runtime_changed_between_attempts"] is True
    assert tl["scorer_changed_between_attempts"] is True
    assert tl["lock_before_attempt001"] and tl["lock_before_attempt002"]


def test_holdout_reuse_detection(closure_artifacts):
    reuse = _load("HOLDOUT_REUSE_AUDIT.json")
    assert reuse["attempt001_reconstruction_matches_rc001_lock"] is True
    assert reuse["exact_case_reuse_count"] == 8
    assert reuse["template_family_overlap_count"] == 8
    assert reuse["exact_text_reuse_count"] == 7
    assert reuse["predictions_generated_against_same_cases"] is True
    assert reuse["classification"] == "HOLDOUT_CONTAMINATED"
    assert reuse["holdout_hash_equal"] is False
    assert reuse["same_builder_seed_family"] is True
    assert reuse["attempt002_executed_same_eight_holdout_case_ids"] is True
    assert reuse["reused_cases_already_had_attempt001_predictions"] is True


def test_holdout_surface_hashes_and_shared_sets(closure_artifacts):
    reuse = _load("HOLDOUT_REUSE_AUDIT.json")
    a1 = reuse["attempt001_holdout_hashes"]
    a2 = reuse["attempt002_holdout_hashes"]
    for key in (
        "raw_sha256",
        "canonical_semantic_sha256",
        "case_id_set_sha256",
        "normalized_text_set_sha256",
        "template_family_set_sha256",
    ):
        assert key in a1 and key in a2
    assert a1["raw_sha256"] == EXPECTED_RC001_HOLDOUT_SHA
    assert a2["raw_sha256"] == "192dd0812a919e17ab3654f600ced33be9b5dc6e0ab9112da60089c75744b4d7"
    assert a1["case_id_set_sha256"] == a2["case_id_set_sha256"]
    assert a1["template_family_set_sha256"] == a2["template_family_set_sha256"]
    assert a1["normalized_text_set_sha256"] != a2["normalized_text_set_sha256"]
    assert len(reuse["shared_case_ids"]) == 8
    assert len(reuse["shared_normalized_text_hashes"]) == 7
    assert len(reuse["shared_template_families"]) == 8


def test_case_id_text_family_overlap(closure_artifacts):
    fam = _load("TEMPLATE_FAMILY_OVERLAP_AUDIT.json")
    assert fam["full_overlap"] is True
    reuse = _load("HOLDOUT_REUSE_AUDIT.json")
    assert reuse["exact_case_union_count"] == 8
    assert reuse["exact_text_only_attempt001"] == 1
    assert reuse["exact_text_only_attempt002"] == 1


def test_runtime_semantic_diff_and_version_reuse(closure_artifacts):
    runtime = _load("RUNTIME_SEMANTIC_DIFF.json")
    assert runtime["candidate_version_reused"] is True
    assert runtime["classification"] == "CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE"
    assert runtime.get("CANDIDATE_VERSION_REUSED_AFTER_SEMANTIC_CHANGE") is True
    assert any(
        c["responds_to_attempt001"] and c["changes_runtime_behavior"]
        for c in runtime["post_attempt001_changes"]
    )
    lanes = runtime.get("lane_change_summary") or {}
    assert lanes.get("coalescing_changes") is True
    assert lanes.get("motivated_by_missing_coalesce") is True


def test_scorer_and_gate_semantics(closure_artifacts):
    gates = _load("GATE_SEMANTICS_AUDIT.json")
    ac = gates["authorized_code_corrective"]
    assert ac["rc001"]["applicability"] == "INVALID_REQUIRED_POPULATION"
    assert ac["rc002"]["applicability"] == "NOT_APPLICABLE"
    assert ac["transition_empty_required_to_not_applicable"] is True
    assert ac["classification"] == "POST_OBSERVATION_GATE_SEMANTICS_CHANGE"
    assert gates.get("POST_OBSERVATION_GATE_SEMANTICS_CHANGE") is True
    assert gates["rc_locks_bind_scorer_hashes"] is False
    scorer = _load("SCORER_AND_POPULATION_DIFF.json")
    assert scorer["POST_OBSERVATION_GATE_SEMANTICS_CHANGE"] is True
    assert scorer["scorer_source_changed_after_attempt001"] is True


def test_denominator_and_lane_coverage(closure_artifacts):
    dens = _load("DENOMINATOR_ADEQUACY_AUDIT.json")
    assert dens["classification_missing_policy"] == "MINIMUM_DENOMINATOR_POLICY_MISSING"
    assert dens["corrective_lane_coverage_classification"] == "CORRECTIVE_LANE_HOLDOUT_COVERAGE_INSUFFICIENT"
    assert dens.get("MINIMUM_DENOMINATOR_POLICY_MISSING") is True
    assert dens.get("CORRECTIVE_LANE_HOLDOUT_COVERAGE_INSUFFICIENT") is True
    assert dens["authorized_code_corrective_denominator_on_holdout"] in (0, None)
    assert dens["exact_minimums_explicitly_accepted_before_execution"] is False
    assert dens["zero_zero_not_applicable_authorized_before_attempt001"] is False


def test_validity_decision_and_passed_rc_withdrawn(closure_artifacts):
    decision = _load("RC_002_VALIDITY_DECISION.json")
    assert decision["primary_verdict"] == "INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED"
    assert decision["passed_corrective_rc_remains_valid"] is False
    assert decision.get("do_not_restore_passed_corrective_rc") is True
    assert decision["candidate_not_eligible_for_frozen_v3"] is True
    assert decision["next_governed_phase"] == "MAI-07R3N2-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE"
    assert "HOLDOUT_CONTAMINATED" in decision["secondary_reasons"]
    assert decision["lock_chain_semantic_integrity"] is True
    assert decision["lock_body_post_closeout_mutation"] is False
    assert decision["raw_file_hash_is_lock_authority"] is False


def test_lock_chain_semantic_integrity_resolution(closure_artifacts):
    note = _load("LOCK_HASH_BINDING_NOTE.json")
    lock = _load("LOCK_CHAIN_SEMANTIC_INTEGRITY.json")
    assert note["lock_chain_semantic_integrity"] is True
    assert note["lock_body_post_closeout_mutation"] is False
    assert note["raw_file_hash_is_lock_authority"] is False
    assert lock["lock_chain_semantic_integrity"] is True
    assert lock["authoritative_algorithm"] == "compute_rc_semantic_body_sha256"
    for rc_id in (RC001, RC002):
        assert lock["rcs"][rc_id]["semantic_matches_attempt_parent"] is True
        assert lock["rcs"][rc_id]["raw_file_hash_is_lock_authority"] is False


def test_audits_must_use_lock_chain_semantic_helper_not_generic_raw():
    """Regression: future audits must use RC lock-chain semantic helper, not generic raw hash."""
    resolution = lock_chain_semantic_integrity_resolution()
    assert resolution["lock_chain_semantic_integrity"] is True
    assert resolution["raw_file_hash_is_lock_authority"] is False
    assert resolution["generic_raw_file_hashing_is_not_rc_lock_semantic_contract"] is True

    for rc_id in (RC001, RC002):
        lock_path = R3N_OUT / f"{rc_id}.LOCKED_NOT_RUN.json"
        body = json.loads(lock_path.read_text(encoding="utf-8"))
        lock_chain_sem = compute_rc_semantic_body_sha256(body)
        generic_sem = semantic_json_hash(body)
        row = resolution["rcs"][rc_id]
        assert row["lock_chain_semantic_sha256"] == lock_chain_sem
        assert row["semantic_matches_attempt_parent"] is True
        assert row["generic_semantic_equals_lock_chain_semantic"] == (generic_sem == lock_chain_sem)
        assert row["raw_file_hash_is_lock_authority"] is False

    src = (
        REPO
        / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
        / "mai07_r3n_integrity_closure.py"
    ).read_text(encoding="utf-8")
    assert "compute_rc_semantic_body_sha256" in src
    finalize_src = (
        REPO
        / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
        / "mai07_r3n_integrity_closure_finalize.py"
    ).read_text(encoding="utf-8")
    assert "compute_rc_semantic_body_sha256" in finalize_src
    assert "raw_file_hash_is_lock_authority" in finalize_src


def test_invalidation_sidecar_append_only(closure_artifacts):
    side = _load("HISTORICAL_INVALIDATION_SIDECAR.json")
    assert side["original_lock_body_mutated"] is False
    assert side["original_attempt_bodies_mutated"] is False
    assert side["original_prediction_files_mutated"] is False
    assert side.get("lock_chain_semantic_integrity") is True
    assert side.get("raw_file_hash_is_lock_authority") is False
    beside = R3N_OUT / f"{RC002}.HISTORICAL_INVALIDATION_SIDECAR.json"
    assert beside.is_file()
    assert (R3N_OUT / f"{RC002}.LOCKED_NOT_RUN.json").is_file()
    lock_body = json.loads((R3N_OUT / f"{RC002}.LOCKED_NOT_RUN.json").read_text(encoding="utf-8"))
    assert side["target_lock_semantic_sha256"] == compute_rc_semantic_body_sha256(lock_body)


def test_r3n2_protocol_spec_only(closure_artifacts):
    proto = _load("R3N2_FRESH_HOLDOUT_PROTOCOL.json")
    assert proto["execute_in_this_phase"] is False
    assert proto["status"] == "SPECIFICATION_ONLY_NOT_EXECUTED"
    mins = proto["minimum_required_holdout_coverage_locked_before_execution"]
    assert mins["decisive_english_identity"] == 200
    assert mins["independent_analogue_ACRONYM_OR_IDENTIFIER_PROTECTION"] == 75


def test_hardening_rejectors():
    with pytest.raises(ValueError, match="same_holdout"):
        reject_same_holdout_after_runtime_change(
            holdout_sha_a="a",
            holdout_sha_b="a",
            runtime_changed=True,
            case_overlap=8,
            family_overlap=8,
            case_union=8,
        )
    with pytest.raises(ValueError, match="required_population"):
        reject_required_to_not_applicable("INVALID_REQUIRED_POPULATION", "NOT_APPLICABLE")
    with pytest.raises(ValueError, match="candidate_version"):
        reject_candidate_version_reuse(
            version_a=CANDIDATE_RUNTIME_VERSION,
            version_b=CANDIDATE_RUNTIME_VERSION,
            runtime_changed=True,
        )
    with pytest.raises(ValueError, match="lock_missing"):
        reject_lock_missing_bindings({"threshold_manifest_sha256": "x"})


def test_lock_before_execution_and_consumed_attempts(closure_artifacts):
    tl = _load("ATTEMPT_TIMELINE.json")
    assert tl["lock_before_attempt001"] and tl["lock_before_attempt002"]
    a1 = json.loads((R3N_OUT / f"{ATTEMPT001}.json").read_text(encoding="utf-8"))
    a2 = json.loads((R3N_OUT / f"{ATTEMPT002}.json").read_text(encoding="utf-8"))
    assert a1["prohibited_rerun"] is True and a2["prohibited_rerun"] is True
    assert a1["predictions_jsonl_raw_sha256"] != a2["predictions_jsonl_raw_sha256"]
    assert "predictions_canonical_list_sha256" in a2


def test_historical_artifact_immutability(closure_artifacts):
    a1_path = R3N_OUT / f"{ATTEMPT001}.json"
    a2_path = R3N_OUT / f"{ATTEMPT002}.json"
    lock1 = R3N_OUT / f"{RC001}.LOCKED_NOT_RUN.json"
    lock2 = R3N_OUT / f"{RC002}.LOCKED_NOT_RUN.json"
    before = {p.name: sha256_file(p) for p in (a1_path, a2_path, lock1, lock2)}
    _ = lock_chain_semantic_integrity_resolution()
    after = {p.name: sha256_file(p) for p in (a1_path, a2_path, lock1, lock2)}
    assert before == after
    imm = _load("IMMUTABILITY_REPORT.json")
    assert imm["attempt_bodies_unchanged_by_this_phase"] is True
    assert imm["lock_bodies_unchanged_by_this_phase"] is True
    assert imm["lock_chain_semantic_integrity"] is True


def test_no_runtime_rerun_active_immutable(closure_artifacts):
    assert_active_default_immutable()
    assert RUNTIME_VERSION == "mai-07.1.13-r3s-active"
    assert ENABLE_PROMOTION_OVERLAY is False
    imm = _load("IMMUTABILITY_REPORT.json")
    assert imm["no_prediction_rerun"] is True
    assert imm["active_ok"] is True


def test_governance_flags_and_mai08(closure_artifacts):
    decision = _load("RC_002_VALIDITY_DECISION.json")
    assert decision["QUALITY_GATES_PASSED"] is False
    assert decision["LINGUIST_APPROVED"] is False
    assert decision["PRODUCTION_APPROVED"] is False
    assert decision["MAI-08"] == "NOT_STARTED"
    assert decision["MAI-07"] == "NEEDS_CORRECTIVE_WORK"


def test_reconstruct_attempt001_deterministic():
    rows = [
        json.loads(ln)
        for ln in (R3N_OUT / "holdout_validation.jsonl").read_text(encoding="utf-8").splitlines()
        if ln.strip()
    ]
    a = reconstruct_attempt001_holdout(rows)
    b = reconstruct_attempt001_holdout(rows)
    assert sha256_bytes(_jsonl_bytes(a)) == sha256_bytes(_jsonl_bytes(b)) == EXPECTED_RC001_HOLDOUT_SHA


def test_forensic_dual_build_determinism():
    reuse = holdout_reuse_audit()
    gates = gate_semantics_audit()
    runtime = runtime_semantic_diff()
    dens = denominator_adequacy_audit()
    d1 = validity_decision(reuse=reuse, gates=gates, runtime=runtime, dens=dens)
    d2 = validity_decision(reuse=reuse, gates=gates, runtime=runtime, dens=dens)
    assert d1 == d2
    assert d1["primary_verdict"] == "INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED"


def test_check_mode_does_not_require_write(monkeypatch):
    monkeypatch.delenv("MAI07_AUTHORIZE_EVAL_WRITE", raising=False)
    result = run_closure(write=False)
    assert result["verdict"] == "INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED"


def test_snapshot_includes_source_and_pack():
    snap = snapshot_forensics()
    assert "source:candidate_runtime" in snap["files"]
    assert "source:scoring_contracts" in snap["files"]
    assert snap["files"].get("candidate_pack", {}).get("version") == CANDIDATE_RUNTIME_VERSION


def test_no_frozen_review_path_imports():
    src = (
        REPO
        / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
        / "mai07_r3n_integrity_closure.py"
    ).read_text(encoding="utf-8")
    assert "docs/mokxya-ai/reviews" not in src
    assert "mai07_v2_failure" not in src
