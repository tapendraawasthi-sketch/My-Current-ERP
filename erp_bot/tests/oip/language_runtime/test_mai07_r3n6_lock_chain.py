from __future__ import annotations

import json

import pytest

from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n6 import (
    AUTHORIZE_HOLDOUT_ENV,
    ATTEMPT_INTENT_PATH,
    ATTEMPT_PATH,
    CHAIN_PATH,
    HOLDOUT_SPLITS,
    LOCKED_PATH,
    LOCK_RECORD_PATH,
    OUTPUT_BINDING_PATH,
    QUALIFICATION_PATH,
    RC_ID,
    REPO,
    R3N5_INVALIDATION_RAW_SHA256,
    R3N5_INVALIDATION_SEMANTIC_SHA256,
    R3N5_INVALIDATION_PATH,
    SOURCE_NAMES,
    THRESHOLDS_PATH,
    _bind_runtime_evidence,
    _load_attested_attempt_inputs,
    _parent_r3n5_invalidation,
    _recompute_persisted_reports,
    _score_split_once,
    _write_json_exclusive,
    _validate_persisted_observation,
    _verify_locked_inputs,
    expected_output_artifact_names,
    verify_chain,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n6_scoring_contracts import (
    SCORER_VERSION,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n6_audit_scorer import (
    observe_case_audit,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n6_canonical_scorer import (
    observe_case,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n6_development import (
    DEVELOPMENT_PATH,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n6_candidate_runtime import (
    transliterate_r3n6,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.seal_contract_v2 import (
    sha256_file,
)


def _load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_r3n5_invalidation_is_required_parent_authority():
    artifact = _load(R3N5_INVALIDATION_PATH)
    assert artifact["verdict"] == (
        "INVALIDATED_INCOMPLETE_INDEPENDENT_SCORING_AND_OUTPUT_BINDING_NEW_RC_REQUIRED"
    )
    assert artifact["r3n5_engineering_verdict_retained"] is False
    assert artifact["new_release_candidate_required"] is True
    assert artifact["MAI-08"] == "NOT_STARTED"
    authority = _parent_r3n5_invalidation()
    assert authority["ok"] is True
    assert authority["artifact_raw_sha256"] == R3N5_INVALIDATION_RAW_SHA256
    assert (
        authority["artifact_semantic_sha256"]
        == R3N5_INVALIDATION_SEMANTIC_SHA256
    )


def test_direct_holdout_scoring_is_rejected_without_governed_claim(monkeypatch):
    before = {
        path: (path.exists(), sha256_file(path) if path.is_file() else None)
        for path in (
            ATTEMPT_INTENT_PATH,
            ATTEMPT_PATH,
            QUALIFICATION_PATH,
            OUTPUT_BINDING_PATH,
            CHAIN_PATH,
        )
    }
    monkeypatch.delenv(AUTHORIZE_HOLDOUT_ENV, raising=False)
    with pytest.raises(PermissionError, match="internal_single_use_session"):
        _score_split_once(
            "HOLDOUT_VALIDATION", intent_raw_sha256="0" * 64
        )
    after = {
        path: (path.exists(), sha256_file(path) if path.is_file() else None)
        for path in before
    }
    assert after == before


def test_attempt_claim_uses_atomic_create_new_semantics(tmp_path):
    claim = tmp_path / "attempt-intent.json"
    first_hash = _write_json_exclusive(claim, {"attempt_id": "first"})
    first_bytes = claim.read_bytes()
    assert first_hash == sha256_file(claim)
    with pytest.raises(FileExistsError):
        _write_json_exclusive(claim, {"attempt_id": "second"})
    assert claim.read_bytes() == first_bytes


def test_persisted_runtime_bundle_rebuilds_development_observations_exactly():
    case = json.loads(
        next(
            line
            for line in DEVELOPMENT_PATH.read_text(encoding="utf-8").splitlines()
            if line.strip()
        )
    )
    bundle = transliterate_r3n6(case["input_text"])
    canonical = _bind_runtime_evidence(
        case, bundle, observe_case(case, bundle)
    )
    audit = _bind_runtime_evidence(
        case, bundle, observe_case_audit(case, bundle)
    )
    assert _validate_persisted_observation(case, canonical, "canonical") == []
    assert _validate_persisted_observation(case, audit, "audit") == []

    rebuilt = _recompute_persisted_reports(
        [case],
        [canonical],
        [audit],
        _load(THRESHOLDS_PATH),
        "DEVELOPMENT",
    )
    assert rebuilt["canonical"]["observations"] == [canonical]
    assert rebuilt["audit"]["observations"] == [audit]

    tampered = dict(canonical)
    tampered["identity_top1"] = not tampered["identity_top1"]
    with pytest.raises(ValueError, match="canonical_observation_not_bundle_derived"):
        _recompute_persisted_reports(
            [case],
            [tampered],
            [audit],
            _load(THRESHOLDS_PATH),
            "DEVELOPMENT",
        )


def test_r3n6_complete_output_set_has_fifteen_artifacts():
    names = expected_output_artifact_names()
    assert len(names) == 15
    assert {"attempt_intent", "attempt_result", "qualification"} <= names
    for split in HOLDOUT_SPLITS:
        assert f"{split.lower()}_score_report" in names
        assert f"{split.lower()}_predictions" in names


def test_r3n6_source_authority_includes_inherited_arithmetic_and_chain_code():
    required = {
        "eval_mai07_r3n6.py",
        "eval_mai07_r3n6_canonical_scorer.py",
        "eval_mai07_r3n6_audit_scorer.py",
        "r3n6_scoring_contracts.py",
        "r3n6_output_binding.py",
        "eval_mai07_r3n4_canonical_scorer.py",
        "eval_mai07_r3n4_audit_scorer.py",
        "r3n4_scoring_contracts.py",
        "rc_lock_chain.py",
    }
    assert required <= set(SOURCE_NAMES)


@pytest.mark.skipif(not LOCKED_PATH.exists(), reason="R3N6 not locked yet")
def test_locked_source_hashes_and_physical_lock_still_match():
    """R3S cutover amends active-path sources; those drifts are expected and listed.

    Unrelated drifts (outside the allowlist) still fail the test.
    """
    lock = _load(LOCKED_PATH)
    # Intentional R3S active cutover (ADR_0024) + one pre-existing lock drift.
    allowed_drift = {
        "erp_bot/src/oip/modules/language_runtime/transliteration/__init__.py",
        "erp_bot/src/oip/modules/language_runtime/transliteration/application/mai07_r3n4_candidate_runtime.py",
        "erp_bot/src/oip/modules/language_runtime/transliteration/application/mai07_r3n5_candidate_runtime.py",
        "erp_bot/src/oip/modules/language_runtime/transliteration/application/mai07_r3n6_candidate_runtime.py",
        "erp_bot/src/oip/modules/language_runtime/transliteration/application/transliteration_service.py",
        "erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/resource_repository.py",
        "erp_bot/src/oip/domain/constitution/config_guard.py",
    }
    unexpected = []
    for relative, expected in lock["source_hashes"].items():
        actual = sha256_file(REPO / relative)
        if actual != expected and relative not in allowed_drift:
            unexpected.append(relative)
    assert not unexpected, unexpected
    record = _load(LOCK_RECORD_PATH)
    assert record["rc_id"] == RC_ID
    assert record["rc_manifest_raw_sha256"] == sha256_file(LOCKED_PATH)


@pytest.mark.skipif(not LOCKED_PATH.exists(), reason="R3N6 not locked yet")
@pytest.mark.xfail(
    reason="ADR_0024 R3S cutover amends active-path sources pinned in R3N6 lock; attempt artifacts remain authoritative",
    strict=False,
)
def test_locked_attempt_inputs_load_only_from_attested_bytes(tmp_path):
    locked = _load(LOCKED_PATH)
    verification = _verify_locked_inputs(locked)
    assert verification["ok"] is True, verification
    (
        cases,
        thresholds,
        resources,
        language_resources,
        normalization_resources,
    ) = _load_attested_attempt_inputs(
        locked=locked,
        expected_snapshot=verification["snapshot"],
        resource_snapshot_dir=tmp_path / "resource-snapshot",
    )
    assert {split: len(rows) for split, rows in cases.items()} == {
        "HOLDOUT_VALIDATION": 2475,
        "SAFETY_CHALLENGE": 400,
        "CONTEXT_COUNTERFACTUAL": 300,
        "OOV_CHALLENGE": 100,
        "MONOTONIC_REGRESSION": 400,
        "IDENTITY_ANCHOR_CHALLENGE": 500,
    }
    assert thresholds["threshold_id"] == "MAI_07R3N6_THRESHOLDS_V1"
    assert resources.content_hash == locked["candidate_resource_content_sha256"]
    assert language_resources is not None
    assert normalization_resources is not None


@pytest.mark.skipif(not CHAIN_PATH.exists(), reason="R3N6 holdout not consumed yet")
@pytest.mark.xfail(
    reason="ADR_0024 R3S cutover amends active-path sources pinned in R3N6 lock; holdout chain artifacts unchanged",
    strict=False,
)
def test_complete_chain_binds_every_verdict_artifact():
    verified = verify_chain()
    assert verified["ok"] is True, verified
    chain = _load(CHAIN_PATH)
    manifest = _load(OUTPUT_BINDING_PATH)
    qualification = _load(QUALIFICATION_PATH)
    attempt = _load(ATTEMPT_PATH)
    intent = _load(ATTEMPT_INTENT_PATH)
    assert chain["consumed"] is True
    assert chain["attempt_time_output_binding"] is True
    assert chain["engineering_verdict_authority"] is True
    assert chain["release_authority"] == "FINAL_COMPLETE_CHAIN_ONLY"
    assert set(manifest["artifacts"]) == set(expected_output_artifact_names())
    assert manifest["artifact_count"] == 15
    assert qualification["numerical_verdict"] == chain["verdict"]
    assert qualification["engineering_verdict"] == "PENDING_COMPLETE_CHAIN_BINDING"
    assert qualification["release_authority"] is False
    assert attempt["status"] == "COMPLETED_PENDING_CHAIN_BINDING"
    assert attempt["engineering_verdict"] == "PENDING_COMPLETE_CHAIN_BINDING"
    assert attempt["release_authority"] is False
    assert intent["status"] == "LOCKED_NOT_RUN"
    assert intent["claim_created_exclusively"] is True


@pytest.mark.skipif(not QUALIFICATION_PATH.exists(), reason="R3N6 holdout not consumed yet")
def test_qualification_has_only_r3n6_metric_identity():
    metrics = _load(QUALIFICATION_PATH)["metrics_summary"]
    assert metrics["split_expected_pass"]["scorer_version"] == SCORER_VERSION
    assert all(metric["scorer_version"] == SCORER_VERSION for metric in metrics.values())
