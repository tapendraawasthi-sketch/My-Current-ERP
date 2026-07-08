"""
ERP action policy — maps training-time erp_action labels to runtime behavior.

Training JSONL rows carry erp_action metadata; this module is the single dispatcher
that decides whether to post, clarify, hold, report, escalate, or skip.
"""

from __future__ import annotations

import importlib.util
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from .engine import ParsedEntry

PolicyAction = Literal["post", "clarify", "hold", "no_post", "report", "escalate"]

# Snake-case ERP action token (allows digits; normalizes mixed-case training typos).
_ACTION_TOKEN = re.compile(r"^[a-z][a-z0-9_]*$", re.I)

_CLARIFY_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^request_", re.I),
    re.compile(r"^hold_", re.I),
    re.compile(r"^clarify_", re.I),
    re.compile(r"^confirm_.*_before", re.I),
    re.compile(r"_pending", re.I),
    re.compile(r"reject_insufficient", re.I),
    re.compile(r"do_not_post_request", re.I),
    re.compile(r"request_clarification", re.I),
)

_POST_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"^create_(sales|expense|receipt|payment|purchase|journal|vat|petty|bank|"
        r"stock|income|payroll|credit|sale|advance|loan|transfer|writeoff|adjustment|"
        r"fixed_asset|loss|theft|asset|receivable|opening|partial|reverse|compliance|"
        r"hr|misc|inventory|invoice|material|installment|institutional|deferred|"
        r"disposal|ecommerce|informal|final_settlement|billable|accrued|assembled|"
        r"daily_summary|cash_to_bank|entry)",
        re.I,
    ),
    re.compile(r"^post_", re.I),
    re.compile(r"^record_(sale|expense|payment|purchase|cash|repair|service)", re.I),
    re.compile(r"^reverse_", re.I),
)

_REPORT_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^generate_", re.I),
    re.compile(r"^export_", re.I),
    re.compile(r"^lookup_", re.I),
    re.compile(r"^provide_", re.I),
    re.compile(r"^suggest_", re.I),
    re.compile(r"^search_", re.I),
    re.compile(r"^trigger_", re.I),
    re.compile(r"^schedule_", re.I),
    re.compile(r"^execute_", re.I),
    re.compile(r"^calculate\b", re.I),
    re.compile(r"^check_", re.I),
    re.compile(r"^display_", re.I),
    re.compile(r"^show_", re.I),
    re.compile(r"^alert\b", re.I),
)

_ESCALATE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^flag_", re.I),
    re.compile(r"^escalate_", re.I),
    re.compile(r"^refuse_", re.I),
    re.compile(r"^advise_professional", re.I),
    re.compile(r"^do_not_post_flag", re.I),
)

_NO_POST_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^no_", re.I),
    re.compile(r"^log_", re.I),
    re.compile(r"^no_action", re.I),
    re.compile(r"^no_entry", re.I),
    re.compile(r"^no_accounting", re.I),
    re.compile(r"^no_financial", re.I),
    re.compile(r"^update_", re.I),
    re.compile(r"^route_", re.I),
    re.compile(r"^cancel_", re.I),
    re.compile(r"^return_", re.I),
    re.compile(r"^enable_", re.I),
    re.compile(r"^queue_", re.I),
    re.compile(r"^setup_", re.I),
    re.compile(r"^initiate_", re.I),
    re.compile(r"^decline_", re.I),
    re.compile(r"^defer", re.I),
    re.compile(r"^informational_", re.I),
    re.compile(r"^future_", re.I),
    re.compile(r"^seek_", re.I),
)

_FIELD_TO_SLOT: dict[str, str] = {
    "amount": "amount",
    "payment_mode": "payment_method",
    "customer_name": "party",
    "supplier_name": "party",
    "party_name": "party",
    "vendor_name": "party",
    "client_name": "party",
    "company_name": "party",
}


@dataclass(frozen=True)
class PolicyResult:
    policy_action: PolicyAction
    skip_posting: bool
    needs_clarification: bool
    escalate: bool
    required_slots: tuple[str, ...]
    clarification_question: str | None = None
    reason: str | None = None


@lru_cache(maxsize=1)
def get_non_transaction_erp_actions() -> frozenset[str]:
    """Load NON_TRANSACTION_ERP from ingest script (single source of truth)."""
    ingest_path = Path(__file__).resolve().parents[2] / "scripts" / "ingest_nepal_sector_knowledge.py"
    spec = importlib.util.spec_from_file_location("ingest_nepal_sector_knowledge", ingest_path)
    if spec is None or spec.loader is None:
        return frozenset()
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    raw = getattr(module, "NON_TRANSACTION_ERP", frozenset())
    return frozenset(str(x).lower() for x in raw)


def normalize_erp_action(erp_action: str | None) -> str:
    if not erp_action:
        return ""
    return str(erp_action).strip().lower().replace(" ", "_")


def is_structured_erp_action(erp_action: str) -> bool:
    """True when erp_action looks like a machine action code, not free-text advisory."""
    if not erp_action or len(erp_action) > 120:
        return False
    return bool(_ACTION_TOKEN.match(erp_action))


def _matches(patterns: tuple[re.Pattern[str], ...], action: str) -> bool:
    return any(p.search(action) for p in patterns)


