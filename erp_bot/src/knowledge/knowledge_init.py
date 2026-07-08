"""
Bootstrap knowledge indexes on erp_bot startup.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from ..config import ERP_PATH
from ..vectorstore.ca_knowledge_store import get_ca_knowledge_count, ingest_ca_knowledge
from ..vectorstore.nlu_knowledge_store import get_nlu_knowledge_count, ingest_nlu_knowledge
from .hybrid_rag import get_hybrid_rag

logger = logging.getLogger(__name__)


def _load_corpus_documents() -> list[dict]:
    docs: list[dict] = []
    data_dir = ERP_PATH / "data" / "ekhata"

    cf_path = data_dir / "conceptual-framework-knowledge.json"
    if cf_path.exists():
        try:
            data = json.loads(cf_path.read_text(encoding="utf-8"))
            for key in ("paragraphs", "tables", "glossary", "chapterTexts", "sections"):
                for i, item in enumerate(data.get(key, [])):
                    text = item.get("text") or item.get("definition") or ""
                    if not text:
                        continue
                    docs.append(
                        {
                            "id": f"cf-{item.get('id', f'{key}-{i}')}",
                            "text": text,
                            "metadata": {
                                "source": "conceptual-framework",
                                "section": item.get("section", ""),
                                "chapter": item.get("chapter", 0),
                            },
                        }
                    )
        except Exception as exc:
            logger.warning("Framework corpus load failed: %s", exc)

    gen_path = data_dir / "ca-training-corpus-generated.jsonl"
    if gen_path.exists():
        try:
            for i, line in enumerate(gen_path.read_text(encoding="utf-8").splitlines()[:500]):
                row = json.loads(line)
                inp = row.get("input") or row.get("instruction") or ""
                out = row.get("output") or row.get("response") or ""
                if inp and out:
                    docs.append(
                        {
                            "id": f"train-{i}",
                            "text": f"Q: {inp}\nA: {out}",
                            "metadata": {"source": "training-corpus"},
                        }
                    )
        except Exception as exc:
            logger.warning("Training corpus load failed: %s", exc)

    return docs


def ensure_knowledge_indexes() -> dict:
    """Index Chroma + BM25 if needed. Safe to call on every startup."""
    result: dict = {"chroma": None, "bm25_docs": 0}

    if get_ca_knowledge_count() == 0:
        result["chroma"] = ingest_ca_knowledge()
        logger.info("CA knowledge ingest: %s", result["chroma"])
    else:
        result["chroma"] = {"status": "ready", "count": get_ca_knowledge_count()}

    if get_nlu_knowledge_count() == 0:
        result["nlu_embeddings"] = ingest_nlu_knowledge()
        logger.info("NLU knowledge embeddings: %s", result["nlu_embeddings"])
    else:
        result["nlu_embeddings"] = {"status": "ready", "count": get_nlu_knowledge_count()}

    docs = _load_corpus_documents()
    try:
        from .chart_of_accounts_framework import coa_documents_for_rag

        docs.extend(coa_documents_for_rag())
    except Exception as exc:
        logger.warning("COA framework corpus load failed: %s", exc)

    if docs:
        try:
            from .knowledge_registry import chunks_to_rag_documents

            tiered = chunks_to_rag_documents()
            docs.extend(tiered)
            logger.info("Tiered knowledge: %d chunks for BM25 index", len(tiered))
        except Exception as exc:
            logger.warning("Tiered knowledge corpus load failed: %s", exc)

        rag = get_hybrid_rag()
        rag.index_documents(docs)
        result["bm25_docs"] = len(docs)

    return result
