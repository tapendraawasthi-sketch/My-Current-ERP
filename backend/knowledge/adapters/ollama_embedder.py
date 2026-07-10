"""Ollama embedding provider."""

from __future__ import annotations

from langchain_ollama import OllamaEmbeddings

from backend.knowledge.config import EMBED_MODEL, OLLAMA_BASE_URL


class OllamaEmbeddingProvider:
    """Generates embeddings via local Ollama."""

    def __init__(
        self,
        model: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self._embedder = OllamaEmbeddings(
            model=model or EMBED_MODEL,
            base_url=base_url or OLLAMA_BASE_URL,
        )

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return self._embedder.embed_documents(texts)
