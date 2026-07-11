"""Intent classification stage — registry-based, no switches."""

from __future__ import annotations

from typing import Callable, Protocol

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

    def classify(self, *, message: str, module: str) -> tuple[str, float]:
        lowered = message.lower()
        for _, _, classifier in self._classifiers:
            result = classifier(message=lowered, module=module)
            if result is not None:
                return result
        return "general_query", 0.5


def create_default_intent_registry() -> IntentClassifierRegistry:
    registry = IntentClassifierRegistry()

    def balance_query(*, message: str, module: str) -> tuple[str, float] | None:
        if any(k in message for k in ("balance", "baki", "शेष", "kati ho")):
            return "ledger_balance_query", 0.92
        return None

    def journal_entry(*, message: str, module: str) -> tuple[str, float] | None:
        if any(k in message for k in ("entry", "journal", "bech", "kin", "bikri", "kharid")):
            return "journal_entry", 0.88
        return None

    def sales_entry(*, message: str, module: str) -> tuple[str, float] | None:
        if "journal entry" in message:
            return None
        if any(k in message for k in ("sold", "becheko", "beche", "bikri")):
            return "sales_entry", 0.87
        return None

    def purchase_entry(*, message: str, module: str) -> tuple[str, float] | None:
        if any(k in message for k in ("bought", "purchase", "kineko", "kinyo", "kharid")):
            return "purchase_entry", 0.86
        return None

    def report_query(*, message: str, module: str) -> tuple[str, float] | None:
        if any(k in message for k in ("report", "trial balance", "profit", "loss")):
            return "report_generation", 0.9
        if "vat" in message and any(k in message for k in ("report", "return", "summary")):
            return "report_generation", 0.88
        return None

    def vat_calculation(*, message: str, module: str) -> tuple[str, float] | None:
        if "vat" in message and any(k in message for k in ("calculate", "compute", "kati", "percent", "%", "13")):
            return "vat_calculation", 0.91
        return None

    def workflow_approval(*, message: str, module: str) -> tuple[str, float] | None:
        if any(k in message for k in ("approve", "approval", "swikriti", "manjur")):
            return "workflow_approval", 0.9
        return None

    def education(*, message: str, module: str) -> tuple[str, float] | None:
        if any(k in message for k in ("what is", "explain", "k ho", "meaning", "define")):
            return "accounting_education", 0.85
        return None

    registry.register("balance_query", balance_query, priority=10)
    registry.register("sales_entry", sales_entry, priority=15)
    registry.register("purchase_entry", purchase_entry, priority=16)
    registry.register("journal_entry", journal_entry, priority=20)
    registry.register("vat_calculation", vat_calculation, priority=25)
    registry.register("report_query", report_query, priority=30)
    registry.register("workflow_approval", workflow_approval, priority=35)
    registry.register("education", education, priority=40)
    return registry


class IntentClassificationStage:
    name = "intent_classification"

    def __init__(self, registry: IntentClassifierRegistry) -> None:
        self._registry = registry

    async def run(self, context: PlanningContext) -> PlanningContext:
        intent, confidence = self._registry.classify(
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
        )
        return context
