"""PR-H4 / ADR_0095 — forbid vacuous greens / assertion weakening in evals."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

from oip.modules.language_runtime.transliteration.application.r3h2_scoring_contracts import (
    EvaluationPopulation,
    GateOutcome,
    build_metric,
    evaluate_gate,
    metric_value,
)

AUTHORITY = "ADR_0095"
STEP = "PR-H4"
DECISION = "VACUOUS_GREEN_FORBID"
EXTENDS = "ADR_0089"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root()
        / "docs"
        / "mokxya-ai"
        / "MAI_VACUOUS_GREEN_FORBID_REGISTRY.json"
    )


def run_status_path() -> Path:
    return _repo_root() / "artifacts" / "prod-ready-pr-h4" / "RUN_STATUS.json"


@lru_cache(maxsize=1)
def load_vacuous_green_forbid_registry() -> dict[str, Any]:
    data = json.loads(registry_path().read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("VACUOUS_GREEN_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("VACUOUS_GREEN_DECISION_MISMATCH")
    return data


def load_run_status() -> dict[str, Any]:
    return json.loads(run_status_path().read_text(encoding="utf-8"))


def empty_required_population_outcome() -> GateOutcome:
    """Prove empty required population cannot PASS (no vacuous green)."""
    pop = EvaluationPopulation(
        population_id="PR_H4_EMPTY_REQUIRED",
        case_ids=(),
        required=True,
    )
    metric = build_metric(
        metric_id="pr_h4_empty_required_probe",
        population=pop,
        numerator=0,
        threshold=0.95,
        operation=">=",
    )
    return evaluate_gate(metric).outcome


def assert_governed_contracts_on_disk() -> None:
    reg = load_vacuous_green_forbid_registry()
    markers = list(reg.get("required_contract_markers") or [])
    root = _repo_root()
    for rel in reg.get("governed_contract_modules") or []:
        path = root / rel
        if not path.is_file():
            raise RuntimeError(f"VACUOUS_GREEN_CONTRACT_MISSING:{rel}")
        text = path.read_text(encoding="utf-8", errors="ignore")
        for marker in markers:
            if marker not in text:
                raise RuntimeError(f"VACUOUS_GREEN_MARKER_MISSING:{rel}:{marker}")


def vacuous_green_forbid_observability() -> dict[str, Any]:
    reg = load_vacuous_green_forbid_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    outcome = empty_required_population_outcome()
    return {
        "vacuous_green_step": STEP,
        "vacuous_green_adr": AUTHORITY,
        "vacuous_green_decision": reg["decision"],
        "extends": EXTENDS,
        "vacuous_greens_allowed": bool(honesty.get("vacuous_greens_allowed")),
        "assertion_weakening_allowed": bool(
            honesty.get("assertion_weakening_allowed")
        ),
        "legacy_scorers_all_rewritten": bool(
            honesty.get("legacy_scorers_all_rewritten")
        ),
        "production_approved": bool(honesty.get("production_approved")),
        "empty_required_outcome": outcome.value,
        "metric_value_zero_denom_is_none": metric_value(0, 0) is None,
        "governed_contract_count": len(reg.get("governed_contract_modules") or []),
        "run_pack_ready": bool(run.get("engineering_pack_ready")),
        "is_execution_authority": False,
    }


def assert_vacuous_green_forbid_honesty(
    claim: Mapping[str, Any] | None = None,
) -> None:
    reg = load_vacuous_green_forbid_registry()
    run = load_run_status()
    honesty = reg.get("honesty") or {}
    if honesty.get("vacuous_greens_allowed") is True:
        raise RuntimeError("VACUOUS_GREENS_ALLOWED")
    if honesty.get("assertion_weakening_allowed") is True:
        raise RuntimeError("ASSERTION_WEAKENING_ALLOWED")
    if honesty.get("legacy_scorers_all_rewritten") is True:
        raise RuntimeError("LEGACY_SCORERS_FALSE_REWRITTEN")
    if honesty.get("production_approved") is True or run.get(
        "production_approved"
    ) is True:
        raise RuntimeError("VACUOUS_GREEN_PRODUCTION_APPROVED")
    if honesty.get("quality_gates_re_run_claimed") is True:
        raise RuntimeError("QUALITY_GATES_FALSE_RERUN")
    if run.get("vacuous_greens_allowed") is True:
        raise RuntimeError("VACUOUS_GREENS_ALLOWED")
    outcome = empty_required_population_outcome()
    if outcome is GateOutcome.PASS:
        raise RuntimeError("VACUOUS_GREEN_EMPTY_REQUIRED_PASS")
    if outcome is not GateOutcome.INVALID_REQUIRED_POPULATION:
        raise RuntimeError(f"VACUOUS_GREEN_UNEXPECTED_OUTCOME:{outcome.value}")
    if metric_value(0, 0) is not None:
        raise RuntimeError("VACUOUS_GREEN_METRIC_VALUE_ZERO_DENOM")
    assert_governed_contracts_on_disk()
    if not claim:
        return
    if claim.get("vacuous_greens_allowed") is True:
        raise RuntimeError("VACUOUS_GREENS_ALLOWED")
    if claim.get("assertion_weakening_allowed") is True:
        raise RuntimeError("ASSERTION_WEAKENING_ALLOWED")
    if claim.get("legacy_scorers_all_rewritten") is True:
        raise RuntimeError("LEGACY_SCORERS_FALSE_REWRITTEN")
    if claim.get("production_approved") is True:
        raise RuntimeError("VACUOUS_GREEN_PRODUCTION_APPROVED")
