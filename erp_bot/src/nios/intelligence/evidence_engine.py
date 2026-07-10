"""Universal Evidence Engine — 11 typed evidence objects."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any
from uuid import uuid4

from ..contracts.intelligence_contract import TruthRecord, utc_now


class EvidenceType(str, Enum):
    ERP = "erp"
    LAW = "law"
    ONTOLOGY = "ontology"
    USER = "user"
    OCR = "ocr"
    BANK = "bank"
    GRAPH = "graph"
    RESEARCH = "research"
    TOOL = "tool"
    SIMULATION = "simulation"
    INFERENCE = "inference"
    CONVERSATION = "conversation"


# Authority ranking per plan (higher = more trusted for financial/legal facts)
AUTHORITY_BY_TYPE: dict[EvidenceType, float] = {
    EvidenceType.TOOL: 1.0,
    EvidenceType.ERP: 0.98,
    EvidenceType.BANK: 0.97,
    EvidenceType.LAW: 0.95,
    EvidenceType.ONTOLOGY: 0.93,
    EvidenceType.GRAPH: 0.90,
    EvidenceType.SIMULATION: 0.88,
    EvidenceType.OCR: 0.85,
    EvidenceType.RESEARCH: 0.82,
    EvidenceType.INFERENCE: 0.75,
    EvidenceType.CONVERSATION: 0.70,
    EvidenceType.USER: 0.60,
}


@dataclass
class EvidenceObject:
    id: str
    type: EvidenceType
    statement: str
    source: str
    confidence: float
    timestamp: str
    authority: float = 0.9
    jurisdiction: str = "NP"
    lineage_ids: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    verification_status: str = "verified_evidence"

    def to_truth_record(self) -> TruthRecord:
        return TruthRecord(
            statement=self.statement,
            evidence=[self.id, *self.lineage_ids],
            source=self.source,
            confidence=self.confidence,
            timestamp=self.timestamp,
            jurisdiction=self.jurisdiction,
            verification_status=self.verification_status,
            knowledge_version=self.metadata.get("knowledge_version"),
        )


class EvidenceEngine:
    """Create, validate, and merge typed evidence objects."""

    def create(
        self,
        evidence_type: EvidenceType | str,
        statement: str,
        source: str,
        *,
        confidence: float = 0.9,
        lineage_ids: list[str] | None = None,
        metadata: dict | None = None,
        verification_status: str | None = None,
    ) -> EvidenceObject:
        etype = EvidenceType(evidence_type) if isinstance(evidence_type, str) else evidence_type
        if source.startswith("cap.engine"):
            verification_status = verification_status or "verified_deterministic"
        else:
            verification_status = verification_status or "verified_evidence"

        return EvidenceObject(
            id=str(uuid4()),
            type=etype,
            statement=statement,
            source=source,
            confidence=confidence,
            timestamp=utc_now(),
            authority=AUTHORITY_BY_TYPE.get(etype, 0.8),
            lineage_ids=lineage_ids or [],
            metadata=metadata or {},
            verification_status=verification_status,
        )

    def from_capability_result(
        self,
        capability_id: str,
        statement: str,
        *,
        evidence_type: EvidenceType | None = None,
        lineage_ids: list[str] | None = None,
        metadata: dict | None = None,
    ) -> EvidenceObject:
        etype = evidence_type or self._infer_type(capability_id)
        return self.create(
            etype,
            statement,
            capability_id,
            confidence=1.0 if capability_id.startswith("cap.engine") else 0.9,
            lineage_ids=lineage_ids,
            metadata=metadata,
        )

    def _infer_type(self, capability_id: str) -> EvidenceType:
        if capability_id.startswith("cap.engine"):
            return EvidenceType.TOOL
        if "erp" in capability_id:
            return EvidenceType.ERP
        if "legal" in capability_id or "law" in capability_id:
            return EvidenceType.LAW
        if "ontology" in capability_id:
            return EvidenceType.ONTOLOGY
        if "ocr" in capability_id:
            return EvidenceType.OCR
        if "simulation" in capability_id:
            return EvidenceType.SIMULATION
        if "knowledge" in capability_id or "research" in capability_id:
            return EvidenceType.RESEARCH
        if "graph" in capability_id:
            return EvidenceType.GRAPH
        return EvidenceType.INFERENCE

    def merge(self, objects: list[EvidenceObject]) -> list[EvidenceObject]:
        """Sort by authority × confidence, dedupe by statement."""
        seen: set[str] = set()
        merged: list[EvidenceObject] = []
        for obj in sorted(objects, key=lambda o: -(o.authority * o.confidence)):
            key = obj.statement[:100]
            if key in seen:
                continue
            seen.add(key)
            merged.append(obj)
        return merged

    def validate_bundle(self, objects: list[EvidenceObject]) -> dict[str, Any]:
        if not objects:
            return {
                "ok": False,
                "coverage": 0.0,
                "unsupported": ["No evidence objects"],
                "objects": [],
            }
        has_tool_or_erp = any(o.type in (EvidenceType.TOOL, EvidenceType.ERP, EvidenceType.LAW) for o in objects)
        coverage = len(objects) / max(len(objects), 1)
        if has_tool_or_erp:
            coverage = min(1.0, coverage + 0.2)
        return {
            "ok": has_tool_or_erp or any(o.authority >= 0.9 for o in objects),
            "coverage": round(coverage, 3),
            "count": len(objects),
            "types": list({o.type.value for o in objects}),
            "objects": [asdict(o) for o in objects],
        }

    def to_truth_records(self, objects: list[EvidenceObject]) -> list[TruthRecord]:
        return [o.to_truth_record() for o in objects]


evidence_engine = EvidenceEngine()
