"""Intent classification stage — registry-based, no switches.

MAI-10 slice 2: concept→intent bridge runs first (evidence-gated), then
legacy keyword classifiers. Never posts drafts from lexicon alone.
"""

from __future__ import annotations

from typing import Any, Callable, Protocol

from .context import PlanningContext


class IntentClassifier(Protocol):
    name: str
    priority: int

    def classify(self, *, message: str, module: str) -> tuple[str, float] | None:
        """Return (intent, confidence) or None if no match."""


IntentClassifierFn = Callable[..., tuple[str, float] | None]


class IntentClassifierRegistry:
    def __init__(self) -> None:
        self._classifiers: list[tuple[int, str, IntentClassifierFn]] = []

    def register(self, name: str, classifier: IntentClassifierFn, *, priority: int = 100) -> None:
        self._classifiers.append((priority, name, classifier))
        self._classifiers.sort(key=lambda item: item[0])

    def classify(
        self, *, message: str, module: str
    ) -> tuple[str, float, dict[str, Any]]:
        """Return (intent, confidence, meta). meta may include source / concepts."""
        # Preserve original casing for Devanagari concept matching; classifiers
        # that need ASCII lowering do so themselves.
        for _, name, classifier in self._classifiers:
            result = classifier(message=message, module=module)
            if result is not None:
                if len(result) == 3:
                    intent, confidence, extra = result  # type: ignore[misc]
                    meta = {"classifier": name, **dict(extra or {})}
                else:
                    intent, confidence = result  # type: ignore[misc]
                    meta = {"classifier": name}
                return intent, confidence, meta
        return "general_query", 0.5, {"classifier": "default"}


def create_default_intent_registry() -> IntentClassifierRegistry:
    registry = IntentClassifierRegistry()

    def concept_bridge(*, message: str, module: str) -> tuple[str, float, dict] | None:
        from ....language_runtime.domain_lexicon.application.concept_intent_bridge import (
            resolve_intent_from_message,
        )
        from ....language_runtime.domain_lexicon.application.domain_lexicon_service import (
            parse_domain_concepts,
        )

        resolved = resolve_intent_from_message(message)
        if resolved is None:
            return None
        intent, confidence, reasons = resolved
        concepts = sorted({r["concept_id"] for r in parse_domain_concepts(message)})
        return intent, confidence, {
            "intent_source": "mai10_concept_bridge",
            "reason_codes": list(reasons),
            "concept_ids": concepts,
        }

    def balance_query(*, message: str, module: str) -> tuple[str, float] | None:
        lowered = message.lower()
        if any(k in lowered for k in ("balance", "baki", "शेष", "kati ho")):
            return "ledger_balance_query", 0.92
        return None

    def journal_entry(*, message: str, module: str) -> tuple[str, float] | None:
        lowered = message.lower()
        if any(k in lowered for k in ("entry", "journal", "bech", "kin", "bikri", "kharid")):
            return "journal_entry", 0.88
        return None

    def sales_entry(*, message: str, module: str) -> tuple[str, float] | None:
        lowered = message.lower()
        if "journal entry" in lowered:
            return None
        if any(k in lowered for k in ("sold", "becheko", "beche", "bikri")):
            return "sales_entry", 0.87
        return None

    def purchase_entry(*, message: str, module: str) -> tuple[str, float] | None:
        lowered = message.lower()
        if any(k in lowered for k in ("bought", "purchase", "kineko", "kinyo", "kharid")):
            return "purchase_entry", 0.86
        return None

    def report_query(*, message: str, module: str) -> tuple[str, float] | None:
        lowered = message.lower()
        if any(k in lowered for k in ("report", "trial balance", "profit", "loss")):
            return "report_generation", 0.9
        if "vat" in lowered and any(k in lowered for k in ("report", "return", "summary")):
            return "report_generation", 0.88
        return None

    def vat_calculation(*, message: str, module: str) -> tuple[str, float] | None:
        lowered = message.lower()
        if "vat" in lowered and any(
            k in lowered for k in ("calculate", "compute", "kati", "percent", "%", "13")
        ):
            return "vat_calculation", 0.91
        return None

    def workflow_approval(*, message: str, module: str) -> tuple[str, float] | None:
        lowered = message.lower()
        if any(k in lowered for k in ("approve", "approval", "swikriti", "manjur")):
            return "workflow_approval", 0.9
        return None

    def education(*, message: str, module: str) -> tuple[str, float] | None:
        lowered = message.lower()
        if any(k in lowered for k in ("what is", "explain", "k ho", "meaning", "define")):
            return "accounting_education", 0.85
        return None

    # MAI-10: concept bridge, then education/approval (must beat keyword sales/journal
    # so "what is bikri" is not stolen), then legacy keyword lists.
    registry.register("mai10_concept_bridge", concept_bridge, priority=5)
    registry.register("education", education, priority=6)
    registry.register("workflow_approval", workflow_approval, priority=7)
    registry.register("balance_query", balance_query, priority=10)
    registry.register("sales_entry", sales_entry, priority=15)
    registry.register("purchase_entry", purchase_entry, priority=16)
    registry.register("journal_entry", journal_entry, priority=20)
    registry.register("vat_calculation", vat_calculation, priority=25)
    registry.register("report_query", report_query, priority=30)
    return registry


class IntentClassificationStage:
    name = "intent_classification"

    def __init__(self, registry: IntentClassifierRegistry) -> None:
        self._registry = registry

    async def run(self, context: PlanningContext) -> PlanningContext:
        intent, confidence, meta = self._registry.classify(
            message=context.normalized_message,
            module=context.request.module,
        )
        context.intent = intent
        from ...domain.value_objects import TaskProfile

        context.task_profile = TaskProfile(
            intent=intent,
            module=context.request.module,
            complexity="high" if intent in {"journal_entry", "report_generation"} else "medium",
            requires_tools=intent in {"ledger_balance_query", "journal_entry", "report_generation"},
            requires_knowledge=intent in {"accounting_education", "general_query", "report_generation"},
            requires_memory=True,
            requires_erp_snapshot=intent
            in {"ledger_balance_query", "journal_entry", "report_generation", "vat_calculation"},
            confidence=confidence,
            metadata=meta,
        )
        return context
