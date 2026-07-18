from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import pytest

from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n6_output_binding import (
    JSON_KIND,
    JSONL_KIND,
    build_output_binding_manifest,
    verify_complete_r3n6_chain,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.rc_lock_chain import (
    build_locked_rc,
    compute_rc_semantic_body_sha256,
    create_lock_record,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
    predictions_canonical_list_sha256,
    sha256_file,
)


RC_ID = "MAI-07R3N6-ADVERSARIAL-RC"
ATTEMPT_ID = "MAI-07R3N6-ADVERSARIAL-ATTEMPT-001"
SPLIT = "HOLDOUT_VALIDATION"
SCORER_VERSION = "mai-07-r3n6.scorer.test.1"
RUNTIME_VERSION = "mai-07.1.11-r3n6-chaincomplete-test"
CANONICAL_SCORER_ID = "mai-07-r3n6-canonical-test"
AUDIT_SCORER_ID = "mai-07-r3n6-audit-test"
COMMAND = "python -m eval_mai07_r3n6 --one-shot"
METRIC_ID = "split_expected_pass"
GATE_ID = "all_cases_pass"


def _write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _write_jsonl(path: Path, values: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(
            json.dumps(value, ensure_ascii=False, sort_keys=True) + "\n"
            for value in values
        ),
        encoding="utf-8",
        newline="\n",
    )


def _load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def _recompute_fixture_reports(
    cases: list[dict[str, Any]],
    canonical_observations: list[dict[str, Any]],
    audit_observations: list[dict[str, Any]],
    thresholds: dict[str, Any],
    split: str,
) -> dict[str, Any]:
    del thresholds
    quality_pass = bool(canonical_observations) and all(
        row.get("passed") is True for row in canonical_observations
    )
    count = len(cases)
    metric = {
        "numerator": count,
        "denominator": count,
        "scorer_version": SCORER_VERSION,
    }
    gate = {
        "pass": quality_pass,
        "outcome": "PASS" if quality_pass else "FAIL",
    }

    def scorer(scorer_id: str, observations: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "scorer_id": scorer_id,
            "scorer_version": SCORER_VERSION,
            "split": split,
            "metrics": {METRIC_ID: metric},
            "gates": {GATE_ID: gate},
            "ok": quality_pass,
            "failed_gates": [] if quality_pass else [GATE_ID],
            "observations": observations,
        }

    return {
        "canonical": scorer(CANONICAL_SCORER_ID, canonical_observations),
        "audit": scorer(AUDIT_SCORER_ID, audit_observations),
        "agreement": {"ok": True},
        "case_agreement": {"ok": True},
    }


def _validate_fixture_observation(
    case: dict[str, Any], observation: dict[str, Any], side: str
) -> list[str]:
    del side
    expected_keys = {
        "case_id",
        "expected_behavior",
        "populations",
        "expected_output",
        "actual_output",
        "passed",
    }
    errors: list[str] = []
    if set(observation) != expected_keys:
        errors.append("keyset")
    if observation.get("case_id") != case.get("case_id"):
        errors.append("case_id")
    if type(observation.get("passed")) is not bool:
        errors.append("passed_type")
    return errors


@dataclass(frozen=True)
class CompleteChainFixture:
    repo: Path
    chain: dict[str, Any]
    expected_paths: dict[str, str]
    expected_artifacts: dict[str, tuple[str, str]]
    paths: dict[str, Path]
    expected_snapshot: dict[str, Any]
    expected_cases_by_split: dict[str, list[dict[str, Any]]]

    def verify(self) -> dict[str, Any]:
        return verify_complete_r3n6_chain(
            self.chain,
            repo=self.repo,
            expected_rc_id=RC_ID,
            expected_attempt_id=ATTEMPT_ID,
            expected_paths=self.expected_paths,
            expected_artifacts=self.expected_artifacts,
            expected_scorer_version=SCORER_VERSION,
            expected_runtime_version=RUNTIME_VERSION,
            expected_canonical_scorer_id=CANONICAL_SCORER_ID,
            expected_audit_scorer_id=AUDIT_SCORER_ID,
            expected_splits=(SPLIT,),
            expected_split_files={SPLIT: self.paths["dataset"].relative_to(self.repo).as_posix()},
            expected_cases_by_split=self.expected_cases_by_split,
            expected_dataset_manifest_path=self.paths["dataset_manifest"].relative_to(self.repo).as_posix(),
            expected_required_metrics={METRIC_ID},
            expected_required_gates={GATE_ID},
            expected_command=COMMAND,
            expected_locked_input_snapshot=self.expected_snapshot,
            report_recomputer=_recompute_fixture_reports,
            observation_validator=_validate_fixture_observation,
        )


def _build_complete_chain(
    repo: Path,
    *,
    quality_pass: bool = True,
    case_count: int = 1,
) -> CompleteChainFixture:
    evidence = repo / "evidence"
    dataset_dir = repo / "dataset"
    paths = {
        "lock": evidence / "locked.json",
        "lock_record": evidence / "lock_record.json",
        "intent": evidence / "attempt_intent.json",
        "attempt": evidence / "attempt_result.json",
        "qualification": evidence / "qualification.json",
        "report": evidence / "holdout_validation_score_report.json",
        "predictions": evidence / "holdout_validation_predictions.jsonl",
        "output_manifest": evidence / "output_binding.json",
        "dataset": dataset_dir / "holdout_validation.jsonl",
        "dataset_manifest": dataset_dir / "manifest.json",
    }

    cases = [
        {
            "case_id": f"case-{index + 1:03d}",
            "split": SPLIT,
            "input_text": f"account-{index + 1}",
            "expected_behavior": "IDENTITY",
            "populations": ["english_identity"],
        }
        for index in range(case_count)
    ]
    _write_jsonl(paths["dataset"], cases)
    dataset_manifest = {
        "schema_version": "mai07_r3n6_dataset_manifest_test_v1",
        "splits": {
            SPLIT: {
                "filename": paths["dataset"].name,
                "count": len(cases),
                "sha256": sha256_file(paths["dataset"]),
            }
        },
    }
    _write_json(paths["dataset_manifest"], dataset_manifest)

    lock_body = {
        "schema_version": "2.0.0",
        "manifest_id": RC_ID,
        "candidate_runtime_version": RUNTIME_VERSION,
        "scorer_version": SCORER_VERSION,
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "ENABLE_PROMOTION_OVERLAY": False,
        "dataset_manifest": dataset_manifest,
        "dataset_manifest_sha256": sha256_file(paths["dataset_manifest"]),
    }
    build_locked_rc(lock_body, output_path=paths["lock"])
    locked = _load_json(paths["lock"])
    lock_semantic = compute_rc_semantic_body_sha256(locked)
    lock_raw = sha256_file(paths["lock"])
    lock_record = create_lock_record(
        rc_id=RC_ID,
        locked_path=paths["lock"],
        locked_body=locked,
    )
    _write_json(paths["lock_record"], lock_record)
    lock_record_raw = sha256_file(paths["lock_record"])

    snapshot = {
        "dataset_manifest_sha256": sha256_file(paths["dataset_manifest"]),
        "source_hashes": {"r3n6_output_binding.py": "a" * 64},
    }
    intent = {
        "schema_version": "2.0.0",
        "record_type": "HOLDOUT_ATTEMPT_INTENT",
        "attempt_id": ATTEMPT_ID,
        "rc_id": RC_ID,
        "parent_lock_semantic_sha256": lock_semantic,
        "parent_lock_raw_sha256": lock_raw,
        "split": SPLIT,
        "command": COMMAND,
        "status": "LOCKED_NOT_RUN",
        "all_splits": [SPLIT],
        "complete_output_binding_required": True,
        "prohibited_rerun": True,
        "claim_created_exclusively": True,
        "lock_record_path": paths["lock_record"].relative_to(repo).as_posix(),
        "lock_record_raw_sha256": lock_record_raw,
        "locked_input_snapshot": snapshot,
    }
    _write_json(paths["intent"], intent)
    intent_raw = sha256_file(paths["intent"])

    observations = [
        {
            "case_id": case["case_id"],
            "expected_behavior": case["expected_behavior"],
            "populations": case["populations"],
            "expected_output": case["input_text"],
            "actual_output": case["input_text"],
            "passed": quality_pass,
        }
        for case in cases
    ]
    metric = {
        "numerator": case_count,
        "denominator": case_count,
        "scorer_version": SCORER_VERSION,
    }
    gate = {
        "pass": quality_pass,
        "outcome": "PASS" if quality_pass else "FAIL",
    }

    def scorer(scorer_id: str) -> dict[str, Any]:
        return {
            "scorer_id": scorer_id,
            "scorer_version": SCORER_VERSION,
            "split": SPLIT,
            "metrics": {METRIC_ID: metric},
            "gates": {GATE_ID: gate},
            "ok": quality_pass,
            "failed_gates": [] if quality_pass else [GATE_ID],
            "observations": observations,
        }

    report = {
        "schema_version": "mai07_r3n6_score_report_test_v1",
        "phase": "MAI-07R3N6",
        "split": SPLIT,
        "case_count": case_count,
        "canonical": scorer(CANONICAL_SCORER_ID),
        "audit": scorer(AUDIT_SCORER_ID),
        "agreement": {"ok": True},
        "case_agreement": {"ok": True},
        "split_expected_pass": True,
        "audit_observations_persisted": True,
        "ok": quality_pass,
    }
    _write_json(paths["report"], report)
    predictions = [
        {
            **observation,
            "runtime": RUNTIME_VERSION,
            "scorer_version": SCORER_VERSION,
            "split": SPLIT,
        }
        for observation in observations
    ]
    _write_jsonl(paths["predictions"], predictions)

    verdict = (
        "PASSED_FRESH_HOLDOUT_CORRECTIVE_RC"
        if quality_pass
        else "FAILED_HOLDOUT_QUALITY"
    )
    split_results = {SPLIT: quality_pass}
    prediction_semantic = predictions_canonical_list_sha256(predictions)
    attempt = {
        "schema_version": "2.0.0",
        "record_type": "HOLDOUT_ATTEMPT_PROVISIONAL_RESULT",
        "attempt_id": ATTEMPT_ID,
        "rc_id": RC_ID,
        "parent_lock_semantic_sha256": lock_semantic,
        "parent_lock_raw_sha256": lock_raw,
        "split": SPLIT,
        "command": COMMAND,
        "status": "COMPLETED_PENDING_CHAIN_BINDING",
        "all_splits": [SPLIT],
        "complete_output_binding_required": True,
        "prohibited_rerun": True,
        "attempt_intent_path": paths["intent"].relative_to(repo).as_posix(),
        "attempt_intent_raw_sha256": intent_raw,
        "engineering_verdict": "PENDING_COMPLETE_CHAIN_BINDING",
        "release_authority": False,
        "all_split_results": split_results,
        "numerical_verdict": verdict,
        "prediction_path": str(paths["predictions"].resolve()),
        "prediction_count": len(predictions),
        "predictions_jsonl_raw_sha256": sha256_file(paths["predictions"]),
        "predictions_canonical_list_sha256": prediction_semantic,
        "predictions_semantic_sha256": prediction_semantic,
        "locked_input_snapshot": snapshot,
    }
    _write_json(paths["attempt"], attempt)
    qualification = {
        "schema_version": "2.0.0",
        "record_type": "PROVISIONAL_QUALIFICATION_RESULT",
        "rc_id": RC_ID,
        "attempt_id": ATTEMPT_ID,
        "split": SPLIT,
        "all_splits": [SPLIT],
        "command": COMMAND,
        "parent_lock_semantic_sha256": lock_semantic,
        "parent_lock_raw_sha256": lock_raw,
        "attempt_intent_path": paths["intent"].relative_to(repo).as_posix(),
        "attempt_intent_raw_sha256": intent_raw,
        "all_split_results": split_results,
        "metrics_summary": report["canonical"]["metrics"],
        "gate_all_pass": quality_pass,
        "status": (
            "PASSED_HOLDOUT_PENDING_CHAIN_BINDING"
            if quality_pass
            else "FAILED_HOLDOUT_QUALITY_PENDING_CHAIN_BINDING"
        ),
        "numerical_verdict": verdict,
        "engineering_verdict": "PENDING_COMPLETE_CHAIN_BINDING",
        "release_authority": False,
        "candidate_promoted": False,
        "QUALITY_GATES_PASSED": False,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "MAI-07": "NEEDS_CORRECTIVE_WORK",
        "MAI-08": "NOT_STARTED",
        "output_binding_manifest_required": True,
        "audit_observations_persisted": True,
        "locked_input_snapshot": snapshot,
    }
    _write_json(paths["qualification"], qualification)

    expected_artifacts = {
        "attempt_intent": (
            paths["intent"].relative_to(repo).as_posix(),
            JSON_KIND,
        ),
        "attempt_result": (
            paths["attempt"].relative_to(repo).as_posix(),
            JSON_KIND,
        ),
        "qualification": (
            paths["qualification"].relative_to(repo).as_posix(),
            JSON_KIND,
        ),
        "holdout_validation_score_report": (
            paths["report"].relative_to(repo).as_posix(),
            JSON_KIND,
        ),
        "holdout_validation_predictions": (
            paths["predictions"].relative_to(repo).as_posix(),
            JSONL_KIND,
        ),
    }
    artifact_paths = {
        name: (repo / relative_path, kind)
        for name, (relative_path, kind) in expected_artifacts.items()
    }
    output_manifest = build_output_binding_manifest(
        repo=repo,
        rc_id=RC_ID,
        attempt_id=ATTEMPT_ID,
        verdict=verdict,
        lock_semantic_sha256=lock_semantic,
        lock_raw_sha256=lock_raw,
        artifacts=artifact_paths,
        required_artifact_names=set(expected_artifacts),
    )
    _write_json(paths["output_manifest"], output_manifest)

    expected_paths = {
        "locked_not_run_path": paths["lock"].relative_to(repo).as_posix(),
        "lock_record_path": paths["lock_record"].relative_to(repo).as_posix(),
        "attempt_intent_path": paths["intent"].relative_to(repo).as_posix(),
        "holdout_attempt_path": paths["attempt"].relative_to(repo).as_posix(),
        "qualification_path": paths["qualification"].relative_to(repo).as_posix(),
        "output_binding_manifest_path": paths["output_manifest"].relative_to(repo).as_posix(),
    }
    chain = {
        "schema_version": "mai07_r3n6_complete_chain_v1",
        "record_type": "COMPLETE_ATTEMPT_CHAIN",
        "rc_id": RC_ID,
        "attempt_id": ATTEMPT_ID,
        "verdict": verdict,
        "consumed": True,
        "attempt_time_output_binding": True,
        "attempt_time_input_reverification": True,
        "engineering_verdict_authority": True,
        "release_authority": "FINAL_COMPLETE_CHAIN_ONLY",
        **expected_paths,
        "locked_semantic_sha256": lock_semantic,
        "locked_raw_sha256": lock_raw,
        "lock_record_raw_sha256": lock_record_raw,
        "output_binding_manifest_raw_sha256": sha256_file(paths["output_manifest"]),
        "output_binding_manifest_semantic_sha256": output_manifest[
            "manifest_semantic_sha256"
        ],
        "locked_input_snapshot": snapshot,
    }
    return CompleteChainFixture(
        repo=repo,
        chain=chain,
        expected_paths=expected_paths,
        expected_artifacts=expected_artifacts,
        paths=paths,
        expected_snapshot=snapshot,
        expected_cases_by_split={SPLIT: list(cases)},
    )


def _assert_rejected(fixture: CompleteChainFixture, expected_error: str) -> None:
    verified = fixture.verify()
    assert verified["ok"] is False, verified
    assert expected_error in verified["errors"], verified


def test_complete_chain_fixture_is_valid(tmp_path: Path):
    fixture = _build_complete_chain(tmp_path)

    verified = fixture.verify()

    assert verified == {
        "ok": True,
        "errors": [],
        "derived_verdict": "PASSED_FRESH_HOLDOUT_CORRECTIVE_RC",
        "split_results": {SPLIT: True},
    }


@pytest.mark.parametrize(
    ("mutate", "expected_error"),
    [
        (lambda fixture: fixture.chain.__setitem__("rc_id", "SELF-AUTHORED-RC"), "chain_rc_id_mismatch"),
        (lambda fixture: fixture.chain.__setitem__("attempt_id", "SELF-AUTHORED-ATTEMPT"), "chain_attempt_id_mismatch"),
        (
            lambda fixture: fixture.chain.__setitem__("holdout_attempt_path", "evidence/other-attempt.json"),
            "chain_fixed_path_mismatch:holdout_attempt_path",
        ),
    ],
    ids=("rc", "attempt", "fixed-path"),
)
def test_chain_cannot_redefine_fixed_authority(
    tmp_path: Path,
    mutate: Callable[[CompleteChainFixture], None],
    expected_error: str,
):
    fixture = _build_complete_chain(tmp_path)
    mutate(fixture)

    _assert_rejected(fixture, expected_error)


def test_lock_record_tamper_is_rejected(tmp_path: Path):
    fixture = _build_complete_chain(tmp_path)
    lock_record = _load_json(fixture.paths["lock_record"])
    lock_record["rc_id"] = "SELF-AUTHORED-RC"
    _write_json(fixture.paths["lock_record"], lock_record)

    _assert_rejected(fixture, "lock_record_rc_id_mismatch")
    assert "chain_lock_record_raw_mismatch" in fixture.verify()["errors"]


def test_aliased_artifact_paths_are_rejected(tmp_path: Path):
    fixture = _build_complete_chain(tmp_path)
    manifest = _load_json(fixture.paths["output_manifest"])
    manifest["artifacts"]["attempt_result"]["path"] = manifest["artifacts"][
        "attempt_intent"
    ]["path"]
    _write_json(fixture.paths["output_manifest"], manifest)

    _assert_rejected(fixture, "output_manifest_aliased_artifact_paths")


def test_malformed_primary_prediction_alias_fails_closed_without_exception(
    tmp_path: Path,
):
    fixture = _build_complete_chain(tmp_path)
    manifest = _load_json(fixture.paths["output_manifest"])
    manifest["artifacts"]["holdout_validation_predictions"]["path"] = (
        manifest["artifacts"]["holdout_validation_score_report"]["path"]
    )
    _write_json(fixture.paths["output_manifest"], manifest)

    verified = fixture.verify()

    assert verified["ok"] is False, verified
    assert "output_manifest_aliased_artifact_paths" in verified["errors"]
    assert any(
        error.startswith("primary_prediction_unreadable:")
        for error in verified["errors"]
    )


def test_empty_zero_case_split_is_rejected_even_when_internally_declared_zero(
    tmp_path: Path,
):
    fixture = _build_complete_chain(tmp_path, case_count=0)

    verified = fixture.verify()

    assert verified["ok"] is False, verified
    assert f"dataset_split_empty:{SPLIT}" in verified["errors"]
    assert f"report_case_count_mismatch:{SPLIT}" in verified["errors"]


def test_wrong_report_split_is_rejected(tmp_path: Path):
    fixture = _build_complete_chain(tmp_path)
    report = _load_json(fixture.paths["report"])
    report["split"] = "SAFETY_INVARIANTS"
    _write_json(fixture.paths["report"], report)

    _assert_rejected(fixture, f"report_split_mismatch:{SPLIT}")


def test_self_authored_gate_outcome_is_rejected_by_report_recomputation(
    tmp_path: Path,
):
    fixture = _build_complete_chain(tmp_path)
    report = _load_json(fixture.paths["report"])
    report["canonical"]["gates"][GATE_ID] = {
        "pass": False,
        "outcome": "FAIL",
    }
    report["canonical"]["ok"] = False
    report["canonical"]["failed_gates"] = [GATE_ID]
    _write_json(fixture.paths["report"], report)

    _assert_rejected(
        fixture, f"report_canonical_not_recomputed:{SPLIT}"
    )


def test_self_authored_agreement_payload_is_rejected_by_recomputation(
    tmp_path: Path,
):
    fixture = _build_complete_chain(tmp_path)
    report = _load_json(fixture.paths["report"])
    report["agreement"] = {"ok": True, "mismatches": ["hidden-drift"]}
    _write_json(fixture.paths["report"], report)

    _assert_rejected(
        fixture, f"report_agreement_not_recomputed:{SPLIT}"
    )


def test_consistent_but_self_authored_input_snapshot_is_rejected(
    tmp_path: Path,
):
    fixture = _build_complete_chain(tmp_path)
    forged = {"forged": "0" * 64}
    for label in ("intent", "attempt", "qualification"):
        payload = _load_json(fixture.paths[label])
        payload["locked_input_snapshot"] = forged
        _write_json(fixture.paths[label], payload)
    fixture.chain["locked_input_snapshot"] = forged

    _assert_rejected(
        fixture, "intent_locked_input_snapshot_not_authoritative"
    )


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("runtime", "self-authored-runtime"),
        ("scorer_version", "self-authored-scorer"),
        ("case_id", "self-authored-case"),
    ],
)
def test_wrong_prediction_identity_is_rejected(
    tmp_path: Path,
    field: str,
    value: str,
):
    fixture = _build_complete_chain(tmp_path)
    prediction = json.loads(
        fixture.paths["predictions"].read_text(encoding="utf-8").splitlines()[0]
    )
    prediction[field] = value
    _write_jsonl(fixture.paths["predictions"], [prediction])

    _assert_rejected(fixture, f"prediction_projection_mismatch:{SPLIT}")


