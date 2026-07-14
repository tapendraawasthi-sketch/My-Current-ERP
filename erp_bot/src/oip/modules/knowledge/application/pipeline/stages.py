"""Knowledge retrieval pipeline stages — independently testable."""

from __future__ import annotations

import hashlib
import re
import uuid
from datetime import datetime, timezone
from typing import Protocol

from ...domain.value_objects import AuthorityLevel, HybridScore, PoisonReason, RetrievalMode, RetrievalScore
from ..ports.knowledge_ports import (
    AuthorityRegistryPort,
    HybridRankingPort,
    JurisdictionRegistryPort,
    KnowledgeRepositoryPort,
    LexicalSearchPort,
    SemanticSearchPort,
)
from .context import RetrievalPipelineContext


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class KnowledgeStage(Protocol):
    @property
    def name(self) -> str: ...

    async def run(self, context: RetrievalPipelineContext) -> RetrievalPipelineContext: ...


class NormalizeStage:
    name = "normalize"

    async def run(self, context: RetrievalPipelineContext) -> RetrievalPipelineContext:
        normalized = re.sub(r"\s+", " ", context.query.strip().lower())
        context.normalized_query = normalized
        context.audit_events.append({"stage": self.name, "query_len": len(normalized)})
        return context


class AuthorityFilterStage:
    name = "authority_filter"

    def __init__(self, authority: AuthorityRegistryPort, *, enforce: bool = True) -> None:
        self._authority = authority
        self._enforce = enforce

    async def run(self, context: RetrievalPipelineContext) -> RetrievalPipelineContext:
        if not self._enforce:
            return context
        context.allowed_authorities = self._authority.ordered_levels()
        context.audit_events.append({"stage": self.name, "authorities": list(context.allowed_authorities)})
        return context


class JurisdictionFilterStage:
    name = "jurisdiction_filter"

    def __init__(self, jurisdiction: JurisdictionRegistryPort) -> None:
        self._jurisdiction = jurisdiction

    async def run(self, context: RetrievalPipelineContext) -> RetrievalPipelineContext:
        if not self._jurisdiction.is_valid(context.jurisdiction):
            context.blocked = True
            context.audit_events.append({"stage": self.name, "valid": False})
            return context
        context.audit_events.append({"stage": self.name, "valid": True})
        return context


class TemporalFilterStage:
    name = "temporal_filter"

    def __init__(self, repository: KnowledgeRepositoryPort) -> None:
        self._repository = repository

    async def run(self, context: RetrievalPipelineContext) -> RetrievalPipelineContext:
        docs = await self._repository.list_documents_by_jurisdiction(
            tenant_id=context.tenant_id,
            jurisdiction=context.jurisdiction,
            as_of=context.as_of,
        )
        context.candidate_document_ids = [d.document_id for d in docs if d.status.value == "active"]
        context.audit_events.append({"stage": self.name, "candidates": len(context.candidate_document_ids)})
        return context


class LexicalSearchStage:
    name = "lexical_search"

    def __init__(self, lexical: LexicalSearchPort, *, enabled: bool = True) -> None:
        self._lexical = lexical
        self._enabled = enabled

    async def run(self, context: RetrievalPipelineContext) -> RetrievalPipelineContext:
        if context.blocked or not self._enabled:
            return context
        if context.mode == RetrievalMode.SEMANTIC:
            return context
        hits = await self._lexical.search(
            tenant_id=context.tenant_id,
            query=context.normalized_query,
            jurisdiction=context.jurisdiction,
            as_of=context.as_of,
        )
        context.lexical_hits = list(hits)
        context.audit_events.append({"stage": self.name, "hits": len(hits)})
        return context


class SemanticSearchStage:
    name = "semantic_search"

    def __init__(self, semantic: SemanticSearchPort, *, enabled: bool = True) -> None:
        self._semantic = semantic
        self._enabled = enabled

    async def run(self, context: RetrievalPipelineContext) -> RetrievalPipelineContext:
        if context.blocked or not self._enabled:
            return context
        if context.mode == RetrievalMode.LEXICAL:
            return context
        hits = await self._semantic.search(
            tenant_id=context.tenant_id,
            query=context.normalized_query,
            jurisdiction=context.jurisdiction,
            as_of=context.as_of,
        )
        context.semantic_hits = list(hits)
        context.audit_events.append({"stage": self.name, "hits": len(hits)})
        return context


