"""MAI-07R3G-REAUTHORIZED protocol — blocked on missing lock-before-holdout body."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    RUNTIME_VERSION,
)
from src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3g_reauthorized import (
    EXPECTED,
    execute_refuse_if_blocked,
    find_lock_before_holdout_artifact,
    lock_attempt_refuse_if_blocked,
    validate_lineage,
    write_preflight_bundle,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)

REPO = Path(__file__).resolve().parents[4]
OUT = REPO / "evals/mai07/r3g_reauthorized"


def test_active_runtime_is_sealnew_not_invalidated_r3f():
    assert RUNTIME_VERSION == "mai-07.1.13-r3s-active"
    assert ENABLE_PROMOTION_OVERLAY is False
    assert "mai-07.1.11-r3n6-chaincomplete" in str(xlrr.RESOURCES_DIR)
    assert xlrr.compute_pack_content_hash() == EXPECTED["resource"]


def test_lock_before_holdout_body_present_in_immutable_file():
    lock = find_lock_before_holdout_artifact(REPO)
    assert lock["ok"] is True
    assert lock["target_hash"] == EXPECTED["rc_lock_before_holdout"]
    assert any(h["match"] == "immutable_locked_not_run_file" for h in lock["immutable_hits"])


def test_lineage_sound_with_recovered_lock_chain():
    lin = validate_lineage(REPO)
    assert lin["lock_chain"]["ok"] is True
    assert lin["post_holdout_rc_manifest_sha256"] == EXPECTED["rc_post_holdout_semantic"]
    assert lin["resource_content_sha256"] == EXPECTED["resource"]
    assert lin["fresh_predictions_canonical"] == EXPECTED["fresh_pred_canon"]


def test_preflight_blocks_and_does_not_open_frozen_v2():
    path = OUT / "reports/MAI_07R3G_REAUTHORIZED_PREFLIGHT_REPORT.json"
    obj = json.loads(path.read_text(encoding="utf-8"))
    assert obj["status"] == "BLOCKED_PRECONDITION_FAILED"
    assert obj["frozen_v2_opened"] is False
    assert obj["attempt_locked"] is False
    assert obj["one_shot_executed"] is False
    assert obj["quality_verdict"] is None
    assert not (OUT / "MAI_07R3G_REAUTHORIZED_FROZEN_V2_ATTEMPT.manifest.json").exists()


def test_lock_and_execute_refuse_until_r3g_002_implemented():
    with pytest.raises(NotImplementedError):
        lock_attempt_refuse_if_blocked(REPO)
    assert (OUT / "MAI_07R3G_REAUTHORIZED_FROZEN_V2_ATTEMPT.manifest.json").exists() is False


def test_blocked_historical_r3g_not_overwritten():
    hist = REPO / "evals/mai07/r3g/reports/MAI_07R3G_PREFLIGHT_REPORT.json"
    assert hist.exists()
    obj = json.loads(hist.read_text(encoding="utf-8"))
    assert obj["status"] == "BLOCKED_PRECONDITION_FAILED"
    assert obj["frozen_v2_opened"] is False
