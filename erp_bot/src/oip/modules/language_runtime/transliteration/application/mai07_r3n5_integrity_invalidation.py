"""Append-only R3N5 forensic snapshot and release-authority invalidation.

This module reads only persisted R3N5 inputs and outputs.  It deliberately does
not import a scorer or candidate runtime, and it never executes the model.  The
result is deterministic: no wall-clock field or environment-specific absolute
path is included in the payload.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


REPO = Path(__file__).resolve().parents[7]
APP = Path(__file__).resolve().parent
OUT = REPO / "evals" / "mai07_r3n5_fresh_holdout"
REPORTS = OUT / "reports"

RC_ID = "MAI_07R3N5_FRESH_HOLDOUT_RELEASE_CANDIDATE_001"
ATTEMPT_ID = "MAI_07R3N5_HOLDOUT_ATTEMPT_001"
INVALIDATION_VERDICT = (
    "INVALIDATED_INCOMPLETE_INDEPENDENT_SCORING_AND_OUTPUT_BINDING_NEW_RC_REQUIRED"
)
INVALIDATION_PATH = OUT / "MAI_07R3N5_INTEGRITY_INVALIDATION.json"

LOCKED_PATH = OUT / f"{RC_ID}.LOCKED_NOT_RUN.json"
LOCK_RECORD_PATH = OUT / f"{RC_ID}.LOCK_RECORD.json"
ATTEMPT_PATH = OUT / f"{ATTEMPT_ID}.json"
QUALIFICATION_PATH = OUT / f"{RC_ID}.QUALIFICATION_RESULT.json"
CHAIN_PATH = OUT / f"{RC_ID}.CHAIN_MANIFEST.json"
MANIFEST_PATH = OUT / "MANIFEST.json"

SPLIT_STEMS = {
    "HOLDOUT_VALIDATION": "holdout_validation",
    "SAFETY_CHALLENGE": "safety_challenge",
    "CONTEXT_COUNTERFACTUAL": "context_counterfactual",
    "OOV_CHALLENGE": "oov_challenge",
    "MONOTONIC_REGRESSION": "monotonic_regression",
    "IDENTITY_ANCHOR_CHALLENGE": "identity_anchor_challenge",
}


class ForensicIntegrityError(RuntimeError):
    """Persisted evidence is missing, malformed, or non-bijective."""


def _load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ForensicIntegrityError(f"invalid_json:{_relative(path)}") from exc
    if not isinstance(value, dict):
        raise ForensicIntegrityError(f"json_object_required:{_relative(path)}")
    return value


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise ForensicIntegrityError(f"unreadable_jsonl:{_relative(path)}") from exc
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ForensicIntegrityError(
                f"invalid_jsonl:{_relative(path)}:{line_number}"
            ) from exc
        if not isinstance(row, dict):
            raise ForensicIntegrityError(
                f"jsonl_object_required:{_relative(path)}:{line_number}"
            )
        rows.append(row)
    return rows


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
    except OSError as exc:
        raise ForensicIntegrityError(f"unreadable_file:{_relative(path)}") from exc
    return digest.hexdigest()


def _relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO.resolve()).as_posix()
    except ValueError as exc:
        raise ForensicIntegrityError(f"path_outside_repository:{path}") from exc


def _snapshot(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ForensicIntegrityError(f"missing_file:{_relative(path)}")
    return {
        "path": _relative(path),
        "raw_sha256": _sha256(path),
        "size_bytes": path.stat().st_size,
    }


def _raw_evidence_snapshot() -> dict[str, Any]:
    score_reports = {
        split: _snapshot(REPORTS / f"{stem}_score_report.json")
        for split, stem in SPLIT_STEMS.items()
    }
    prediction_files = {
        split: _snapshot(REPORTS / f"{stem}_predictions.jsonl")
        for split, stem in SPLIT_STEMS.items()
    }
    return {
        "lock": _snapshot(LOCKED_PATH),
        "lock_record": _snapshot(LOCK_RECORD_PATH),
        "attempt": _snapshot(ATTEMPT_PATH),
        "qualification": _snapshot(QUALIFICATION_PATH),
        "chain": _snapshot(CHAIN_PATH),
        "score_reports": score_reports,
        "prediction_files": prediction_files,
    }


def _verify_locked_sources(locked: dict[str, Any]) -> dict[str, Any]:
    source_hashes = locked.get("source_hashes")
    if not isinstance(source_hashes, dict) or not source_hashes:
        raise ForensicIntegrityError("locked_source_hashes_missing")
    files: dict[str, Any] = {}
    for filename in sorted(source_hashes):
        if Path(filename).name != filename:
            raise ForensicIntegrityError(f"unsafe_locked_source_path:{filename}")
        path = APP / filename
        actual = _sha256(path)
        expected = source_hashes[filename]
        files[filename] = {
            "path": _relative(path),
            "locked_raw_sha256": expected,
            "actual_raw_sha256": actual,
            "matches": actual == expected,
        }
    return {
        "locked_source_count": len(files),
        "all_match": all(row["matches"] for row in files.values()),
        "files": files,
    }


def _verify_locked_dataset(locked: dict[str, Any]) -> dict[str, Any]:
    physical_manifest = _load_json(MANIFEST_PATH)
    embedded_manifest = locked.get("dataset_manifest")
    if not isinstance(embedded_manifest, dict):
        raise ForensicIntegrityError("locked_dataset_manifest_missing")
    split_metadata = embedded_manifest.get("splits")
    if not isinstance(split_metadata, dict) or not split_metadata:
        raise ForensicIntegrityError("locked_dataset_splits_missing")

    splits: dict[str, Any] = {}
    for split in sorted(split_metadata):
        metadata = split_metadata[split]
        if not isinstance(metadata, dict):
            raise ForensicIntegrityError(f"locked_split_metadata_invalid:{split}")
        filename = metadata.get("filename")
        if not isinstance(filename, str) or Path(filename).name != filename:
            raise ForensicIntegrityError(f"unsafe_locked_dataset_path:{split}")
        path = OUT / filename
        rows = _load_jsonl(path)
        actual_hash = _sha256(path)
        expected_hash = metadata.get("sha256")
        expected_count = metadata.get("count")
        splits[split] = {
            "path": _relative(path),
            "locked_raw_sha256": expected_hash,
            "actual_raw_sha256": actual_hash,
            "hash_matches": actual_hash == expected_hash,
            "locked_count": expected_count,
            "actual_count": len(rows),
            "count_matches": type(expected_count) is int and len(rows) == expected_count,
        }

    manifest_actual_hash = _sha256(MANIFEST_PATH)
    manifest_locked_hash = locked.get("dataset_manifest_sha256")
    manifest_hash_matches = manifest_actual_hash == manifest_locked_hash
    manifest_content_matches = physical_manifest == embedded_manifest
    return {
        "manifest_path": _relative(MANIFEST_PATH),
        "locked_manifest_raw_sha256": manifest_locked_hash,
        "actual_manifest_raw_sha256": manifest_actual_hash,
        "manifest_hash_matches": manifest_hash_matches,
        "physical_manifest_matches_embedded_locked_manifest": manifest_content_matches,
        "locked_split_count": len(splits),
        "all_split_hashes_match": all(row["hash_matches"] for row in splits.values()),
        "all_split_counts_match": all(row["count_matches"] for row in splits.values()),
        "all_match": bool(
            manifest_hash_matches
            and manifest_content_matches
            and all(row["hash_matches"] and row["count_matches"] for row in splits.values())
        ),
        "splits": splits,
    }


def _case_passes_expected(case: dict[str, Any], observation: dict[str, Any]) -> bool:
    """Independent replay of expected behavior using locked case authority."""

    expected = case.get("expected_behavior")
    if expected in {"IDENTITY_TOP1", "ACRONYM_IDENTITY_TOP1", "PROTECTED_IDENTITY"}:
        return bool(
            observation.get("span_found") is True
            and observation.get("identity_top1") is True
            and observation.get("false_devanagari_top1") is False
        )
    if expected in {"IDENTITY_RETAINED", "SHARED_CONSERVATIVE"}:
        return bool(
            observation.get("span_found") is True
            and observation.get("exact_raw_identity") is True
        )
    if expected == "ROMANIZED_SCRIPT_AT_5":
        return bool(
            observation.get("span_found") is True
            and observation.get("devanagari_at_5") is True
        )
    if expected in {"NO_RAW_MUTATION", "CAP_OK"}:
        return bool(
            observation.get("raw_text_unchanged") is True
            and observation.get("caps_ok") is True
            and observation.get("exact_raw_identity") is True
        )
    return bool(
        observation.get("span_found") is True
        and observation.get("exact_raw_identity") is True
    )


def _replay_split_expected_pass(locked: dict[str, Any]) -> dict[str, Any]:
    locked_splits = locked["dataset_manifest"]["splits"]
    replayed: dict[str, Any] = {}
    for split, stem in SPLIT_STEMS.items():
        metadata = locked_splits.get(split)
        if not isinstance(metadata, dict):
            raise ForensicIntegrityError(f"split_not_locked:{split}")
        cases = _load_jsonl(OUT / metadata["filename"])
        report = _load_json(REPORTS / f"{stem}_score_report.json")
        canonical = report.get("canonical")
        audit = report.get("audit")
        if not isinstance(canonical, dict) or not isinstance(audit, dict):
            raise ForensicIntegrityError(f"scorer_report_missing:{split}")
        observations = canonical.get("observations")
        if not isinstance(observations, list) or not all(isinstance(row, dict) for row in observations):
            raise ForensicIntegrityError(f"canonical_observations_missing:{split}")

        case_by_id = {case.get("case_id"): case for case in cases}
        observation_by_id = {row.get("case_id"): row for row in observations}
        if (
            None in case_by_id
            or None in observation_by_id
            or len(case_by_id) != len(cases)
            or len(observation_by_id) != len(observations)
            or set(case_by_id) != set(observation_by_id)
        ):
            raise ForensicIntegrityError(f"case_observation_bijection_failed:{split}")

        numerator = sum(
            1
            for case_id, case in case_by_id.items()
            if _case_passes_expected(case, observation_by_id[case_id])
        )
        denominator = len(cases)
        canonical_metrics = canonical.get("metrics", {})
        audit_metrics = audit.get("metrics", {})
        persisted = canonical_metrics.get("split_expected_pass")
        if not isinstance(persisted, dict):
            raise ForensicIntegrityError(f"canonical_split_expected_pass_missing:{split}")
        persisted_numerator = persisted.get("numerator")
        persisted_denominator = persisted.get("denominator")
        exact = numerator == denominator
        replayed[split] = {
            "locked_case_count": metadata.get("count"),
            "canonical_observation_count": len(observations),
            "case_observation_bijection": True,
            "replayed_numerator": numerator,
            "replayed_denominator": denominator,
            "exact_fraction": f"{numerator}/{denominator}",
            "all_cases_pass": exact,
            "persisted_canonical_numerator": persisted_numerator,
            "persisted_canonical_denominator": persisted_denominator,
            "matches_persisted_canonical_metric": bool(
                numerator == persisted_numerator and denominator == persisted_denominator
            ),
            "top_level_split_expected_pass": report.get("split_expected_pass"),
            "canonical_metric_present": True,
            "audit_metric_present": "split_expected_pass" in audit_metrics,
            "reported_canonical_audit_agreement_ok": report.get("agreement", {}).get("ok") is True,
        }

    return {
        "authority": "LOCKED_CASES_PLUS_PERSISTED_CANONICAL_OBSERVATIONS",
        "implementation": "INDEPENDENT_STDLIB_REPLAY_WITHOUT_SCORER_OR_RUNTIME_IMPORT",
        "split_count": len(replayed),
        "all_six_exact": all(row["all_cases_pass"] for row in replayed.values()),
        "all_match_persisted_canonical_metrics": all(
            row["matches_persisted_canonical_metric"] for row in replayed.values()
        ),
        "all_canonical_metrics_present": all(
            row["canonical_metric_present"] for row in replayed.values()
        ),
        "all_audit_metrics_absent": all(
            not row["audit_metric_present"] for row in replayed.values()
        ),
        "all_reported_agreements_still_ok": all(
            row["reported_canonical_audit_agreement_ok"] for row in replayed.values()
        ),
        "splits": replayed,
    }


def _attempt_binding_analysis(
    attempt: dict[str, Any], raw_snapshot: dict[str, Any]
) -> dict[str, Any]:
    core = raw_snapshot["prediction_files"]["HOLDOUT_VALIDATION"]
    recorded_hash = attempt.get("predictions_jsonl_raw_sha256")
    recorded_count = attempt.get("prediction_count")
    core_rows = _load_jsonl(REPORTS / "holdout_validation_predictions.jsonl")
    core_hash_matches = core["raw_sha256"] == recorded_hash
    core_count_matches = type(recorded_count) is int and len(core_rows) == recorded_count

    output_paths = [
        raw_snapshot[kind][split]["path"]
        for kind in ("score_reports", "prediction_files")
        for split in SPLIT_STEMS
    ]
    bound_paths = [core["path"]] if core_hash_matches else []
    unbound_paths = sorted(set(output_paths) - set(bound_paths))
    return {
        "core_holdout_prediction": {
            "path": core["path"],
            "attempt_recorded_raw_sha256": recorded_hash,
            "actual_raw_sha256": core["raw_sha256"],
            "raw_sha256_matches_attempt": core_hash_matches,
            "attempt_recorded_count": recorded_count,
            "actual_count": len(core_rows),
            "count_matches_attempt": core_count_matches,
            "original_core_prediction_binding_still_matches": bool(
                core_hash_matches and core_count_matches
            ),
        },
        "required_output_artifact_count": len(output_paths),
        "attempt_time_hash_bound_output_count": len(bound_paths),
        "attempt_time_hash_bound_output_paths": bound_paths,
        "attempt_time_unbound_output_count": len(unbound_paths),
        "attempt_time_unbound_output_paths": unbound_paths,
        "all_output_artifacts_attempt_time_hash_bound": len(unbound_paths) == 0,
    }


def build_invalidation_payload() -> dict[str, Any]:
    """Recompute the deterministic forensic payload without writing anything."""

    locked = _load_json(LOCKED_PATH)
    attempt = _load_json(ATTEMPT_PATH)
    qualification = _load_json(QUALIFICATION_PATH)
    chain = _load_json(CHAIN_PATH)
    raw_snapshot = _raw_evidence_snapshot()
    sources = _verify_locked_sources(locked)
    dataset = _verify_locked_dataset(locked)
    replay = _replay_split_expected_pass(locked)
    output_binding = _attempt_binding_analysis(attempt, raw_snapshot)

    numerical_consistency = bool(
        sources["all_match"]
        and dataset["all_match"]
        and output_binding["core_holdout_prediction"][
            "original_core_prediction_binding_still_matches"
        ]
        and replay["all_six_exact"]
        and replay["all_match_persisted_canonical_metrics"]
    )
    incomplete_independent_scoring = bool(
        replay["all_canonical_metrics_present"]
        and replay["all_audit_metrics_absent"]
        and replay["all_reported_agreements_still_ok"]
    )
    incomplete_output_binding = not output_binding[
        "all_output_artifacts_attempt_time_hash_bound"
    ]
    all_checks_passed = bool(
        numerical_consistency
        and incomplete_independent_scoring
        and incomplete_output_binding
    )

    return {
        "schema_version": "mai07_r3n5_integrity_invalidation_v1",
        "record_type": "APPEND_ONLY_FORENSIC_INVALIDATION",
        "subject_rc_id": RC_ID,
        "subject_attempt_id": ATTEMPT_ID,
        "forensic_constraints": {
            "append_only": True,
            "existing_r3n5_bytes_modified": False,
            "runtime_or_model_rerun": False,
            "deterministic_payload_without_timestamp": True,
        },
        "raw_sha256_snapshot": raw_snapshot,
        "integrity_verification": {
            "locked_sources": sources,
            "locked_dataset": dataset,
            "attempt_binding": output_binding,
        },
        "independent_split_expected_pass_replay": replay,
        "numerical_evidence": {
            "classification": "CONSISTENT_AS_CURRENTLY_PERSISTED",
            "consistent": numerical_consistency,
            "attempt_time_release_authority_claimed": False,
            "note": (
                "The six stored N/N results replay exactly and current bytes match their "
                "available locks; this does not restore missing independent scoring or "
                "attempt-time output binding."
            ),
        },
        "release_authority": {
            "status": "WITHDRAWN",
            "prior_qualification_status": qualification.get("status"),
            "prior_chain_verdict": chain.get("verdict"),
            "prior_records_preserved": True,
            "defects": [
                {
                    "defect_id": "R3N5_INCOMPLETE_INDEPENDENT_SCORING",
                    "confirmed": incomplete_independent_scoring,
                    "classification": (
                        "OUTCOME_AFFECTING_SPLIT_EXPECTED_PASS_ABSENT_FROM_AUDIT_AND_"
                        "EXCLUDED_FROM_COMPARISON_CONTRARY_TO_ADR_0019"
                    ),
                    "governance_requirement": (
                        "ADR_0019 requires canonical and independent audit scoring to agree "
                        "per case and on complete metric/gate semantics."
                    ),
                    "affected_splits": list(SPLIT_STEMS),
                },
                {
                    "defect_id": "R3N5_INCOMPLETE_ATTEMPT_TIME_OUTPUT_BINDING",
                    "confirmed": incomplete_output_binding,
                    "classification": (
                        "OUTPUT_ARTIFACTS_NOT_ATTEMPT_TIME_HASH_BOUND"
                    ),
                    "required_output_artifact_count": output_binding[
                        "required_output_artifact_count"
                    ],
                    "attempt_time_hash_bound_output_count": output_binding[
                        "attempt_time_hash_bound_output_count"
                    ],
                    "attempt_time_unbound_output_count": output_binding[
                        "attempt_time_unbound_output_count"
                    ],
                },
            ],
        },
        "verdict": INVALIDATION_VERDICT,
        "all_checks_passed": all_checks_passed,
        "r3n5_engineering_verdict_retained": False,
        "next_phase": "MAI-07R3N6",
        "next_governed_phase": (
            "MAI-07R3N6-FRESH-HOLDOUT-COMPLETE-EVIDENCE-CORRECTIVE"
        ),
        "new_release_candidate_required": True,
        "quality_gates_passed": False,
        "linguist_approved": False,
        "production_approved": False,
        "candidate_promoted": False,
        "MAI-07": "NEEDS_CORRECTIVE_WORK",
        "MAI-08": "NOT_STARTED",
    }


def serialize_invalidation(payload: dict[str, Any]) -> bytes:
    return (
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")


def write_invalidation(path: Path = INVALIDATION_PATH) -> dict[str, Any]:
    """Create the invalidation exactly once and refuse every overwrite."""

    payload = build_invalidation_payload()
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("xb") as stream:
            stream.write(serialize_invalidation(payload))
    except FileExistsError as exc:
        raise FileExistsError(f"invalidation_already_exists:{path}") from exc
    return payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    payload = write_invalidation() if args.write else build_invalidation_payload()
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


__all__ = [
    "ATTEMPT_ID",
    "INVALIDATION_PATH",
    "INVALIDATION_VERDICT",
    "RC_ID",
    "SPLIT_STEMS",
    "build_invalidation_payload",
    "serialize_invalidation",
    "write_invalidation",
]