class HybridRankStage:
    name = "hybrid_rank"

    def __init__(
        self,
        ranking: HybridRankingPort,
        authority: AuthorityRegistryPort,
        *,
        hybrid_enabled: bool = True,
    ) -> None:
        self._ranking = ranking
        self._authority = authority
        self._hybrid = hybrid_enabled

    async def run(self, context: RetrievalPipelineContext) -> RetrievalPipelineContext:
        if context.blocked:
            return context
        if context.mode == RetrievalMode.AUTHORITY_ONLY:
            docs = context.candidate_document_ids[:10]
            context.ranked_results = [{"document_id": d, "score": 1.0} for d in docs]
        else:
            ranked = await self._ranking.rank(
                lexical_hits=tuple(context.lexical_hits),
                semantic_hits=tuple(context.semantic_hits),
                authority_registry=self._authority,
                as_of=context.as_of,
            )
            context.ranked_results = list(ranked)
        context.scores = [
            HybridScore(
                combined=float(r.get("score", 0)),
                components=RetrievalScore(
                    lexical=float(r.get("lexical_score", 0)),
                    semantic=float(r.get("semantic_score", 0)),
                    authority=float(r.get("authority_score", 0)),
                    freshness=float(r.get("freshness_score", 0)),
                ),
            )
            for r in context.ranked_results
        ]
        context.audit_events.append({"stage": self.name, "ranked": len(context.ranked_results)})
        return context


class PoisonDetectionStage:
    name = "poison_detection"

    INJECTION_PATTERNS = ("ignore previous", "system prompt", "jailbreak", "<script")

    def __init__(self, repository: KnowledgeRepositoryPort, *, enabled: bool = True) -> None:
        self._repository = repository
        self._enabled = enabled

    async def run(self, context: RetrievalPipelineContext) -> RetrievalPipelineContext:
        if not self._enabled or context.blocked:
            return context
        safe: list[dict] = []
        for result in context.ranked_results:
            doc_id = result.get("document_id", "")
            doc = await self._repository.get_document(tenant_id=context.tenant_id, document_id=doc_id)
            if doc is None:
                context.blocked_documents.append({"document_id": doc_id, "reason": PoisonReason.HASH_MISMATCH.value})
                continue
            content_lower = doc.content.lower()
            if any(p in content_lower for p in self.INJECTION_PATTERNS):
                context.blocked_documents.append(
                    {"document_id": doc_id, "reason": PoisonReason.PROMPT_INJECTION.value}
                )
                continue
            if doc.effective_range.effective_to and doc.effective_range.effective_to < context.as_of:
                context.blocked_documents.append(
                    {"document_id": doc_id, "reason": PoisonReason.STALE_DOCUMENT.value}
                )
                continue
            if doc.metadata.get("suspicious"):
                context.blocked_documents.append(
                    {"document_id": doc_id, "reason": PoisonReason.SUSPICIOUS_METADATA.value}
                )
                continue
            stored_hash = doc.knowledge_hash.hash_value
            computed = hashlib.sha256(doc.content.encode()).hexdigest()
            if stored_hash != computed:
                context.blocked_documents.append(
                    {"document_id": doc_id, "reason": PoisonReason.HASH_MISMATCH.value}
                )
                continue
            # Attach short content for prompt grounding (interpretation-only).
            enriched = dict(result)
            enriched["title"] = doc.title
            enriched["snippet"] = (doc.content or "")[:400]
            safe.append(enriched)
        context.ranked_results = safe
        context.audit_events.append(
            {"stage": self.name, "blocked": len(context.blocked_documents), "safe": len(safe)}
        )
        return context


class EvidenceAssemblyStage:
    name = "evidence_assembly"

    async def run(self, context: RetrievalPipelineContext) -> RetrievalPipelineContext:
        if context.blocked:
            return context
        doc_ids = tuple(r.get("document_id", "") for r in context.ranked_results if r.get("document_id"))
        raw = "|".join(sorted(doc_ids)) + "|" + context.normalized_query
        evidence_hash = hashlib.sha256(raw.encode()).hexdigest()
        context.lineage_nodes.append({"node_type": "EvidenceBundle", "document_count": len(doc_ids)})
        context.audit_events.append({"stage": self.name, "bundle_docs": len(doc_ids), "hash": evidence_hash[:16]})
        return context
