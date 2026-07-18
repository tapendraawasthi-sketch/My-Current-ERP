"""MAI-07R3G protocol — blocked preflight; no frozen V2 consumption."""

from __future__ import annotations

import json
from pathlib import Path

from src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    ENGLISH_IDENTITY_GUARD_VERSION,
    RUNTIME_VERSION,
)
from src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3g import (
    EXPECTED,
    immutability_preflight,
    rc_content_hash,
    recompute_v1_hash,
    recompute_v2_hash,
    validate_r3f_holdout_evidence,
    write_preflight_bundle,
)

REPO = Path(__file__).resolve().parents[4]
R3G = REPO / "evals/mai07/r3g"


def test_runtime_claims_r3f_but_r3g_does_not_mutate_overlay():
    assert RUNTIME_VERSION == "mai-07.1.3-r3f-sealnew"
    assert ENABLE_PROMOTION_OVERLAY is False
    assert ENGLISH_IDENTITY_GUARD_VERSION == "mai-07-r3f.1.0.0"


def test_frozen_v1_v2_and_r3f_rc_manifest_hashes_stable():
    assert recompute_v1_hash(REPO) == EXPECTED["v1"]
    assert recompute_v2_hash(REPO) == EXPECTED["v2"]
    assert rc_content_hash(REPO) == EXPECTED["rc_content"]


def test_r3e_failed_attempt_preserved():
    att = json.loads(
        (REPO / "evals/mai07/r3e/MAI_07R3E_FROZEN_V2_ATTEMPT.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    assert att["status"] == "FAILED_QUALITY"
    assert att["manifest_content_sha256"] == EXPECTED["r3e_attempt"]
    assert att.get("prohibited_rerun") is True


def test_preflight_blocks_on_resource_pack_drift():
    hold = validate_r3f_holdout_evidence(REPO)
    imm = immutability_preflight(REPO)
    # Holdout prediction field is valid under producer canonical-list contract.
    assert hold["ok"] is True, hold.get("missing")
    assert hold["predictions_sha256_canonical_list"] == EXPECTED["holdout_pred_reported"]
    # Resource pack bytes remain unrestorable vs sealed claim.
    assert imm["ok"] is False
    assert any(e.startswith("resource_raw:") for e in imm["errors"])
    assert any(e.startswith("resource_lf_unrecoverable:") for e in imm["errors"])


def test_preflight_bundle_records_block_and_no_frozen_open():
    bundle = write_preflight_bundle(REPO)
    assert bundle["status"] == "BLOCKED_PRECONDITION_FAILED"
    assert bundle["frozen_v2_opened"] is False
    assert bundle["one_shot_executed"] is False
    assert bundle["attempt_locked"] is False
    assert bundle["holdout"]["ok"] is True
    assert bundle["immutability"]["ok"] is False
    path = R3G / "reports/MAI_07R3G_PREFLIGHT_REPORT.json"
    assert path.exists()
    # No attempt / prediction artifacts for a consumed one-shot
    assert not (R3G / "MAI_07R3G_FROZEN_V2_ATTEMPT.manifest.json").exists()
    assert not (R3G / "reports/MAI_07R3G_V2_ONE_SHOT_PREDICTIONS.jsonl").exists()


def test_lock_and_execute_refuse_when_blocked():
    import subprocess
    import sys

    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3g",
            "--execute",
        ],
        cwd=str(REPO / "erp_bot"),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 2
    payload = json.loads(proc.stdout)
    assert payload["status"] == "BLOCKED_PRECONDITION_FAILED"
