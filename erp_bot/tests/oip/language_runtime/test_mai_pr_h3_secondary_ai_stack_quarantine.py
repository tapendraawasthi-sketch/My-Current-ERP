"""PR-H3 — secondary AI stack + Falcon orphan UI quarantine (ADR_0094)."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from oip.domain.constitution.ai_stack_mount_policy import PRIMARY_CHAT_ROUTE
from oip.modules.conversation.application.secondary_ai_stack_quarantine_policy import (
    AUTHORITY,
    DECISION,
    DISPOSITION,
    assert_secondary_ai_stack_quarantine_honesty,
    load_run_status,
    load_secondary_ai_stack_quarantine_registry,
    secondary_ai_stack_quarantine_observability,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_and_honesty() -> None:
    reg = load_secondary_ai_stack_quarantine_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["disposition"] == DISPOSITION
    assert reg["deletion_in_this_ship"] is False
    assert reg["gap_p1_001"]["closed"] is False
    assert reg["gap_p3_001"]["closed"] is False
    assert reg["primary_chat_route"] == PRIMARY_CHAT_ROUTE
    assert len(reg["stacks"]) >= 4
    assert len(reg["falcon_orphan_ui"]) >= 3
    assert_secondary_ai_stack_quarantine_honesty()
    with pytest.raises(RuntimeError, match="GAP_FALSE_CLOSED"):
        assert_secondary_ai_stack_quarantine_honesty({"gap_p1_001_closed": True})
    with pytest.raises(RuntimeError, match="GAP_P3_FALSE_CLOSED"):
        assert_secondary_ai_stack_quarantine_honesty({"gap_p3_001_closed": True})
    with pytest.raises(RuntimeError, match="FALSE_DELETE"):
        assert_secondary_ai_stack_quarantine_honesty({"secondary_deleted": True})
    with pytest.raises(RuntimeError, match="FALCON_FALSE_DELETE"):
        assert_secondary_ai_stack_quarantine_honesty({"falcon_tree_deleted": True})
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_secondary_ai_stack_quarantine_honesty({"production_approved": True})


def test_modules_falcon_orphan_and_pointer() -> None:
    run = load_run_status()
    assert run["engineering_pack_ready"] is True
    assert run["deletion_in_this_ship"] is False
    reg = load_secondary_ai_stack_quarantine_registry()
    for stack in reg["stacks"]:
        mod = ROOT / stack["module"]
        assert mod.is_file(), stack["module"]
    for item in reg["falcon_orphan_ui"]:
        path = ROOT / item["path"]
        assert path.is_file(), item["path"]

    # Orphan UI: no imports from outside falcon component files
    src_root = ROOT / "src"
    for item in reg["falcon_orphan_ui"]:
        stem = Path(item["path"]).stem  # FalconPanel
        pattern = re.compile(
            rf"(from\s+['\"].*{stem}['\"]|import\s+{stem}\b)"
        )
        offenders: list[str] = []
        for ts in src_root.rglob("*.tsx"):
            rel = ts.relative_to(ROOT).as_posix()
            if rel.startswith("src/components/falcon/"):
                continue
            text = ts.read_text(encoding="utf-8", errors="ignore")
            if pattern.search(text):
                offenders.append(rel)
        for ts in src_root.rglob("*.ts"):
            rel = ts.relative_to(ROOT).as_posix()
            if rel.startswith("src/components/falcon/") or "/__tests__/" in rel:
                continue
            if "deadParallelAiQuarantinePolicy" in rel:
                continue
            text = ts.read_text(encoding="utf-8", errors="ignore")
            if pattern.search(text):
                offenders.append(rel)
        assert offenders == [], f"{stem} imported outside falcon: {offenders}"

    obs = secondary_ai_stack_quarantine_observability()
    assert obs["quarantine_adr"] == "ADR_0094"
    assert obs["prod_secondary_allowed_default"] is False
    assert obs["gap_p1_001_closed"] is False
    assert obs["gap_p3_001_closed"] is False
    assert obs["falcon_orphan_ui_count"] >= 3

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1-ARM"
    assert "PR-H3" in ledger.get("completed_next_steps", [])
    assert ledger.get("secondary_ai_stack_quarantine", {}).get("authority") == "ADR_0094"

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1-ARM" in plan
    assert "last_shipped_step = PR-D1" in plan
    assert "production_approved = false" in plan

    art = ROOT / "artifacts" / "prod-ready-pr-h3"
    assert (art / "RUN_STATUS.json").is_file()
    assert (art / "SIGN_NOTE.md").is_file()
