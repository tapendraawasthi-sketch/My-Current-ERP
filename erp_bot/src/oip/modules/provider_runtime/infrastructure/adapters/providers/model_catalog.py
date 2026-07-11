"""Model metadata registry — context window and cost estimation."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelMetadata:
    model_id: str
    context_window: int
    input_cost_micros_per_1k: int
    output_cost_micros_per_1k: int
    supports_tools: bool = True
    supports_json: bool = True
    supports_streaming: bool = True


class ModelCatalog:
    def __init__(self) -> None:
        self._models: dict[str, ModelMetadata] = {}

    def register(self, metadata: ModelMetadata) -> None:
        self._models[metadata.model_id] = metadata

    def get(self, model_id: str) -> ModelMetadata | None:
        return self._models.get(model_id)

    def resolve(self, model_id: str, *, default_context: int = 128_000) -> ModelMetadata:
        return self._models.get(model_id) or ModelMetadata(
            model_id=model_id,
            context_window=default_context,
            input_cost_micros_per_1k=250,
            output_cost_micros_per_1k=1000,
        )

    def estimate_cost_micros(self, *, model_id: str, input_tokens: int, output_tokens: int) -> int:
        meta = self.resolve(model_id)
        input_cost = (input_tokens * meta.input_cost_micros_per_1k) // 1000
        output_cost = (output_tokens * meta.output_cost_micros_per_1k) // 1000
        return input_cost + output_cost


def create_default_model_catalog() -> ModelCatalog:
    catalog = ModelCatalog()
    entries = (
        ("gpt-4o", 128_000, 250, 1000),
        ("gpt-4o-mini", 128_000, 15, 60),
        ("claude-3-5-sonnet-20241022", 200_000, 300, 1500),
        ("claude-3-5-haiku-20241022", 200_000, 80, 400),
        ("gemini-1.5-pro", 1_000_000, 125, 500),
        ("gemini-1.5-flash", 1_000_000, 35, 140),
        ("llama-3.3-70b-versatile", 128_000, 59, 79),
        ("llama3", 8192, 0, 0),
        ("llama3.2", 128_000, 0, 0),
    )
    for model_id, ctx, inp, out in entries:
        catalog.register(
            ModelMetadata(
                model_id=model_id,
                context_window=ctx,
                input_cost_micros_per_1k=inp,
                output_cost_micros_per_1k=out,
            )
        )
    return catalog
