"""Cross-collection query embedding cache — one Ollama embed per unique query."""

from __future__ import annotations

from langchain_ollama import OllamaEmbeddings

from ..config import EMBED_MODEL, OLLAMA_BASE_URL

_embedder = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)
_cache: dict[str, list[float]] = {}
_MAX_SIZE = 256


def embed_query_cached(query: str) -> list[float]:
    key = query.strip().lower()
    if not key:
        return _embedder.embed_query(query)
    if key in _cache:
        return _cache[key]
    vec = _embedder.embed_query(query)
    if len(_cache) >= _MAX_SIZE:
        _cache.pop(next(iter(_cache)))
    _cache[key] = vec
    return vec


def clear_embed_cache() -> None:
    _cache.clear()
