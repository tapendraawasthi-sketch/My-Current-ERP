"""NEXT-03 — production AI stack strangler (ADR_0073 / GAP-P1-001)."""

from __future__ import annotations

import json
from pathlib import Path

from oip.domain.constitution.ai_stack_mount_policy import (
    AUTHORITY,
    PRIMARY_CHAT_ROUTE,
    secondary_ai_stacks_allowed,
    secondary_stack_denial_payload,
)

ROOT = Path(__file__).resolve().parents[4]


def test_production_disables_secondary_by_default() -> None:
    assert (
        secondary_ai_stacks_allowed(
            environ={"NODE_ENV": "production", "RENDER": "true"}
        )
        is False
    )
    assert (
        secondary_ai_stacks_allowed(environ={"APP_ENV": "production"}) is False
    )


def test_non_production_allows_secondary_for_dx() -> None:
    assert (
        secondary_ai_stacks_allowed(
            environ={"NODE_ENV": "development", "APP_ENV": "dev"}
        )
        is True
    )


def test_break_glass_reenable_in_production() -> None:
    assert (
        secondary_ai_stacks_allowed(
            environ={
                "NODE_ENV": "production",
                "MOKXYA_ALLOW_SECONDARY_AI_STACKS": "true",
            }
        )
        is True
    )


def test_denial_payload_points_at_primary() -> None:
    payload = secondary_stack_denial_payload("NIOS_V1")
    assert payload["error"] == "SECONDARY_AI_STACK_DISABLED"
    assert payload["authority"] == AUTHORITY
    assert payload["primary_route"] == PRIMARY_CHAT_ROUTE
    assert payload["gap"] == "GAP-P1-001"


def test_adr_gap_ledger_updated() -> None:
    adr = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "decisions"
        / "ADR_0073_PRODUCTION_AI_STACK_STRANGLER.md"
    )
    assert adr.is_file()
    assert "GAP-P1-001" in adr.read_text(encoding="utf-8")

    gap = (ROOT / "docs" / "mokxya-ai" / "MAI_00_GAP_REGISTER.md").read_text(
        encoding="utf-8"
    )
    section = gap.split("### GAP-P1-001")[1].split("### ")[0]
    assert "**Status:** REDUCED" in section

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-B5"
    assert ledger["ai_stack_strangler"]["authority"] == "ADR_0073"
    assert ledger["ai_stack_strangler"]["primary_chat_route"] == (
        PRIMARY_CHAT_ROUTE
    )
