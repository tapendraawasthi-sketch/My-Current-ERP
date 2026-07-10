"""Evidence verification helpers for gateway verify/explain stages."""

from __future__ import annotations

from typing import Any

from ..contracts.intelligence_contract import ExplanationEnvelope, TruthRecord
from .evidence_engine import EvidenceEngine, EvidenceObject, EvidenceType, evidence_engine
from .provenance_graph import provenance_graph
from .truth_layer import validate_facts


def build_evidence_bundle(
    answer: str,
    capabilities_used: list[str],
    *,
    session_id: str | None = None,
    tenant_id: str | None = None,
    company_id: str | None = None,
    extra_evidence: list[EvidenceObject] | None = None,
    engine: EvidenceEngine | None = None,
) -> dict[str, Any]:
    """Create typed evidence, record provenance, validate, return explain payload."""
    eng = engine or evidence_engine
    objects: list[EvidenceObject] = list(extra_evidence or [])

    for cap_id in capabilities_used:
        objects.append(
            eng.from_capability_result(
                cap_id,
                answer[:500],
                lineage_ids=[o.id for o in objects[-3:]] if objects else None,
            )
        )

    merged = eng.merge(objects)
    validation = eng.validate_bundle(merged)
    truth_records = eng.to_truth_records(merged)

    node_ids: list[str] = []
    for obj in merged:
        node_ids.append(
            provenance_graph.record_evidence(
                obj.id,
                obj.type.value,
                obj.statement,
                obj.source,
                capability_id=obj.source,
                session_id=session_id,
                tenant_id=tenant_id,
                company_id=company_id,
                parent_ids=obj.lineage_ids or None,
            )
        )

    coverage = provenance_graph.coverage_for_session(session_id) if session_id else {}

    return {
        "evidence_objects": merged,
        "truth_records": truth_records,
        "validation": validation,
        "provenance_nodes": node_ids,
        "provenance_coverage": coverage,
    }


def explanation_with_evidence(
    summary: str,
    capabilities_used: list[str],
    *,
    confidence: float,
    session_id: str | None = None,
    tenant_id: str | None = None,
    company_id: str | None = None,
    formula_used: list[str] | None = None,
    reasoning_chain: list[str] | None = None,
    extra_truth: list[TruthRecord] | None = None,
) -> ExplanationEnvelope:
    bundle = build_evidence_bundle(
        summary,
        capabilities_used,
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
    )
    evidence = list(extra_truth or []) + bundle["truth_records"]
    fact_check = validate_facts(
        [{"text": t.statement, "evidence": t.evidence, "source": t.source} for t in evidence]
    )
    return ExplanationEnvelope(
        summary=summary,
        evidence=fact_check.truth_records if fact_check.truth_records else evidence,
        confidence=confidence if bundle["validation"]["ok"] else min(confidence, 0.5),
        formula_used=formula_used or capabilities_used,
        reasoning_chain=reasoning_chain,
    )


def evidence_from_federation(
    chunks: list[dict],
    source: str = "cap.knowledge.nepal.search",
) -> list[EvidenceObject]:
    objects: list[EvidenceObject] = []
    for chunk in chunks[:5]:
        text = str(chunk.get("text", ""))[:300]
        if not text:
            continue
        objects.append(
            evidence_engine.create(
                EvidenceType.RESEARCH,
                text,
                source,
                confidence=float(chunk.get("score", 0.8)),
                metadata={"title": chunk.get("title"), "url": chunk.get("url")},
            )
        )
    return objects
