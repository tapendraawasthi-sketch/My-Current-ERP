"""Intelligence Evolution Layer — model-agnostic adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class ReasonerRequest:
    prompt: str
    context: str = ""
    model_hint: str = "default"
    token_budget: int = 4096


@dataclass
class ReasonerResponse:
    text: str
    model_id: str
    adapter_version: str
    confidence: float = 0.8


class ReasonerAdapter(ABC):
    adapter_id: str
    adapter_version: str
    supported_models: list[str]

    @abstractmethod
    async def reason(self, request: ReasonerRequest) -> ReasonerResponse: ...


class CascadeReasonerAdapter(ReasonerAdapter):
    """Wraps existing cascade_router — stable interface over Qwen tiers."""

    adapter_id = "reasoner.cascade"
    adapter_version = "1.0.0"
    supported_models = ["qwen3-4b", "qwen3-32b"]

    async def reason(self, request: ReasonerRequest) -> ReasonerResponse:
        try:
            from ...agent.cascade_router import classify_cascade

            result = await classify_cascade(request.prompt)
            return ReasonerResponse(
                text=f"[cascade:{result.model}] intent={result.intent}",
                model_id=result.model,
                adapter_version=self.adapter_version,
                confidence=result.confidence,
            )
        except Exception as exc:
            return ReasonerResponse(
                text=f"Cascade unavailable: {exc}",
                model_id="fallback",
                adapter_version=self.adapter_version,
                confidence=0.3,
            )


class DeterministicReasonerAdapter(ReasonerAdapter):
    """No-LLM path for engine-backed answers."""

    adapter_id = "reasoner.deterministic"
    adapter_version = "1.0.0"
    supported_models = ["none"]

    async def reason(self, request: ReasonerRequest) -> ReasonerResponse:
        return ReasonerResponse(
            text="Deterministic engine path — LLM not invoked.",
            model_id="none",
            adapter_version=self.adapter_version,
            confidence=1.0,
        )


class MockReasonerAdapter(ReasonerAdapter):
    """Model swap test adapter — same interface, deterministic output."""

    adapter_id = "reasoner.mock"
    adapter_version = "1.0.0"
    supported_models = ["mock-v1"]

    async def reason(self, request: ReasonerRequest) -> ReasonerResponse:
        return ReasonerResponse(
            text=f"[mock] Processed: {request.prompt[:100]}",
            model_id="mock-v1",
            adapter_version=self.adapter_version,
            confidence=0.99,
        )


class EvolutionRegistry:
    def __init__(self) -> None:
        self._adapters: dict[str, ReasonerAdapter] = {
            CascadeReasonerAdapter.adapter_id: CascadeReasonerAdapter(),
            DeterministicReasonerAdapter.adapter_id: DeterministicReasonerAdapter(),
            MockReasonerAdapter.adapter_id: MockReasonerAdapter(),
        }
        self._default_adapter = CascadeReasonerAdapter.adapter_id

    def get(self, adapter_id: str | None = None) -> ReasonerAdapter:
        return self._adapters[adapter_id or self._default_adapter]

    def list_adapters(self) -> list[dict[str, Any]]:
        return [
            {
                "id": a.adapter_id,
                "version": a.adapter_version,
                "models": a.supported_models,
            }
            for a in self._adapters.values()
        ]

    def register(self, adapter: ReasonerAdapter) -> None:
        self._adapters[adapter.adapter_id] = adapter


evolution_registry = EvolutionRegistry()
