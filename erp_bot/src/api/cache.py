"""Phase 6 — Response caching for repeated questions.

LRU cache with semantic similarity matching:
- Exact match: instant response
- Similar match (cosine > 0.92): reuse cached answer

Cache is in-memory with TTL. For L4 deployments, this significantly
reduces latency for common questions (VAT rate, TDS, etc.).
"""

from __future__ import annotations

import hashlib
import os
import time
from dataclasses import dataclass, field
from threading import Lock
from typing import Any

# Handle both package import and standalone testing
try:
    from ..config import EMBED_MODEL, OLLAMA_BASE_URL
except ImportError:
    EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

MAX_CACHE_SIZE = 500  # Max cached responses
CACHE_TTL_SECONDS = 3600  # 1 hour TTL
SIMILARITY_THRESHOLD = 0.92  # Cosine similarity for "similar enough"
MIN_QUERY_LENGTH = 4  # Cache short greetings too ("hi", "namaste")


# ══════════════════════════════════════════════════════════════════════════════
# DATA STRUCTURES
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class CacheEntry:
    """A cached response with metadata."""
    query: str
    query_hash: str
    query_embedding: list[float] | None
    response: str
    sources: list[str]
    route: dict[str, Any] | None
    timestamp: float
    hit_count: int = 0
    
    def is_expired(self, ttl: int = CACHE_TTL_SECONDS) -> bool:
        return time.time() - self.timestamp > ttl


@dataclass
class CacheStats:
    """Cache statistics."""
    total_queries: int = 0
    exact_hits: int = 0
    similar_hits: int = 0
    misses: int = 0
    entries: int = 0
    
    @property
    def hit_rate(self) -> float:
        if self.total_queries == 0:
            return 0.0
        return (self.exact_hits + self.similar_hits) / self.total_queries


# ══════════════════════════════════════════════════════════════════════════════
# CACHE IMPLEMENTATION
# ══════════════════════════════════════════════════════════════════════════════

class ResponseCache:
    """LRU response cache with semantic similarity matching."""
    
    def __init__(self, max_size: int = MAX_CACHE_SIZE):
        self._cache: dict[str, CacheEntry] = {}
        self._embeddings_cache: dict[str, list[float]] = {}
        self._lock = Lock()
        self._max_size = max_size
        self._stats = CacheStats()
    
    @staticmethod
    def _hash_query(query: str) -> str:
        """Create a hash for exact matching."""
        normalized = query.strip().lower()
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]
    
    def _get_embedding(self, text: str) -> list[float] | None:
        """Get embedding for semantic similarity."""
        try:
            import httpx
            resp = httpx.post(
                f"{OLLAMA_BASE_URL}/api/embeddings",
                json={"model": EMBED_MODEL, "prompt": text},
                timeout=10.0,
            )
            if resp.status_code == 200:
                return resp.json().get("embedding")
        except Exception:
            pass
        return None
    
    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        if not a or not b or len(a) != len(b):
            return 0.0
        
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return dot / (norm_a * norm_b)
    
    def _evict_if_needed(self):
        """Remove oldest entries if cache is full."""
        if len(self._cache) < self._max_size:
            return
        
        # Sort by timestamp and remove oldest 10%
        entries = sorted(self._cache.items(), key=lambda x: x[1].timestamp)
        to_remove = max(1, len(entries) // 10)
        
        for hash_key, _ in entries[:to_remove]:
            del self._cache[hash_key]
            self._embeddings_cache.pop(hash_key, None)
    
    def _find_similar(self, query: str, embedding: list[float]) -> CacheEntry | None:
        """Find semantically similar cached entry."""
        best_entry = None
        best_similarity = SIMILARITY_THRESHOLD
        
        for hash_key, entry in self._cache.items():
            if entry.is_expired():
                continue
            
            if entry.query_embedding:
                sim = self._cosine_similarity(embedding, entry.query_embedding)
                if sim > best_similarity:
                    best_similarity = sim
                    best_entry = entry
        
        return best_entry
    
    def get(self, query: str) -> dict[str, Any] | None:
        """Get cached response for a query.
        
        Returns dict with keys: response, sources, route, cache_type
        """
        if len(query) < MIN_QUERY_LENGTH:
            return None
        
        with self._lock:
            self._stats.total_queries += 1
            
            # Try exact match first
            query_hash = self._hash_query(query)
            if query_hash in self._cache:
                entry = self._cache[query_hash]
                if not entry.is_expired():
                    entry.hit_count += 1
                    self._stats.exact_hits += 1
                    return {
                        "response": entry.response,
                        "sources": entry.sources,
                        "route": entry.route,
                        "cache_type": "exact",
                    }
                else:
                    # Remove expired entry
                    del self._cache[query_hash]
            
            # Try semantic similarity
            embedding = self._get_embedding(query)
            if embedding:
                similar = self._find_similar(query, embedding)
                if similar:
                    similar.hit_count += 1
                    self._stats.similar_hits += 1
                    return {
                        "response": similar.response,
                        "sources": similar.sources,
                        "route": similar.route,
                        "cache_type": "similar",
                    }
            
            self._stats.misses += 1
            return None
    
    def put(
        self,
        query: str,
        response: str,
        sources: list[str] | None = None,
        route: dict[str, Any] | None = None,
    ):
        """Cache a response."""
        if len(query) < MIN_QUERY_LENGTH:
            return
        
        with self._lock:
            self._evict_if_needed()
            
            query_hash = self._hash_query(query)
            embedding = self._get_embedding(query)
            
            entry = CacheEntry(
                query=query,
                query_hash=query_hash,
                query_embedding=embedding,
                response=response,
                sources=sources or [],
                route=route,
                timestamp=time.time(),
            )
            
            self._cache[query_hash] = entry
            self._stats.entries = len(self._cache)
    
    def clear(self):
        """Clear all cached entries."""
        with self._lock:
            self._cache.clear()
            self._embeddings_cache.clear()
            self._stats = CacheStats()
    
    def get_stats(self) -> dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            return {
                "total_queries": self._stats.total_queries,
                "exact_hits": self._stats.exact_hits,
                "similar_hits": self._stats.similar_hits,
                "misses": self._stats.misses,
                "entries": self._stats.entries,
                "hit_rate": round(self._stats.hit_rate * 100, 1),
                "max_size": self._max_size,
                "ttl_seconds": CACHE_TTL_SECONDS,
            }


# ══════════════════════════════════════════════════════════════════════════════
# SINGLETON INSTANCE
# ══════════════════════════════════════════════════════════════════════════════

_cache: ResponseCache | None = None


def get_response_cache() -> ResponseCache:
    """Get the singleton cache instance."""
    global _cache
    if _cache is None:
        _cache = ResponseCache()
    return _cache
