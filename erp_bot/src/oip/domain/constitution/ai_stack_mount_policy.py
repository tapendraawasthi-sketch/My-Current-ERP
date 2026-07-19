"""NEXT-03 / ADR_0073 — production AI stack mount policy (GAP-P1-001).

Primary user-facing intelligence entry remains Orbix OIP chat ingress.
Secondary parallel AI HTTP stacks are disabled in production unless an
explicit break-glass env flag is set.
"""

from __future__ import annotations

import os
from typing import Mapping

from .config_guard import is_production_environment

AUTHORITY = "ADR_0073"
STEP = "NEXT-03"

# Canonical product chat entry (SPA Ask / Accountant stream).
PRIMARY_CHAT_ROUTE = "/orbix/chat/stream"

SECONDARY_STACK_IDS = (
    "NIOS_V1",
    "ORBIX_V2",
    "LEGACY_V2_CHAT",
    "LEGACY_V2_CHAT_STREAM",
)

_BREAK_GLASS = "MOKXYA_ALLOW_SECONDARY_AI_STACKS"


def secondary_ai_stacks_allowed(
    *,
    environ: Mapping[str, str] | None = None,
) -> bool:
    """Return True when NIOS / Orbix-v2 / legacy v2 chat may be mounted.

    Production default: False.
    Non-production default: True (local DX).
    Break-glass: MOKXYA_ALLOW_SECONDARY_AI_STACKS=true (any env).
    """
    env = environ if environ is not None else os.environ
    flag = (env.get(_BREAK_GLASS) or "").strip().lower()
    if flag in {"1", "true", "yes"}:
        return True
    if is_production_environment(environ=dict(env)):
        return False
    return True


def secondary_stack_denial_payload(stack_id: str) -> dict[str, object]:
    return {
        "error": "SECONDARY_AI_STACK_DISABLED",
        "stack_id": stack_id,
        "authority": AUTHORITY,
        "step": STEP,
        "gap": "GAP-P1-001",
        "primary_route": PRIMARY_CHAT_ROUTE,
        "detail": (
            "Parallel AI stack is not mounted/served in production. "
            f"Use {PRIMARY_CHAT_ROUTE}. Set {_BREAK_GLASS}=true only for "
            "explicit break-glass."
        ),
    }


def ai_stack_mount_observability(
    *,
    environ: Mapping[str, str] | None = None,
) -> dict[str, object]:
    allowed = secondary_ai_stacks_allowed(environ=environ)
    prod = is_production_environment(
        environ=dict(environ) if environ is not None else None
    )
    return {
        "ai_stack_mount_authority": AUTHORITY,
        "ai_stack_mount_step": STEP,
        "production_environment": prod,
        "secondary_ai_stacks_allowed": allowed,
        "primary_chat_route": PRIMARY_CHAT_ROUTE,
        "secondary_stack_ids": list(SECONDARY_STACK_IDS),
        "break_glass_env": _BREAK_GLASS,
        "gap_p1_001_register_status": "REDUCED" if not allowed or not prod else "OPEN",
        "production_approved": False,
    }


__all__ = [
    "AUTHORITY",
    "PRIMARY_CHAT_ROUTE",
    "SECONDARY_STACK_IDS",
    "STEP",
    "ai_stack_mount_observability",
    "secondary_ai_stacks_allowed",
    "secondary_stack_denial_payload",
]
