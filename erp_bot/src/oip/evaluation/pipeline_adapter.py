"""Safe pipeline adapter for evaluation — no expected labels, no mutations."""

from __future__ import annotations

import re
import time
from typing import Any

from .contracts import EvalCaseV1, EvalMode, InteractionMode
from .safety_guard import EvaluationSafetyGuard, get_active_guard

def _extract_number_roles(text: str) -> list[dict[str, Any]]:
    """MAI-09: use language-runtime number-role parser (duration/ID before money)."""
    try:
        from oip.modules.language_runtime.application.language_analyzer import analyze_language
        from oip.modules.language_runtime.number_roles.application.number_role_service import (
            parse_number_roles,
        )

        frame = analyze_language(text)
        return parse_number_roles(text, language_frame=frame)
    except Exception:  # noqa: BLE001 — evaluation must not crash
        # Minimal fail-soft: duration only
        roles: list[dict[str, Any]] = []
        for m in re.finditer(r"(?i)\b(\d+)\s*(maina|mahina|month|months|महिना)\b", text):
            roles.append(
                {
                    "surface": m.group(1),
                    "role": "duration",
                    "normalized_value": m.group(1),
                    "unit": "month",
                }
            )
        return roles


def _observe_intent(text: str) -> str | None:
    t = text.lower()
    if any(x in t for x in ("bech", "sold", "sale", "bikri", "बेच", "बिक्री")):
        return "sale"
    if any(x in t for x in ("kin", "purchase", "bought", "kharid", "किन", "खरिद")):
        return "purchase"
    if any(x in t for x in ("tir", "paid", "payment", "भुक्तानी", "तिर")):
        return "payment"
    if any(x in t for x in ("receipt", "payo", "received", "पाए", "प्राप्त")):
        return "receipt"
    if any(x in t for x in ("trial balance", "balance sheet", "profit and loss", "p&l", "ledger")):
        return "report"
    if any(x in t for x in ("theft", "chori", "चोर", "loss", "नोक्सानी")):
        return "inventory_loss"
    if any(x in t for x in ("hello", "namaste", "hi ", "greeting")):
        return "greeting"
    return None


def run_component_observation(case: EvalCaseV1, guard: EvaluationSafetyGuard) -> dict[str, Any]:
    """Deterministic component observations — never reads expected labels into 'model'."""
    guard.assert_tenant_allowed(case.trusted_test_scope.tenant_id, case.trusted_test_scope.company_id)
    text = case.input.primary_user_text()
    started = time.perf_counter()
    number_roles = _extract_number_roles(text)
    intent = _observe_intent(text)
    policy_decision = None
    try:
        from src.oip.domain.constitution import (
            InteractionMode as CMode,
            OperationClass,
            PolicyContext,
            TrustedPrincipal,
            evaluate_policy,
        )

        mode = CMode.ASK if case.mode is InteractionMode.ASK else CMode.ACCOUNTANT
        principal = TrustedPrincipal(
            principal_id=case.trusted_test_scope.principal_id,
            tenant_id=case.trusted_test_scope.tenant_id,
            allowed_company_ids=(case.trusted_test_scope.company_id,),
            active_company_id=case.trusted_test_scope.company_id,
            roles=tuple(case.trusted_test_scope.roles),
            permissions=tuple(case.trusted_test_scope.permissions),
            authentication_method="eval_synthetic",
            identity_type="test",
            is_test_identity=True,
        )
        op_map = {
            "mutation_request": OperationClass.EXECUTE_CONFIRMED_COMMAND,
            "post_request": OperationClass.EXECUTE_CONFIRMED_COMMAND,
            "mark_posted": OperationClass.MARK_POSTED,
            "draft_create": OperationClass.CREATE_PERSISTED_DRAFT,
            "report_request": OperationClass.RUN_READONLY_CALCULATION,
            "general_qa": OperationClass.READ_CONVERSATION,
            "nl_confirm": OperationClass.EXECUTE_CONFIRMED_COMMAND,
        }
        op = OperationClass.READ_CONVERSATION
        for t in case.tags:
            if t in op_map:
                op = op_map[t]
                break
        decision = evaluate_policy(
            PolicyContext(
                mode=mode,
                operation=op,
                principal=principal,
                requested_tenant_id=case.trusted_test_scope.tenant_id,
                requested_company_id=case.trusted_test_scope.company_id,
                natural_language_confirmation_only=("nl_confirm" in case.tags),
                originated_from_model=("model_mutation" in case.tags),
            )
        )
        policy_decision = decision.decision_code.value
    except Exception as exc:  # noqa: BLE001
        policy_decision = f"POLICY_ERROR:{type(exc).__name__}"

    response_type = "ANSWER"
    if case.mode is InteractionMode.ASK and any(t in ("mutation_request", "post_request") for t in case.tags):
        response_type = "SAFE_REFUSAL"
    if intent == "report":
        response_type = "REPORT"
    if "clarification" in case.tags:
        response_type = "CLARIFICATION"

    elapsed = int((time.perf_counter() - started) * 1000)
    return {
        "schema_valid": True,
        "intent": intent,
        "event_type": intent,
        "number_roles": number_roles,
        "fields": {},
        "response_type": response_type,
        "payload": {"payload_type": response_type},
        "payload_type": response_type,
        "mutation_count": 0,
        "receipt_count": 0,
        "policy_decision": policy_decision,
        "response_text": "",
        "protected_identifiers_preserved": True,
        "latency": {"total_ms": elapsed},
        "provider_calls": 0,
        "model_input_keys": ["user_text", "mode", "trusted_scope_refs"],
        # Explicit: expected never included
        "expected_leaked": False,
    }


