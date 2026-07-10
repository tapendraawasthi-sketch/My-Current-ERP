"""ChromaDB vector store for tenant knowledge documents."""

from __future__ import annotations

import hashlib
import logging
import threading
from uuid import UUID

import chromadb
from langchain_ollama import OllamaEmbeddings

from backend.knowledge.config import (
    EMBED_MODEL,
    KNOWLEDGE_CHROMA_PATH,
    KNOWLEDGE_COLLECTION,
    OLLAMA_BASE_URL,
)

logger = logging.getLogger(__name__)

_client = chromadb.PersistentClient(path=KNOWLEDGE_CHROMA_PATH)
_embedder = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)
_write_lock = threading.Lock()


def get_collection():
    return _client.get_or_create_collection(
        name=KNOWLEDGE_COLLECTION,
        metadata={"description": "Tenant-scoped knowledge documents"},
    )


def chroma_id_for(document_id: UUID, chunk_index: int) -> str:
    raw = f"{document_id}:{chunk_index}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


class ChromaDocumentStore:
    """Tenant-filtered Chroma operations for knowledge chunks."""

    def upsert_chunks(
        self,
        *,
        ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict],
    ) -> None:
        if not ids:
            return
        collection = get_collection()
        with _write_lock:
            collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas,
            )

    def delete_by_document(self, document_id: str) -> None:
        try:
            collection = get_collection()
            with _write_lock:
                collection.delete(where={"document_id": document_id})
        except Exception as exc:
            logger.error("Chroma delete failed document_id=%s: %s", document_id, exc)

    def search(
        self,
        query: str,
        *,
        tenant_id: str,
        company_id: str,
        k: int = 8,
    ) -> list[dict]:
        collection = get_collection()
        query_embedding = _embedder.embed_query(query)
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=k,
            where={
                "$and": [
                    {"tenant_id": tenant_id},
                    {"company_id": company_id},
                ]
            },
        )
        docs: list[dict] = []
        ids = (results.get("ids") or [[]])[0]
        distances = (results.get("distances") or [[]])[0]
        documents = (results.get("documents") or [[]])[0]
        metadatas = (results.get("metadatas") or [[]])[0]
        for i, doc_id in enumerate(ids):
            docs.append(
                {
                    "id": doc_id,
                    "text": documents[i] if i < len(documents) else "",
                    "metadata": metadatas[i] if i < len(metadatas) else {},
                    "distance": distances[i] if i < len(distances) else None,
                }
            )
        return docs