def test_wrong_prediction_count_is_rejected(tmp_path: Path):
    fixture = _build_complete_chain(tmp_path)
    prediction = json.loads(
        fixture.paths["predictions"].read_text(encoding="utf-8").splitlines()[0]
    )
    _write_jsonl(fixture.paths["predictions"], [prediction, prediction])

    verified = fixture.verify()

    assert verified["ok"] is False, verified
    assert f"prediction_projection_mismatch:{SPLIT}" in verified["errors"]
    assert "attempt_prediction_count_mismatch" in verified["errors"]


@pytest.mark.parametrize(
    ("artifact_name", "field", "value", "expected_error"),
    [
        (
            "attempt",
            "attempt_intent_raw_sha256",
            "0" * 64,
            "attempt_intent_raw_binding_mismatch",
        ),
        (
            "attempt",
            "attempt_intent_path",
            "evidence/other-intent.json",
            "attempt_intent_path_mismatch",
        ),
        (
            "qualification",
            "attempt_intent_raw_sha256",
            "0" * 64,
            "qualification_intent_raw_mismatch",
        ),
        (
            "qualification",
            "attempt_id",
            "SELF-AUTHORED-ATTEMPT",
            "qualification_attempt_id_mismatch",
        ),
    ],
)
def test_provisional_cross_link_mutations_are_rejected(
    tmp_path: Path,
    artifact_name: str,
    field: str,
    value: str,
    expected_error: str,
):
    fixture = _build_complete_chain(tmp_path)
    artifact = _load_json(fixture.paths[artifact_name])
    artifact[field] = value
    _write_json(fixture.paths[artifact_name], artifact)

    _assert_rejected(fixture, expected_error)


def test_unknown_chain_verdict_is_rejected(tmp_path: Path):
    fixture = _build_complete_chain(tmp_path)
    fixture.chain["verdict"] = "PROVISIONAL_SELF_AUTHORED_PASS"

    _assert_rejected(fixture, "chain_unknown_verdict")


def test_structurally_valid_quality_failure_chain_is_accepted(tmp_path: Path):
    fixture = _build_complete_chain(tmp_path, quality_pass=False)

    verified = fixture.verify()

    assert verified == {
        "ok": True,
        "errors": [],
        "derived_verdict": "FAILED_HOLDOUT_QUALITY",
        "split_results": {SPLIT: False},
    }