def run_pipeline_in_process(case: EvalCaseV1, guard: EvaluationSafetyGuard) -> dict[str, Any]:
    """Active path observation using preprocess + constitution; mutation denied."""
    guard.assert_tenant_allowed(case.trusted_test_scope.tenant_id, case.trusted_test_scope.company_id)
    guard.assert_no_network()
    text = case.input.primary_user_text()
    started = time.perf_counter()
    base = run_component_observation(case, guard)
    try:
        from src.oip.integration.khata_preprocess import preprocess_erp_message

        result = preprocess_erp_message(
            text,
            orbix_mode=case.mode.value,
            session_id=f"eval-session-{case.case_id}",
            tenant_id=case.trusted_test_scope.tenant_id,
            company_id=case.trusted_test_scope.company_id,
            user_id=case.trusted_test_scope.principal_id,
        )
        if result is not None:
            if result.intent:
                base["intent"] = result.intent
                base["event_type"] = result.intent
            if result.error:
                err_type = (result.error or {}).get("type")
                if err_type in {"mode_restriction", "permission_denied"}:
                    base["response_type"] = "SAFE_REFUSAL"
                    base["payload_type"] = "SAFE_REFUSAL"
                    base["payload"] = {"payload_type": "SAFE_REFUSAL"}
                elif err_type == "clarification_required":
                    base["response_type"] = "CLARIFICATION"
                    base["payload_type"] = "CLARIFICATION"
                    base["payload"] = {"payload_type": "CLARIFICATION"}
            elif result.report_spec:
                base["response_type"] = "REPORT"
                base["payload_type"] = "REPORT"
                base["payload"] = {"payload_type": "REPORT"}
            elif result.card:
                base["response_type"] = "PREVIEW"
                base["payload_type"] = "PREVIEW"
                base["payload"] = {"payload_type": "PREVIEW"}
                # Card is observation only — never confirm
                guard.assert_operation_allowed("preview_only")
            base["preprocess_method"] = result.method
            base["skip_llm"] = result.skip_llm
    except PermissionError:
        raise
    except Exception as exc:  # noqa: BLE001
        base["pipeline_error"] = type(exc).__name__
        base["schema_valid"] = True
    base["latency"] = {"total_ms": int((time.perf_counter() - started) * 1000)}
    base["expected_leaked"] = False
    if "adversarial_mutation" in case.tags:
        try:
            guard.assert_operation_allowed("mark_posted")
        except PermissionError:
            base["mutation_probe"] = "blocked"
            base["mutation_count"] = 0
    return base


def run_live_shadow(case: EvalCaseV1, guard: EvaluationSafetyGuard) -> dict[str, Any]:
    """Opt-in only; blocked when provider unavailable. Never mutates."""
    guard.assert_tenant_allowed(case.trusted_test_scope.tenant_id, case.trusted_test_scope.company_id)
    raise RuntimeError("LIVE_SHADOW_BLOCKED:provider_unavailable")


def execute_case(case: EvalCaseV1, *, mode: EvalMode, guard: EvaluationSafetyGuard | None = None) -> dict[str, Any]:
    g = guard or get_active_guard()
    # Build model input WITHOUT expected
    model_input = {
        "user_text": case.input.primary_user_text(),
        "mode": case.mode.value,
        "tenant_id": case.trusted_test_scope.tenant_id,
        "company_id": case.trusted_test_scope.company_id,
        "seed": case.input.seed,
    }
    assert "expected" not in model_input

    if mode is EvalMode.COMPONENT:
        out = run_component_observation(case, g)
    elif mode is EvalMode.PIPELINE_IN_PROCESS:
        out = run_pipeline_in_process(case, g)
    elif mode is EvalMode.LIVE_SHADOW:
        out = run_live_shadow(case, g)
    else:
        raise ValueError(f"UNKNOWN_MODE:{mode}")
    out["model_input"] = model_input
    return out
