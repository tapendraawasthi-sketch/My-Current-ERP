"""Meta Reasoner — reasoning about reasoning (Cognitive OS)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class MetaEvaluation:
    action: str
    reason: str
    confidence: float
    skip_llm: bool = False


class MetaReasoner:
    """Decide retrieve/calculate/ask/simulate/debate/search/optimize/explain."""

    def evaluate(self, dimension: str, ctx: dict[str, Any]) -> MetaEvaluation:
        handlers = {
            "retrieval": self._should_retrieve,
            "calculate": self._should_calculate,
            "ask_user": self._should_ask_user,
            "simulate": self._should_simulate,
            "debate": self._should_debate,
            "search": self._should_search,
            "optimize": self._should_optimize,
            "explain": self._should_explain,
        }
        fn = handlers.get(dimension, self._default)
        return fn(ctx)

    def evaluate_all(self, ctx: dict[str, Any]) -> dict[str, MetaEvaluation]:
        dims = ["retrieval", "calculate", "ask_user", "simulate", "debate", "search", "optimize", "explain"]
        return {d: self.evaluate(d, ctx) for d in dims}

    def best_action(self, ctx: dict[str, Any]) -> MetaEvaluation:
        evaluations = self.evaluate_all(ctx)
        priority = ["calculate", "simulate", "optimize", "retrieval", "debate", "search", "ask_user", "explain"]
        message = str(ctx.get("message", "")).lower()
        uil_action = str(ctx.get("uil_action", ""))

        if evaluations["calculate"].confidence >= 0.9:
            return evaluations["calculate"]
        if evaluations["simulate"].confidence >= 0.8 or uil_action in ("simulate", "scenario"):
            return evaluations["simulate"]
        if evaluations["optimize"].confidence >= 0.8 or "optimize" in message or "best" in message:
            return evaluations["optimize"]
        if evaluations["retrieval"].confidence >= 0.75:
            return evaluations["retrieval"]
        if evaluations["debate"].confidence >= 0.7:
            return evaluations["debate"]
        if evaluations["ask_user"].confidence >= 0.7:
            return evaluations["ask_user"]
        return evaluations["search"]

    def _should_retrieve(self, ctx: dict[str, Any]) -> MetaEvaluation:
        coverage = float(ctx.get("evidence_coverage", 1.0))
        if coverage < 0.7:
            return MetaEvaluation("retrieve", "Evidence coverage below floor", 0.85)
        return MetaEvaluation("retrieve", "Standard retrieval path", 0.6)

    def _should_calculate(self, ctx: dict[str, Any]) -> MetaEvaluation:
        caps = ctx.get("capabilities") or []
        message = str(ctx.get("message", ""))
        has_engine = any("engine" in c or "tax" in c or "payroll" in c for c in caps)
        has_number = any(ch.isdigit() for ch in message)
        if has_engine and has_number:
            return MetaEvaluation("calculate", "Deterministic engine match", 0.95, skip_llm=True)
        return MetaEvaluation("calculate", "No engine match", 0.3)

    def _should_ask_user(self, ctx: dict[str, Any]) -> MetaEvaluation:
        conf = float(ctx.get("uil_confidence", 0.5))
        missing = ctx.get("missing_uil_slots") or []
        if conf < 0.6 or missing:
            return MetaEvaluation("ask_user", f"Missing slots: {missing}" if missing else "Low confidence", 0.8)
        return MetaEvaluation("ask_user", "Sufficient confidence", 0.2)

    def _should_simulate(self, ctx: dict[str, Any]) -> MetaEvaluation:
        message = str(ctx.get("message", "")).lower()
        if any(w in message for w in ("what if", "simulate", "scenario", "yadi")):
            return MetaEvaluation("simulate", "Counterfactual detected", 0.9)
        return MetaEvaluation("simulate", "No simulation intent", 0.2)

    def _should_debate(self, ctx: dict[str, Any]) -> MetaEvaluation:
        if ctx.get("legal_ambiguity") or ctx.get("agent_disagreement"):
            return MetaEvaluation("debate", "Legal ambiguity or agent disagreement", 0.85)
        return MetaEvaluation("debate", "No debate needed", 0.2)

    def _should_search(self, ctx: dict[str, Any]) -> MetaEvaluation:
        if float(ctx.get("evidence_coverage", 1)) < 0.5:
            return MetaEvaluation("search", "Insufficient evidence — federated search", 0.8)
        return MetaEvaluation("search", "Optional search", 0.4)

    def _should_optimize(self, ctx: dict[str, Any]) -> MetaEvaluation:
        message = str(ctx.get("message", "")).lower()
        if any(w in message for w in ("optimize", "best", "minimize", "maximize", "ramro")):
            return MetaEvaluation("optimize", "Optimization intent", 0.88)
        return MetaEvaluation("optimize", "No optimization intent", 0.2)

    def _should_explain(self, ctx: dict[str, Any]) -> MetaEvaluation:
        return MetaEvaluation("explain", "Contract mandate — always explain", 1.0)

    def _default(self, ctx: dict[str, Any]) -> MetaEvaluation:
        return MetaEvaluation("escalate_model", "Default cascade", 0.5)


meta_reasoner = MetaReasoner()
