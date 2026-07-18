"""MAI-07R3E protocol tests — no frozen case-body inspection; no runtime mutation."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    RUNTIME_VERSION,
)
from src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3e import (
    EXPECTED,
    immutability_preflight,
    rc_content_hash,
    recompute_v1_hash,
    recompute_v2_hash,
    validate_holdout_evidence,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)

REPO = Path(__file__).resolve().parents[4]
R3E = REPO / "evals/mai07/r3e"


def test_active_runtime_preserves_sealed_r3d_parent_for_r3e():
    from src.oip.modules.language_runtime.transliteration import (
        PARENT_R3D_RC_HASH,
        PARENT_R3D_RESOURCE_HASH,
        PARENT_R3D_RUNTIME_VERSION,
    )

    assert RUNTIME_VERSION.startswith("mai-07.")
    assert ENABLE_PROMOTION_OVERLAY is False
    assert PARENT_R3D_RUNTIME_VERSION == EXPECTED["runtime"]
    assert PARENT_R3D_RESOURCE_HASH == EXPECTED["resource"]
    assert PARENT_R3D_RC_HASH == EXPECTED["rc_content"]
    rc = json.loads(
        (REPO / "evals/mai07_r3d_corrective/MAI_07R3D_RELEASE_CANDIDATE.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    assert rc["resource_content_hash"] == EXPECTED["resource"]
    assert rc["runtime_version"] == EXPECTED["runtime"]


def test_holdout_evidence_complete():
    hold = validate_holdout_evidence(REPO)
    assert hold["ok"] is True, hold.get("missing")
    assert hold["predictions_sha256"] == EXPECTED["holdout_pred"]


def test_immutability_gate():
    imm = immutability_preflight(REPO)
    assert imm["ok"] is True, imm.get("errors")
    assert recompute_v1_hash(REPO) == EXPECTED["v1"]
    assert recompute_v2_hash(REPO) == EXPECTED["v2"]
    assert rc_content_hash(REPO) == EXPECTED["rc_content"]


def test_attempt_consumed_and_predictions_sealed():
    att_path = R3E / "MAI_07R3E_FROZEN_V2_ATTEMPT.manifest.json"
    assert att_path.exists()
    att = json.loads(att_path.read_text(encoding="utf-8"))
    assert att["status"] in {"PASSED", "FAILED_QUALITY", "INVALID_OR_BLOCKED", "FAILED_PREDICTION_VALIDATION"}
    assert att.get("prohibited_rerun") is True
    pred = R3E / "reports/MAI_07R3E_V2_ONE_SHOT_PREDICTIONS.jsonl"
    assert pred.exists()
    digest = hashlib.sha256(pred.read_bytes()).hexdigest()
    assert digest == att["predictions_sha256"]
    lines = [ln for ln in pred.read_text(encoding="utf-8").splitlines() if ln.strip()]
    assert len(lines) == 696


def test_canonical_and_audit_reports_exist_and_agree_flag():
    canon = json.loads(
        (R3E / "reports/MAI_07R3E_V2_CANONICAL_SCORE_REPORT.json").read_text(encoding="utf-8")
    )
    audit = json.loads(
        (R3E / "reports/MAI_07R3E_V2_AUDIT_SCORE_REPORT.json").read_text(encoding="utf-8")
    )
    assert audit["agrees_with_canonical"] is True
    assert canon["LINGUIST_APPROVED"] is False
    assert canon["PRODUCTION_APPROVED"] is False
    # Dual files present after one-shot
    assert (R3E / "reports/MAI_07R3E_R3C_DIFFERENTIAL.json").exists()


def test_r3e_does_not_modify_r3c_scorers_or_r3d_rc():
    scorers = [
        REPO
        / "erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_scoring_r3c.py",
        REPO
        / "erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_audit_scorer_r3c.py",
    ]
    for p in scorers:
        assert p.exists()
    assert rc_content_hash(REPO) == EXPECTED["rc_content"]
