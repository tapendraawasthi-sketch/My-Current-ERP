"""Complete attempt-time output binding for MAI-07R3N6.

The R3N6 chain binds every verdict-bearing post-lock artifact through one
immutable output manifest.  This module does not run the candidate or score any
case; it only creates and verifies typed raw/semantic hash commitments.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable, Mapping

from ..infrastructure.seal_contract_v2 import (
    predictions_canonical_list_sha256,
    semantic_json_hash,
    sha256_file,
)
from .rc_lock_chain import compute_rc_semantic_body_sha256, verify_locked_rc

SCHEMA_VERSION = "mai07_r3n6_output_binding_v1"
CHAIN_SCHEMA_VERSION = "mai07_r3n6_complete_chain_v1"
JSON_KIND = "JSON"
JSONL_KIND = "JSONL"
ALLOWED_KINDS = frozenset({JSON_KIND, JSONL_KIND})


class R3N6OutputBindingError(RuntimeError):
    """Raised when an R3N6 output commitment is incomplete or inconsistent."""


def _relative(repo: Path, path: Path) -> str:
    try:
        return path.resolve().relative_to(repo.resolve()).as_posix()
    except ValueError as exc:
        raise R3N6OutputBindingError(f"artifact_outside_repo:{path}") from exc


def _jsonl_rows(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line_number, line in enumerate(
        path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        if not line.strip():
            continue
        row = json.loads(line)
        if not isinstance(row, dict):
            raise R3N6OutputBindingError(
                f"jsonl_row_not_object:{path}:{line_number}"
            )
        rows.append(row)
    return rows


def _artifact_entry(repo: Path, path: Path, kind: str) -> dict[str, Any]:
    if kind not in ALLOWED_KINDS:
        raise R3N6OutputBindingError(f"unsupported_artifact_kind:{kind}")
    if not path.is_file():
        raise R3N6OutputBindingError(f"missing_bound_artifact:{path}")
    if kind == JSON_KIND:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise R3N6OutputBindingError(f"json_artifact_not_object:{path}")
        semantic = semantic_json_hash(payload)
        record_count = 1
    else:
        rows = _jsonl_rows(path)
        semantic = predictions_canonical_list_sha256(rows)
        record_count = len(rows)
    return {
        "path": _relative(repo, path),
        "kind": kind,
        "byte_count": path.stat().st_size,
        "record_count": record_count,
        "raw_sha256": sha256_file(path),
        "semantic_sha256": semantic,
    }


def output_manifest_semantic_sha256(manifest: Mapping[str, Any]) -> str:
    body = {
        key: value
        for key, value in manifest.items()
        if key != "manifest_semantic_sha256"
    }
    return semantic_json_hash(body)


def build_output_binding_manifest(
    *,
    repo: Path,
    rc_id: str,
    attempt_id: str,
    verdict: str,
    lock_semantic_sha256: str,
    lock_raw_sha256: str,
    artifacts: Mapping[str, tuple[Path, str]],
    required_artifact_names: set[str] | frozenset[str],
) -> dict[str, Any]:
    names = set(artifacts)
    required = set(required_artifact_names)
    if names != required:
        missing = sorted(required - names)
        extra = sorted(names - required)
        raise R3N6OutputBindingError(
            f"artifact_name_set_mismatch:missing={missing}:extra={extra}"
        )
    resolved_paths = [path.resolve() for path, _ in artifacts.values()]
    if len(set(resolved_paths)) != len(resolved_paths):
        raise R3N6OutputBindingError("artifact_paths_must_be_unique")
    entries = {
        name: _artifact_entry(repo, path, kind)
        for name, (path, kind) in sorted(artifacts.items())
    }
    manifest: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "record_type": "ATTEMPT_OUTPUT_BINDING_MANIFEST",
        "rc_id": rc_id,
        "attempt_id": attempt_id,
        "verdict": verdict,
        "parent_lock_semantic_sha256": lock_semantic_sha256,
        "parent_lock_raw_sha256": lock_raw_sha256,
        "required_artifact_names": sorted(required),
        "artifacts": entries,
        "artifact_count": len(entries),
        "binding_scope": "ALL_VERDICT_BEARING_POST_LOCK_OUTPUTS",
        "attempt_time_binding": True,
    }
    manifest["manifest_semantic_sha256"] = output_manifest_semantic_sha256(
        manifest
    )
    return manifest


def verify_output_binding_manifest(
    manifest: Mapping[str, Any],
    *,
    repo: Path,
    expected_semantic_sha256: str | None = None,
) -> dict[str, Any]:
    errors: list[str] = []
    if manifest.get("schema_version") != SCHEMA_VERSION:
        errors.append("schema_version_mismatch")
    if manifest.get("attempt_time_binding") is not True:
        errors.append("attempt_time_binding_not_true")
    artifacts = manifest.get("artifacts")
    required = manifest.get("required_artifact_names")
    if not isinstance(artifacts, dict) or not isinstance(required, list):
        errors.append("artifact_contract_malformed")
        artifacts = {}
        required = []
    if set(artifacts) != set(required):
        errors.append("artifact_name_set_mismatch")
    if manifest.get("artifact_count") != len(artifacts):
        errors.append("artifact_count_mismatch")
    semantic = output_manifest_semantic_sha256(manifest)
    if manifest.get("manifest_semantic_sha256") != semantic:
        errors.append("manifest_semantic_field_mismatch")
    if expected_semantic_sha256 and semantic != expected_semantic_sha256:
        errors.append("manifest_semantic_chain_mismatch")
    for name, recorded in sorted(artifacts.items()):
        if not isinstance(recorded, dict):
            errors.append(f"artifact_entry_not_object:{name}")
            continue
        path_value = recorded.get("path")
        kind = recorded.get("kind")
        if not isinstance(path_value, str) or kind not in ALLOWED_KINDS:
            errors.append(f"artifact_entry_contract:{name}")
            continue
        path = repo / path_value
        try:
            current = _artifact_entry(repo, path, kind)
        except (OSError, ValueError, json.JSONDecodeError, R3N6OutputBindingError) as exc:
            errors.append(f"artifact_unverifiable:{name}:{exc}")
            continue
        for field in (
            "path",
            "kind",
            "byte_count",
            "record_count",
            "raw_sha256",
            "semantic_sha256",
        ):
            if recorded.get(field) != current.get(field):
                errors.append(f"artifact_{field}_mismatch:{name}")
    return {
        "ok": not errors,
        "errors": errors,
        "manifest_semantic_sha256": semantic,
    }


def verify_complete_r3n6_chain(
    chain: Mapping[str, Any],
    *,
    repo: Path,
    expected_rc_id: str,
    expected_attempt_id: str,
    expected_paths: Mapping[str, str],
    expected_artifacts: Mapping[str, tuple[str, str]],
    expected_scorer_version: str,
    expected_runtime_version: str,
    expected_canonical_scorer_id: str,
    expected_audit_scorer_id: str,
    expected_splits: tuple[str, ...],
    expected_split_files: Mapping[str, str],
    expected_cases_by_split: Mapping[str, list[dict[str, Any]]],
    expected_dataset_manifest_path: str,
    expected_required_metrics: set[str] | frozenset[str],
    expected_required_gates: set[str] | frozenset[str],
    expected_command: str,
    expected_locked_input_snapshot: Mapping[str, Any],
    report_recomputer: Callable[
        [
            list[dict[str, Any]],
            list[dict[str, Any]],
            list[dict[str, Any]],
            dict[str, Any],
            str,
        ],
        Mapping[str, Any],
    ],
    observation_validator: Callable[
        [dict[str, Any], dict[str, Any], str], list[str]
    ],
) -> dict[str, Any]:
    """Verify a complete R3N6 attempt against caller-owned authority.

    All identities and paths are supplied by the locked evaluator rather than
    read from the chain under review.  Quality failures are valid evidence;
    malformed/cross-linked evidence is not.
    """

    errors: list[str] = []
    allowed_verdicts = frozenset(
        {"PASSED_FRESH_HOLDOUT_CORRECTIVE_RC", "FAILED_HOLDOUT_QUALITY"}
    )

    def add(error: str) -> None:
        if error not in errors:
            errors.append(error)

    def safe_path(relative: object, label: str) -> Path | None:
        if not isinstance(relative, str) or not relative:
            add(f"invalid_path:{label}")
            return None
        candidate = (repo / relative).resolve()
        try:
            candidate.relative_to(repo.resolve())
        except ValueError:
            add(f"path_outside_repo:{label}")
            return None
        return candidate

    def load_object(path: Path | None, label: str) -> dict[str, Any]:
        if path is None or not path.is_file():
            add(f"missing_{label}")
            return {}
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            add(f"invalid_json:{label}:{exc}")
            return {}
        if not isinstance(value, dict):
            add(f"json_object_required:{label}")
            return {}
        return value

    if chain.get("schema_version") != CHAIN_SCHEMA_VERSION:
        add("chain_schema_mismatch")
    if chain.get("record_type") != "COMPLETE_ATTEMPT_CHAIN":
        add("chain_record_type_mismatch")
    if chain.get("rc_id") != expected_rc_id:
        add("chain_rc_id_mismatch")
    if chain.get("attempt_id") != expected_attempt_id:
        add("chain_attempt_id_mismatch")
    if chain.get("verdict") not in allowed_verdicts:
        add("chain_unknown_verdict")
    if chain.get("consumed") is not True:
        add("chain_consumed_not_true")
    if chain.get("attempt_time_output_binding") is not True:
        add("chain_attempt_time_binding_not_true")
    if chain.get("attempt_time_input_reverification") is not True:
        add("chain_input_reverification_not_true")
    if chain.get("engineering_verdict_authority") is not True:
        add("chain_not_engineering_authority")
    if chain.get("release_authority") != "FINAL_COMPLETE_CHAIN_ONLY":
        add("chain_release_authority_mismatch")
    for field, expected in expected_paths.items():
        if chain.get(field) != expected:
            add(f"chain_fixed_path_mismatch:{field}")

    paths = {
        field: safe_path(expected, field) for field, expected in expected_paths.items()
    }
    lock_path = paths.get("locked_not_run_path")
    lock_record_path = paths.get("lock_record_path")
    intent_path = paths.get("attempt_intent_path")
    attempt_path = paths.get("holdout_attempt_path")
    qualification_path = paths.get("qualification_path")
    manifest_path = paths.get("output_binding_manifest_path")

    lock = load_object(lock_path, "locked_body")
    lock_semantic = compute_rc_semantic_body_sha256(lock) if lock else ""
    lock_raw = sha256_file(lock_path) if lock_path and lock_path.is_file() else ""
    if lock:
        verified_lock = verify_locked_rc(lock, expected_semantic=lock_semantic)
        errors.extend(verified_lock["errors"])
        if lock.get("manifest_id") != expected_rc_id:
            add("locked_rc_id_mismatch")
        if lock.get("candidate_runtime_version") != expected_runtime_version:
            add("locked_runtime_mismatch")
        if lock.get("scorer_version") != expected_scorer_version:
            add("locked_scorer_mismatch")
        if lock.get("schema_version") != "2.0.0":
            add("locked_schema_version_mismatch")
    if chain.get("locked_semantic_sha256") != lock_semantic:
        add("locked_semantic_sha256_mismatch")
    if chain.get("locked_raw_sha256") != lock_raw:
        add("locked_raw_sha256_mismatch")

    lock_record = load_object(lock_record_path, "lock_record")
    if lock_record:
        if lock_record.get("schema_version") != "2.0.0":
            add("lock_record_schema_version_mismatch")
        if lock_record.get("record_type") != "LOCK_RECORD":
            add("lock_record_type_mismatch")
        if lock_record.get("rc_id") != expected_rc_id:
            add("lock_record_rc_id_mismatch")
        recorded_body_path = Path(str(lock_record.get("locked_body_path", ""))).resolve()
        if lock_path is None or recorded_body_path != lock_path.resolve():
            add("lock_record_body_path_mismatch")
        if lock_record.get("locked_rc_body") != lock:
            add("lock_record_embedded_body_mismatch")
        if lock_record.get("rc_manifest_semantic_sha256") != lock_semantic:
            add("lock_record_semantic_mismatch")
        if lock_record.get("rc_manifest_raw_sha256") != lock_raw:
            add("lock_record_raw_mismatch")
        if lock_record.get("seal_contract_version") != lock.get(
            "seal_contract_version"
        ):
            add("lock_record_seal_contract_mismatch")
    lock_record_raw = (
        sha256_file(lock_record_path)
        if lock_record_path and lock_record_path.is_file()
        else ""
    )
    if chain.get("lock_record_raw_sha256") != lock_record_raw:
        add("chain_lock_record_raw_mismatch")

    dataset_manifest_path = safe_path(
        expected_dataset_manifest_path, "dataset_manifest"
    )
    dataset_manifest = load_object(dataset_manifest_path, "dataset_manifest")
    if lock.get("dataset_manifest") != dataset_manifest:
        add("locked_dataset_manifest_content_mismatch")
    if dataset_manifest_path and dataset_manifest_path.is_file():
        if lock.get("dataset_manifest_sha256") != sha256_file(dataset_manifest_path):
            add("locked_dataset_manifest_raw_mismatch")

    locked_cases: dict[str, list[dict[str, Any]]] = {}
    locked_case_ids: dict[str, list[str]] = {}
    split_metadata = dataset_manifest.get("splits", {})
    locked_thresholds = lock.get("threshold_manifest", {})
    if set(expected_split_files) != set(expected_splits):
        add("expected_split_file_keyset_mismatch")
    if set(expected_cases_by_split) != set(expected_splits):
        add("expected_case_authority_keyset_mismatch")
    for split in expected_splits:
        metadata = split_metadata.get(split) if isinstance(split_metadata, dict) else None
        if not isinstance(metadata, dict):
            add(f"dataset_split_metadata_missing:{split}")
            continue
        expected_file = expected_split_files.get(split)
        split_path = safe_path(expected_file, f"dataset:{split}")
        if metadata.get("filename") != Path(str(expected_file)).name:
            add(f"dataset_split_filename_mismatch:{split}")
        try:
            cases = _jsonl_rows(split_path) if split_path else []
        except (OSError, json.JSONDecodeError, R3N6OutputBindingError) as exc:
            add(f"dataset_split_unreadable:{split}:{exc}")
            cases = []
        if not cases:
            add(f"dataset_split_empty:{split}")
        if metadata.get("count") != len(cases):
            add(f"dataset_split_count_mismatch:{split}")
        if split_path and split_path.is_file() and metadata.get("sha256") != sha256_file(split_path):
            add(f"dataset_split_raw_mismatch:{split}")
        ids = [case.get("case_id") for case in cases]
        if any(not isinstance(case_id, str) for case_id in ids):
            add(f"dataset_case_id_invalid:{split}")
        if len(set(ids)) != len(ids):
            add(f"dataset_case_id_duplicate:{split}")
        if any(case.get("split") != split for case in cases):
            add(f"dataset_case_split_mismatch:{split}")
        authoritative_cases = expected_cases_by_split.get(split, [])
        if cases != authoritative_cases:
            add(f"dataset_split_not_caller_attested:{split}")
        locked_cases[split] = authoritative_cases
        locked_case_ids[split] = [
            case.get("case_id")
            for case in authoritative_cases
            if isinstance(case.get("case_id"), str)
        ]

    manifest = load_object(manifest_path, "output_binding_manifest")
    if manifest_path and manifest_path.is_file():
        if sha256_file(manifest_path) != chain.get("output_binding_manifest_raw_sha256"):
            add("output_binding_manifest_raw_mismatch")
    if manifest:
        verified_manifest = verify_output_binding_manifest(
            manifest,
            repo=repo,
            expected_semantic_sha256=chain.get(
                "output_binding_manifest_semantic_sha256"
            ),
        )
        errors.extend(verified_manifest["errors"])
        if manifest.get("record_type") != "ATTEMPT_OUTPUT_BINDING_MANIFEST":
            add("output_manifest_record_type_mismatch")
        if manifest.get("rc_id") != expected_rc_id:
            add("output_manifest_rc_id_mismatch")
        if manifest.get("attempt_id") != expected_attempt_id:
            add("output_manifest_attempt_id_mismatch")
        if manifest.get("verdict") != chain.get("verdict"):
            add("output_manifest_verdict_mismatch")
        if manifest.get("parent_lock_semantic_sha256") != lock_semantic:
            add("output_manifest_lock_semantic_mismatch")
        if manifest.get("parent_lock_raw_sha256") != lock_raw:
            add("output_manifest_lock_raw_mismatch")

    entries = manifest.get("artifacts", {}) if isinstance(manifest, dict) else {}
    if set(entries) != set(expected_artifacts):
        add("output_manifest_artifact_name_set_mismatch")
    if set(manifest.get("required_artifact_names", [])) != set(expected_artifacts):
        add("output_manifest_required_name_set_mismatch")
    actual_paths: list[str] = []
    for name, (expected_path, expected_kind) in expected_artifacts.items():
        entry = entries.get(name)
        if not isinstance(entry, dict):
            add(f"output_manifest_entry_missing:{name}")
            continue
        if entry.get("path") != expected_path:
            add(f"output_manifest_fixed_path_mismatch:{name}")
        if entry.get("kind") != expected_kind:
            add(f"output_manifest_kind_mismatch:{name}")
        if isinstance(entry.get("path"), str):
            actual_paths.append(entry["path"])
    if len(set(actual_paths)) != len(actual_paths):
        add("output_manifest_aliased_artifact_paths")
    if len({path for path, _ in expected_artifacts.values()}) != len(expected_artifacts):
        add("expected_artifact_paths_not_unique")

    intent = load_object(intent_path, "attempt_intent")
    attempt = load_object(attempt_path, "attempt_result")
    qualification = load_object(qualification_path, "qualification")
    intent_raw = sha256_file(intent_path) if intent_path and intent_path.is_file() else ""
    common_expected = {
        "attempt_id": expected_attempt_id,
        "rc_id": expected_rc_id,
        "parent_lock_semantic_sha256": lock_semantic,
        "parent_lock_raw_sha256": lock_raw,
        "split": "HOLDOUT_VALIDATION",
        "command": expected_command,
    }
    for field, expected in common_expected.items():
        if intent.get(field) != expected:
            add(f"intent_{field}_mismatch")
        if attempt.get(field) != expected:
            add(f"attempt_{field}_mismatch")
    if intent.get("record_type") != "HOLDOUT_ATTEMPT_INTENT":
        add("intent_record_type_mismatch")
    if intent.get("schema_version") != "2.0.0":
        add("intent_schema_version_mismatch")
    if intent.get("status") != "LOCKED_NOT_RUN":
        add("intent_status_mismatch")
    if intent.get("all_splits") != list(expected_splits):
        add("intent_all_splits_mismatch")
    if intent.get("complete_output_binding_required") is not True:
        add("intent_complete_output_binding_not_required")
    if intent.get("prohibited_rerun") is not True:
        add("intent_rerun_not_prohibited")
    if intent.get("claim_created_exclusively") is not True:
        add("intent_exclusive_claim_missing")
    if intent.get("lock_record_path") != expected_paths.get("lock_record_path"):
        add("intent_lock_record_path_mismatch")
    if intent.get("lock_record_raw_sha256") != lock_record_raw:
        add("intent_lock_record_raw_mismatch")
    if attempt.get("record_type") != "HOLDOUT_ATTEMPT_PROVISIONAL_RESULT":
        add("attempt_record_type_mismatch")
    if attempt.get("schema_version") != "2.0.0":
        add("attempt_schema_version_mismatch")
    if attempt.get("status") != "COMPLETED_PENDING_CHAIN_BINDING":
        add("attempt_status_mismatch")
    if attempt.get("all_splits") != list(expected_splits):
        add("attempt_all_splits_mismatch")
    if attempt.get("complete_output_binding_required") is not True:
        add("attempt_complete_output_binding_not_required")
    if attempt.get("prohibited_rerun") is not True:
        add("attempt_rerun_not_prohibited")
    if attempt.get("attempt_intent_path") != expected_paths.get("attempt_intent_path"):
        add("attempt_intent_path_mismatch")
    if attempt.get("attempt_intent_raw_sha256") != intent_raw:
        add("attempt_intent_raw_binding_mismatch")
    if attempt.get("engineering_verdict") != "PENDING_COMPLETE_CHAIN_BINDING":
        add("attempt_claims_engineering_verdict")
    if attempt.get("release_authority") is not False:
        add("attempt_claims_release_authority")

    split_results: dict[str, bool] = {}
    split_persistence: dict[str, bool] = {}
    holdout_metrics: dict[str, Any] | None = None
    for split in expected_splits:
        stem = split.lower()
        report_entry = entries.get(f"{stem}_score_report", {})
        prediction_entry = entries.get(f"{stem}_predictions", {})
        report_path = safe_path(report_entry.get("path"), f"report:{split}") if isinstance(report_entry, dict) else None
        prediction_path = safe_path(prediction_entry.get("path"), f"predictions:{split}") if isinstance(prediction_entry, dict) else None
        report = load_object(report_path, f"score_report:{split}")
        cases = locked_cases.get(split, [])
        case_ids = locked_case_ids.get(split, [])
        case_count = len(cases)
        if report.get("phase") != "MAI-07R3N6":
            add(f"report_phase_mismatch:{split}")
        if report.get("split") != split:
            add(f"report_split_mismatch:{split}")
        if report.get("case_count") != case_count or case_count <= 0:
            add(f"report_case_count_mismatch:{split}")

        scorer_ok_values: list[bool] = []
        observations_by_side: dict[str, list[dict[str, Any]]] = {}
        expected_ids = case_ids
        for side, expected_scorer_id in (
            ("canonical", expected_canonical_scorer_id),
            ("audit", expected_audit_scorer_id),
        ):
            scorer = report.get(side)
            if not isinstance(scorer, dict):
                add(f"report_{side}_missing:{split}")
                scorer = {}
            if scorer.get("scorer_id") != expected_scorer_id:
                add(f"report_{side}_scorer_id_mismatch:{split}")
            if scorer.get("scorer_version") != expected_scorer_version:
                add(f"report_{side}_scorer_version_mismatch:{split}")
            if scorer.get("split") != split:
                add(f"report_{side}_split_mismatch:{split}")
            metrics = scorer.get("metrics")
            gates = scorer.get("gates")
            if not isinstance(metrics, dict) or set(metrics) != set(expected_required_metrics):
                add(f"report_{side}_metric_keyset_mismatch:{split}")
                metrics = metrics if isinstance(metrics, dict) else {}
            if not isinstance(gates, dict) or set(gates) != set(expected_required_gates):
                add(f"report_{side}_gate_keyset_mismatch:{split}")
                gates = gates if isinstance(gates, dict) else {}
            failed_gates: list[str] = []
            for gate_id in expected_required_gates:
                gate = gates.get(gate_id)
                if not isinstance(gate, dict) or type(gate.get("pass")) is not bool:
                    add(f"report_{side}_gate_contract:{split}:{gate_id}")
                    continue
                outcome = gate.get("outcome")
                if gate["pass"]:
                    # Empty optional populations are pass=True with NOT_APPLICABLE.
                    if outcome not in {"PASS", "NOT_APPLICABLE"}:
                        add(f"report_{side}_gate_outcome_mismatch:{split}:{gate_id}")
                elif outcome != "FAIL":
                    add(f"report_{side}_gate_outcome_mismatch:{split}:{gate_id}")
                if not gate["pass"]:
                    failed_gates.append(gate_id)
            computed_scorer_ok = bool(gates) and not failed_gates and len(gates) == len(expected_required_gates)
            if scorer.get("ok") is not computed_scorer_ok:
                add(f"report_{side}_ok_not_derived:{split}")
            if sorted(scorer.get("failed_gates", [])) != sorted(failed_gates):
                add(f"report_{side}_failed_gates_mismatch:{split}")
            scorer_ok_values.append(computed_scorer_ok)
            observations = scorer.get("observations")
            if not isinstance(observations, list) or not all(isinstance(row, dict) for row in observations):
                add(f"report_{side}_observations_invalid:{split}")
                observations = []
            observation_ids = [row.get("case_id") for row in observations]
            if observation_ids != expected_ids:
                add(f"report_{side}_case_id_sequence_mismatch:{split}")
            if len(set(observation_ids)) != len(observation_ids):
                add(f"report_{side}_duplicate_case_id:{split}")
            for case, observation in zip(cases, observations, strict=False):
                for mismatch in observation_validator(case, observation, side):
                    add(f"report_{side}_observation:{split}:{mismatch}")
                if observation.get("expected_behavior") != case.get("expected_behavior"):
                    add(f"report_{side}_expected_behavior_mismatch:{split}")
                expected_populations = list(case.get("populations") or case.get("population_ids") or [])
                if observation.get("populations") != expected_populations:
                    add(f"report_{side}_populations_mismatch:{split}")
            observations_by_side[side] = observations

        try:
            recomputed = report_recomputer(
                cases,
                observations_by_side.get("canonical", []),
                observations_by_side.get("audit", []),
                locked_thresholds,
                split,
            )
            recomputed_canonical = recomputed.get("canonical", {})
            recomputed_audit = recomputed.get("audit", {})
            recomputed_agreement = recomputed.get("agreement", {})
            recomputed_case_agreement = recomputed.get("case_agreement", {})
        except (KeyError, TypeError, ValueError) as exc:
            add(f"report_recomputation_failed:{split}:{exc}")
            recomputed_canonical = {}
            recomputed_audit = {}
            recomputed_agreement = {}
            recomputed_case_agreement = {}
        if report.get("canonical") != recomputed_canonical:
            add(f"report_canonical_not_recomputed:{split}")
        if report.get("audit") != recomputed_audit:
            add(f"report_audit_not_recomputed:{split}")
        if report.get("agreement") != recomputed_agreement:
            add(f"report_agreement_not_recomputed:{split}")
        if report.get("case_agreement") != recomputed_case_agreement:
            add(f"report_case_agreement_not_recomputed:{split}")

        agreement = report.get("agreement")
        case_agreement = report.get("case_agreement")
        agreement_ok = isinstance(agreement, dict) and type(agreement.get("ok")) is bool
        case_agreement_ok = isinstance(case_agreement, dict) and type(case_agreement.get("ok")) is bool
        if not agreement_ok:
            add(f"report_agreement_contract:{split}")
        if not case_agreement_ok:
            add(f"report_case_agreement_contract:{split}")
        aggregate_pass = bool(agreement.get("ok")) if isinstance(agreement, dict) else False
        case_pass = bool(case_agreement.get("ok")) if isinstance(case_agreement, dict) else False
        canonical_expected = report.get("canonical", {}).get("metrics", {}).get("split_expected_pass", {})
        audit_expected = report.get("audit", {}).get("metrics", {}).get("split_expected_pass", {})
        for side, metric in (("canonical", canonical_expected), ("audit", audit_expected)):
            if not isinstance(metric, dict):
                add(f"report_{side}_split_expected_missing:{split}")
                continue
            numerator = metric.get("numerator")
            denominator = metric.get("denominator")
            if type(numerator) is not int or not 0 <= numerator <= case_count:
                add(f"report_{side}_split_expected_numerator:{split}")
            if denominator != case_count:
                add(f"report_{side}_split_expected_denominator:{split}")
            if metric.get("scorer_version") != expected_scorer_version:
                add(f"report_{side}_split_expected_scorer:{split}")
        expected_pass = bool(
            canonical_expected.get("numerator") == case_count
            and canonical_expected.get("denominator") == case_count
            and audit_expected.get("numerator") == case_count
            and audit_expected.get("denominator") == case_count
        )
        if report.get("split_expected_pass") is not expected_pass:
            add(f"report_split_expected_flag_mismatch:{split}")
        persistence = bool(
            len(observations_by_side.get("canonical", [])) == case_count
            and len(observations_by_side.get("audit", [])) == case_count
            and [row.get("case_id") for row in observations_by_side.get("canonical", [])] == expected_ids
            and [row.get("case_id") for row in observations_by_side.get("audit", [])] == expected_ids
        )
        if report.get("audit_observations_persisted") is not persistence:
            add(f"report_audit_persistence_flag_mismatch:{split}")
        split_persistence[split] = persistence
        computed_split_ok = bool(
            len(scorer_ok_values) == 2
            and all(scorer_ok_values)
            and aggregate_pass
            and case_pass
            and expected_pass
            and persistence
        )
        if report.get("ok") is not computed_split_ok:
            add(f"report_ok_not_derived:{split}")
        split_results[split] = computed_split_ok

        try:
            predictions = _jsonl_rows(prediction_path) if prediction_path else []
        except (OSError, json.JSONDecodeError, R3N6OutputBindingError) as exc:
            add(f"prediction_unreadable:{split}:{exc}")
            predictions = []
        expected_predictions = [
            {
                **observation,
                "runtime": expected_runtime_version,
                "scorer_version": expected_scorer_version,
                "split": split,
            }
            for observation in observations_by_side.get("canonical", [])
        ]
        if predictions != expected_predictions:
            add(f"prediction_projection_mismatch:{split}")
        if not isinstance(prediction_entry, dict) or prediction_entry.get("record_count") != case_count:
            add(f"prediction_locked_count_mismatch:{split}")
        if split == "HOLDOUT_VALIDATION":
            holdout_metrics = report.get("canonical", {}).get("metrics")

    derived_pass = bool(split_results) and set(split_results) == set(expected_splits) and all(split_results.values())
    derived_verdict = (
        "PASSED_FRESH_HOLDOUT_CORRECTIVE_RC"
        if derived_pass
        else "FAILED_HOLDOUT_QUALITY"
    )
    if chain.get("verdict") != derived_verdict:
        add("chain_verdict_not_derived")
    if attempt.get("all_split_results") != split_results:
        add("attempt_split_results_mismatch")
    if attempt.get("numerical_verdict") != derived_verdict:
        add("attempt_numerical_verdict_mismatch")
    primary_entry = entries.get("holdout_validation_predictions", {})
    primary_path = safe_path(primary_entry.get("path"), "primary_predictions") if isinstance(primary_entry, dict) else None
    try:
        primary_rows = (
            _jsonl_rows(primary_path)
            if primary_path and primary_path.is_file()
            else []
        )
    except (OSError, json.JSONDecodeError, R3N6OutputBindingError) as exc:
        add(f"primary_prediction_unreadable:{exc}")
        primary_rows = []
    if Path(str(attempt.get("prediction_path", ""))).resolve() != (primary_path.resolve() if primary_path else Path()):
        add("attempt_prediction_path_binding_mismatch")
    if attempt.get("prediction_count") != len(primary_rows):
        add("attempt_prediction_count_mismatch")
    if primary_path and primary_path.is_file():
        if attempt.get("predictions_jsonl_raw_sha256") != sha256_file(primary_path):
            add("attempt_prediction_raw_hash_mismatch")
        primary_semantic = predictions_canonical_list_sha256(primary_rows)
        if attempt.get("predictions_canonical_list_sha256") != primary_semantic:
            add("attempt_prediction_semantic_hash_mismatch")
        if attempt.get("predictions_semantic_sha256") != primary_semantic:
            add("attempt_prediction_semantic_alias_mismatch")

    if qualification.get("record_type") != "PROVISIONAL_QUALIFICATION_RESULT":
        add("qualification_record_type_mismatch")
    if qualification.get("schema_version") != "2.0.0":
        add("qualification_schema_version_mismatch")
    if qualification.get("rc_id") != expected_rc_id:
        add("qualification_rc_id_mismatch")
    if qualification.get("attempt_id") != expected_attempt_id:
        add("qualification_attempt_id_mismatch")
    if qualification.get("split") != "HOLDOUT_VALIDATION":
        add("qualification_split_mismatch")
    if qualification.get("all_splits") != list(expected_splits):
        add("qualification_all_splits_mismatch")
    if qualification.get("command") != expected_command:
        add("qualification_command_mismatch")
    if qualification.get("parent_lock_semantic_sha256") != lock_semantic:
        add("qualification_lock_semantic_mismatch")
    if qualification.get("parent_lock_raw_sha256") != lock_raw:
        add("qualification_lock_raw_mismatch")
    if qualification.get("attempt_intent_path") != expected_paths.get("attempt_intent_path"):
        add("qualification_intent_path_mismatch")
    if qualification.get("attempt_intent_raw_sha256") != intent_raw:
        add("qualification_intent_raw_mismatch")
    if qualification.get("all_split_results") != split_results:
        add("qualification_split_results_mismatch")
    if qualification.get("metrics_summary") != holdout_metrics:
        add("qualification_metrics_summary_mismatch")
    if qualification.get("gate_all_pass") is not derived_pass:
        add("qualification_gate_flag_mismatch")
    expected_qualification_status = (
        "PASSED_HOLDOUT_PENDING_CHAIN_BINDING"
        if derived_pass
        else "FAILED_HOLDOUT_QUALITY_PENDING_CHAIN_BINDING"
    )
    if qualification.get("status") != expected_qualification_status:
        add("qualification_status_mismatch")
    if qualification.get("numerical_verdict") != derived_verdict:
        add("qualification_numerical_verdict_mismatch")
    if qualification.get("engineering_verdict") != "PENDING_COMPLETE_CHAIN_BINDING":
        add("qualification_claims_engineering_verdict")
    if qualification.get("release_authority") is not False:
        add("qualification_claims_release_authority")
    if qualification.get("output_binding_manifest_required") is not True:
        add("qualification_output_binding_not_required")
    if qualification.get("audit_observations_persisted") is not (
        bool(split_persistence)
        and set(split_persistence) == set(expected_splits)
        and all(split_persistence.values())
    ):
        add("qualification_audit_persistence_mismatch")
    qualification_authority = {
        "candidate_promoted": False,
        "QUALITY_GATES_PASSED": False,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "MAI-07": "NEEDS_CORRECTIVE_WORK",
        "MAI-08": "NOT_STARTED",
    }
    for field, expected in qualification_authority.items():
        if qualification.get(field) != expected:
            add(f"qualification_authority_field_mismatch:{field}")

    snapshot = intent.get("locked_input_snapshot")
    if not isinstance(snapshot, dict):
        add("intent_locked_input_snapshot_missing")
    if snapshot != dict(expected_locked_input_snapshot):
        add("intent_locked_input_snapshot_not_authoritative")
    if attempt.get("locked_input_snapshot") != snapshot:
        add("attempt_locked_input_snapshot_mismatch")
    if qualification.get("locked_input_snapshot") != snapshot:
        add("qualification_locked_input_snapshot_mismatch")
    if chain.get("locked_input_snapshot") != snapshot:
        add("chain_locked_input_snapshot_mismatch")

    return {
        "ok": not errors,
        "errors": errors,
        "derived_verdict": derived_verdict,
        "split_results": split_results,
    }


__all__ = [
    "CHAIN_SCHEMA_VERSION",
    "JSON_KIND",
    "JSONL_KIND",
    "R3N6OutputBindingError",
    "SCHEMA_VERSION",
    "build_output_binding_manifest",
    "output_manifest_semantic_sha256",
    "verify_complete_r3n6_chain",
    "verify_output_binding_manifest",
]
