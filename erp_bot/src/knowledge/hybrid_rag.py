"""Hybrid RAG — dense Chroma + sparse BM25 with reciprocal rank fusion."""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Any

from ..vectorstore.ca_knowledge_store import search_ca_knowledge
from .knowledge_registry import authority_score

logger = logging.getLogger(__name__)

_BOT_ROOT = Path(__file__).resolve().parent.parent.parent
BM25_CACHE_PATH = _BOT_ROOT / "data" / "bm25_index.pkl"

try:
  from rank_bm25 import BM25Okapi
except ImportError:  # pragma: no cover
  BM25Okapi = None  # type: ignore


class HybridRAG:
  """Hybrid search over accounting knowledge corpus."""

  def __init__(self) -> None:
    self._bm25_corpus: list[str] = []
    self._bm25_index: Any = None
    self._doc_ids: list[str] = []
    self._doc_metadata: list[dict[str, Any]] = []

  def index_documents(self, documents: list[dict[str, Any]]) -> None:
    texts = [str(d.get("text", "")) for d in documents]
    self._bm25_corpus = texts
    self._doc_ids = [str(d.get("id", f"doc_{i}")) for i, d in enumerate(documents)]
    self._doc_metadata = [dict(d.get("metadata") or {}) for d in documents]
    if BM25Okapi and texts:
      self._bm25_index = BM25Okapi([t.lower().split() for t in texts])

  def save_to_disk(self, path: Path | None = None) -> bool:
    target = path or BM25_CACHE_PATH
    try:
      target.parent.mkdir(parents=True, exist_ok=True)
      payload = {
        "corpus": self._bm25_corpus,
        "doc_ids": self._doc_ids,
        "doc_metadata": self._doc_metadata,
      }
      target.write_bytes(pickle.dumps(payload))
      return True
    except Exception as exc:
      logger.warning("BM25 save failed: %s", exc)
      return False

  def load_from_disk(self, path: Path | None = None) -> bool:
    target = path or BM25_CACHE_PATH
    if not target.exists() or not BM25Okapi:
      return False
    try:
      payload = pickle.loads(target.read_bytes())
      self._bm25_corpus = list(payload.get("corpus") or [])
      self._doc_ids = list(payload.get("doc_ids") or [])
      self._doc_metadata = list(payload.get("doc_metadata") or [])
      if self._bm25_corpus:
        self._bm25_index = BM25Okapi([t.lower().split() for t in self._bm25_corpus])
        return True
    except Exception as exc:
      logger.warning("BM25 load failed: %s", exc)
    return False

  def _authority_boost(self, metadata: dict[str, Any], task: str) -> float:
    seg = str(metadata.get("segment") or "")
    if not seg:
      return 0.0
    stored = metadata.get("authority")
    auth = float(stored) if stored is not None else authority_score(seg, task)
    return auth * 0.01

  def search(self, query: str, top_k: int = 5, *, task: str = "accounting_qa") -> list[dict[str, Any]]:
    dense = search_ca_knowledge(query, k=max(top_k * 2, 10))
    rrf_scores: dict[str, float] = {}
    k = 60

    for rank, doc in enumerate(dense):
      doc_id = str(doc.get("id", f"dense_{rank}"))
      rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1 / (k + rank + 1)

    if self._bm25_index and BM25Okapi:
      scores = self._bm25_index.get_scores(query.lower().split())
      top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:10]
      for rank, idx in enumerate(top_indices):
        if idx < len(self._doc_ids):
          doc_id = self._doc_ids[idx]
          rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1 / (k + rank + 1)

    dense_by_id = {str(d.get("id", f"dense_{i}")): d for i, d in enumerate(dense)}
    sorted_ids = sorted(rrf_scores.items(), key=lambda x: -x[1])[: top_k * 2]

    results: list[dict[str, Any]] = []
    for doc_id, score in sorted_ids:
      if doc_id in dense_by_id:
        d = dense_by_id[doc_id]
        meta = dict(d.get("metadata") or {})
        boosted = score + self._authority_boost(meta, task)
        results.append(
          {
            "id": doc_id,
            "text": d.get("text", d.get("content", "")),
            "metadata": meta,
            "score": boosted,
          }
        )
      elif doc_id in self._doc_ids:
        idx = self._doc_ids.index(doc_id)
        meta = self._doc_metadata[idx] if idx < len(self._doc_metadata) else {}
        boosted = score + self._authority_boost(meta, task)
        results.append(
          {
            "id": doc_id,
            "text": self._bm25_corpus[idx],
            "metadata": meta,
            "score": boosted,
          }
        )

    results.sort(key=lambda x: -x["score"])
    return results[:top_k]


_default_rag: HybridRAG | None = None


def get_hybrid_rag() -> HybridRAG:
  global _default_rag
  if _default_rag is None:
    _default_rag = HybridRAG()
  return _default_rag
