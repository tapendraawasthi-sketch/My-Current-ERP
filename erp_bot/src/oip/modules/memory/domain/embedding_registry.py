"""Embedding model registry for memory vectors."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EmbeddingDefinition:
    model_name: str
    model_version: str
    dimensions: int


class EmbeddingRegistry:
    def __init__(self) -> None:
        self._models: dict[str, EmbeddingDefinition] = {}

    def register(self, definition: EmbeddingDefinition) -> None:
        self._models[definition.model_name] = definition

    def get(self, model_name: str) -> EmbeddingDefinition | None:
        return self._models.get(model_name)

    def default_model(self) -> str:
        return "hash-v1"


def create_default_embedding_registry() -> EmbeddingRegistry:
    registry = EmbeddingRegistry()
    registry.register(EmbeddingDefinition("hash-v1", "1.0", 64))
    return registry
