"""Knowledge pipeline dependency container."""

from __future__ import annotations

from dataclasses import dataclass, field

from backend.knowledge.adapters.chroma_store import ChromaDocumentStore
from backend.knowledge.adapters.ollama_embedder import OllamaEmbeddingProvider
from backend.knowledge.adapters.r2_storage import R2ObjectStorage
from backend.knowledge.audit import KnowledgeAuditLogger
from backend.knowledge.jobs.queue import create_job_queue
from backend.knowledge.pipeline.chunker import MarkdownChunker
from backend.knowledge.pipeline.extractors import DocumentTextExtractor
from backend.knowledge.pipeline.orchestrator import KnowledgeIngestionOrchestrator
from backend.knowledge.repository import KnowledgeRepository


@dataclass
class KnowledgeContainer:
    """Wires all pipeline dependencies (loosely coupled via protocols)."""

    repository: KnowledgeRepository = field(default_factory=KnowledgeRepository)
    storage: R2ObjectStorage = field(default_factory=R2ObjectStorage)
    extractor: DocumentTextExtractor = field(default_factory=DocumentTextExtractor)
    chunker: MarkdownChunker = field(default_factory=MarkdownChunker)
    embedder: OllamaEmbeddingProvider = field(default_factory=OllamaEmbeddingProvider)
    vector_store: ChromaDocumentStore = field(default_factory=ChromaDocumentStore)
    audit: KnowledgeAuditLogger = field(default_factory=KnowledgeAuditLogger)
    job_queue: object = field(default_factory=create_job_queue)
    _orchestrator: KnowledgeIngestionOrchestrator | None = field(
        default=None, init=False, repr=False
    )

    @property
    def orchestrator(self) -> KnowledgeIngestionOrchestrator:
        if self._orchestrator is None:
            self._orchestrator = KnowledgeIngestionOrchestrator(
                repository=self.repository,
                storage=self.storage,
                extractor=self.extractor,
                chunker=self.chunker,
                embedder=self.embedder,
                vector_store=self.vector_store,
                audit=self.audit,
                job_queue=self.job_queue,
            )
        return self._orchestrator


_container: KnowledgeContainer | None = None


def get_knowledge_container() -> KnowledgeContainer:
    global _container
    if _container is None:
        _container = KnowledgeContainer()
    return _container


def reset_knowledge_container() -> None:
    global _container
    _container = None
