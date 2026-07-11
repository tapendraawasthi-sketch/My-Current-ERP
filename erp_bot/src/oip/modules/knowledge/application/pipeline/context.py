"""Knowledge retrieval pipeline context."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ...domain.entities import EvidenceBundle, KnowledgeSnapshot, RetrievalExecution
from ...domain.value_objects import HybridScore, RetrievalMode


@dataclass
class RetrievalPipelineContext:
    retrieval: RetrievalExecution
    query: str
    normalized_query: str = ""
    mode: RetrievalMode = RetrievalMode.HYBRID
    jurisdiction: str = "nepal"
    as_of: str = ""
    tenant_id: str = ""
    company_id: str | None = None
    allowed_authorities: tuple[str, ...] = field(default_factory=tuple)
    candidate_document_ids: list[str] = field(default_factory=list)
    lexical_hits: list[dict[str, Any]] = field(default_factory=list)
    semantic_hits: list[dict[str, Any]] = field(default_factory=list)
    ranked_results: list[dict[str, Any]] = field(default_factory=list)
    blocked_documents: list[dict[str, Any]] = field(default_factory=list)
    scores: list[HybridScore] = field(default_factory=list)
    bundle: EvidenceBundle | None = None
    snapshot: KnowledgeSnapshot | None = None
    cache_hit: bool = False
    blocked: bool = False
    audit_events: list[dict[str, Any]] = field(default_factory=list)
    lineage_nodes: list[dict[str, Any]] = field(default_factory=list)
