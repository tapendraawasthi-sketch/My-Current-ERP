from __future__ import annotations

import json
from pathlib import Path

import pytest

from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n6_output_binding import (
    JSON_KIND,
    JSONL_KIND,
    R3N6OutputBindingError,
    build_output_binding_manifest,
    output_manifest_semantic_sha256,
    verify_output_binding_manifest,
)


def _write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, sort_keys=True) + "\n", encoding="utf-8")


def _write_jsonl(path: Path, values: list[dict]) -> None:
    path.write_text(
        "".join(json.dumps(value, sort_keys=True) + "\n" for value in values),
        encoding="utf-8",
    )


def test_output_manifest_binds_raw_and_semantic_bytes(tmp_path: Path):
    report = tmp_path / "report.json"
    predictions = tmp_path / "predictions.jsonl"
    _write_json(report, {"ok": True, "value": 1})
    _write_jsonl(predictions, [{"case_id": "b"}, {"case_id": "a"}])
    artifacts = {
        "report": (report, JSON_KIND),
        "predictions": (predictions, JSONL_KIND),
    }
    manifest = build_output_binding_manifest(
        repo=tmp_path,
        rc_id="RC",
        attempt_id="ATTEMPT",
        verdict="PASSED_FRESH_HOLDOUT_CORRECTIVE_RC",
        lock_semantic_sha256="1" * 64,
        lock_raw_sha256="2" * 64,
        artifacts=artifacts,
        required_artifact_names=set(artifacts),
    )
    verified = verify_output_binding_manifest(manifest, repo=tmp_path)
    assert verified["ok"] is True
    assert manifest["artifact_count"] == 2
    assert manifest["attempt_time_binding"] is True
    assert manifest["manifest_semantic_sha256"] == (
        output_manifest_semantic_sha256(manifest)
    )


def test_output_manifest_detects_post_binding_tamper(tmp_path: Path):
    report = tmp_path / "report.json"
    _write_json(report, {"ok": True})
    manifest = build_output_binding_manifest(
        repo=tmp_path,
        rc_id="RC",
        attempt_id="ATTEMPT",
        verdict="FAILED_HOLDOUT_QUALITY",
        lock_semantic_sha256="1" * 64,
        lock_raw_sha256="2" * 64,
        artifacts={"report": (report, JSON_KIND)},
        required_artifact_names={"report"},
    )
    _write_json(report, {"ok": False})
    verified = verify_output_binding_manifest(manifest, repo=tmp_path)
    assert verified["ok"] is False
    assert any("artifact_raw_sha256_mismatch:report" in error for error in verified["errors"])


def test_output_manifest_rejects_incomplete_artifact_set(tmp_path: Path):
    report = tmp_path / "report.json"
    _write_json(report, {"ok": True})
    with pytest.raises(R3N6OutputBindingError, match="artifact_name_set_mismatch"):
        build_output_binding_manifest(
            repo=tmp_path,
            rc_id="RC",
            attempt_id="ATTEMPT",
            verdict="FAILED_HOLDOUT_QUALITY",
            lock_semantic_sha256="1" * 64,
            lock_raw_sha256="2" * 64,
            artifacts={"report": (report, JSON_KIND)},
            required_artifact_names={"report", "predictions"},
        )


def test_output_manifest_semantic_field_is_verified(tmp_path: Path):
    report = tmp_path / "report.json"
    _write_json(report, {"ok": True})
    manifest = build_output_binding_manifest(
        repo=tmp_path,
        rc_id="RC",
        attempt_id="ATTEMPT",
        verdict="FAILED_HOLDOUT_QUALITY",
        lock_semantic_sha256="1" * 64,
        lock_raw_sha256="2" * 64,
        artifacts={"report": (report, JSON_KIND)},
        required_artifact_names={"report"},
    )
    manifest["manifest_semantic_sha256"] = "0" * 64
    verified = verify_output_binding_manifest(manifest, repo=tmp_path)
    assert verified["ok"] is False
    assert "manifest_semantic_field_mismatch" in verified["errors"]


def test_output_manifest_rejects_aliased_artifact_paths(tmp_path: Path):
    shared = tmp_path / "shared.json"
    _write_json(shared, {"ok": True})
    with pytest.raises(R3N6OutputBindingError, match="artifact_paths_must_be_unique"):
        build_output_binding_manifest(
            repo=tmp_path,
            rc_id="RC",
            attempt_id="ATTEMPT",
            verdict="FAILED_HOLDOUT_QUALITY",
            lock_semantic_sha256="1" * 64,
            lock_raw_sha256="2" * 64,
            artifacts={
                "first": (shared, JSON_KIND),
                "second": (shared, JSON_KIND),
            },
            required_artifact_names={"first", "second"},
        )
