"""PR-D2 / ADR_0098 — language defect burn-down pack (not collected yet)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0098"
STEP = "PR-D2"
DECISION = "LANGUAGE_DEFECT_BURNDOWN_PACK"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "MAI_LANGUAGE_DEFECT_BURNDOWN_REGISTRY.json"
    )


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-d2" / "RUN_STATUS.json"


def procedure_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "releases"
        / "LANGUAGE_DEFECT_BURNDOWN_V1.md"
    )


@lru_cache(maxsize=1)
def load_language_defect_burndown_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("LANG_BURNDOWN_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("LANG_BURNDOWN_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def language_defect_burndown_observability() -> dict[str, Any]:
    reg = load_language_defect_burndown_registry()
    run = load_run_status()
    text = procedure_path().read_text(encoding="utf-8")
    return {
        "lang_burndown_step": STEP,
        "lang_burndown_adr": AUTHORITY,
        "lang_burndown_decision": reg["decision"],
        "pack_ready": True,
        "defects_collected": False,
        "burn_down_complete": False,
        "assertion_weakening_allowed": False,
        "production_approved": False,
        "doc_forbids_weaken": "Never" in text and "weaken" in text.lower(),
        "languages": list(reg.get("languages") or []),
        "run_pack_ready": bool(run.get("pack_ready")),
        "is_execution_authority": False,
    }


def assert_language_defect_burndown_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_language_defect_burndown_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    if honesty.get("production_approved") is True or run.get("production_approved") is True:
        raise RuntimeError("LANG_BURNDOWN_PRODUCTION_APPROVED")
    if honesty.get("defects_collected") is True or run.get("defects_collected") is True:
        raise RuntimeError("LANG_BURNDOWN_FALSE_COLLECTED")
    if honesty.get("burn_down_complete") is True or run.get("burn_down_complete") is True:
        raise RuntimeError("LANG_BURNDOWN_FALSE_COMPLETE")
    if (
        honesty.get("assertion_weakening_allowed") is True
        or run.get("assertion_weakening_allowed") is True
    ):
        raise RuntimeError("LANG_BURNDOWN_ASSERTION_WEAKENING")
    if not procedure_path().is_file():
        raise RuntimeError("LANG_BURNDOWN_PROCEDURE_MISSING")
    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("LANG_BURNDOWN_PRODUCTION_APPROVED")
    if claim.get("defects_collected") is True:
        raise RuntimeError("LANG_BURNDOWN_FALSE_COLLECTED")
    if claim.get("burn_down_complete") is True:
        raise RuntimeError("LANG_BURNDOWN_FALSE_COMPLETE")
    if claim.get("assertion_weakening_allowed") is True:
        raise RuntimeError("LANG_BURNDOWN_ASSERTION_WEAKENING")