def _infer_slots_from_action(action: str) -> list[str]:
    slots: list[str] = []
    if "payment_mode" in action or "payment_plan" in action:
        slots.append("payment_method")
    if "party" in action or "customer" in action or "supplier" in action or "vendor" in action:
        slots.append("party")
    if "amount" in action:
        slots.append("amount")
    return slots


def _missing_slots(parsed: ParsedEntry, slots: tuple[str, ...]) -> list[str]:
    missing: list[str] = []
    for slot in slots:
        if slot == "amount" and (parsed.amount is None or parsed.amount <= 0):
            missing.append(slot)
        elif slot == "payment_method" and parsed.payment_method == "unknown":
            missing.append(slot)
        elif slot == "party" and not parsed.party:
            missing.append(slot)
    return missing


def classify_erp_action(erp_action: str) -> PolicyAction:
    """Classify a normalized erp_action string without parsed-entry context."""
    action = normalize_erp_action(erp_action)
    if not action:
        return "hold"

    if not is_structured_erp_action(action):
        return "no_post"

    non_txn = get_non_transaction_erp_actions()
    if action in non_txn:
        return "no_post"

    if _matches(_CLARIFY_PATTERNS, action):
        return "clarify"
    if _matches(_REPORT_PATTERNS, action):
        return "report"
    if _matches(_ESCALATE_PATTERNS, action):
        return "escalate"
    if _matches(_NO_POST_PATTERNS, action):
        return "no_post"
    if _matches(_POST_PATTERNS, action):
        return "post"
    return "clarify"


def resolve_erp_action_policy(
    *,
    erp_action: str | None,
    confidence: float,
    parsed: ParsedEntry,
    clarification_needed: bool = False,
    clarification_question: str | None = None,
    required_fields: list[str] | None = None,
    tags: list[str] | None = None,
) -> PolicyResult:
    """Resolve runtime policy from erp_action metadata and current parse state."""
    action = normalize_erp_action(erp_action)
    tag_set = {str(t).lower() for t in (tags or [])}

    if not action:
        if "do_not_post" in tag_set or confidence < 0.35:
            return PolicyResult(
                policy_action="clarify",
                skip_posting=True,
                needs_clarification=True,
                escalate=False,
                required_slots=("amount", "party", "payment_method"),
                clarification_question=clarification_question,
                reason="low_confidence_no_erp_action",
            )
        return PolicyResult(
            policy_action="hold",
            skip_posting=False,
            needs_clarification=clarification_needed,
            escalate=False,
            required_slots=(),
            clarification_question=clarification_question,
            reason="no_erp_action",
        )

    policy_action = classify_erp_action(action)

    slots: list[str] = []
    for field in required_fields or []:
        slot = _FIELD_TO_SLOT.get(field, field)
        if slot not in slots:
            slots.append(slot)
    for slot in _infer_slots_from_action(action):
        if slot not in slots:
            slots.append(slot)

    if policy_action == "post" and clarification_needed:
        policy_action = "clarify"

    if policy_action == "post":
        missing = _missing_slots(parsed, tuple(slots))
        if missing:
            policy_action = "clarify"
        elif confidence < 0.45:
            policy_action = "clarify"

    skip_posting = policy_action in {"no_post", "report", "escalate", "clarify", "hold"}
    needs_clarification = policy_action in {"clarify", "hold"} or clarification_needed
    escalate = policy_action == "escalate"

    if policy_action == "no_post":
        skip_posting = True
        needs_clarification = False

    if policy_action == "report":
        skip_posting = True
        needs_clarification = False

    default_questions: dict[PolicyAction, str] = {
        "clarify": (
            clarification_question
            or "Thap anusar rakam, party, ra payment mode confirm garnu hola."
        ),
        "hold": (
            clarification_question
            or "Yo entry post garna yeti detail pugdaina — kripaya clear garnus."
        ),
        "no_post": (
            "Yo financial entry chaina — report, setting, wa general question ho ki "
            "confirm garnus."
        ),
        "report": (
            "Report generate garna ERP report section kholnus, wa ke report chahiyo "
            "detail lekhnus."
        ),
        "escalate": (
            "Yo case manual review chahincha — owner/CA sanga confirm garnu hola."
        ),
    }

    question = clarification_question
    if skip_posting and policy_action in default_questions and not question:
        question = default_questions[policy_action]
    elif needs_clarification and not question:
        question = default_questions.get("clarify")

    return PolicyResult(
        policy_action=policy_action,
        skip_posting=skip_posting,
        needs_clarification=needs_clarification,
        escalate=escalate,
        required_slots=tuple(slots),
        clarification_question=question,
        reason=action,
    )


def apply_policy_to_parsed(parsed: ParsedEntry, policy: PolicyResult) -> ParsedEntry:
    """Merge policy outcome into ParsedEntry."""
    updates: dict[str, object] = {
        "policy_action": policy.policy_action,
        "erp_action": policy.reason,
        "skip_posting": policy.skip_posting,
        "needs_clarification": policy.needs_clarification,
    }
    if policy.skip_posting and policy.reason:
        updates["skip_reason"] = policy.reason
    if policy.clarification_question and (
        policy.needs_clarification or policy.skip_posting
    ):
        updates["clarification_question"] = policy.clarification_question
    if policy.escalate:
        updates["needs_clarification"] = True
        if not policy.clarification_question:
            updates["clarification_question"] = (
                "Yo case manual review chahincha — owner/CA sanga confirm garnu hola."
            )
    return parsed.model_copy(update=updates)
