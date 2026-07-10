"""Truth Layer — Phase 1."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..contracts.intelligence_contract import TruthRecord, utc_now


@dataclass
class TruthValidationResult:
    ok: bool
    truth_records: list[TruthRecord] = field(default_factory=list)
    unsupported: list[str] = field(default_factory=list)
    research_plan: list[str] | None = None


def create_truth_record(
    statement: str,
    source: str,
    evidence: list[str],
    *,
    confidence: float = 1.0,
    jurisdiction: str = "NP",
    verification_status: str = "verified_deterministic",
) -> TruthRecord:
    return TruthRecord(
        statement=statement,
        evidence=evidence,
        source=source,
        confidence=confidence,
        timestamp=utc_now(),
        jurisdiction=jurisdiction,
        verification_status=verification_status,
    )


def validate_facts(
    statements: list[dict[str, object]],
) -> TruthValidationResult:
    truth_records: list[TruthRecord] = []
    unsupported: list[str] = []

    for stmt in statements:
        text = str(stmt.get("text", ""))
        evidence = list(stmt.get("evidence") or [])
        source = str(stmt.get("source", "unknown"))
        if not evidence:
            unsupported.append(text)
            continue
        status = "verified_deterministic" if source.startswith("cap.engine") else "verified_evidence"
        truth_records.append(create_truth_record(text, source, evidence, verification_status=status))

    return TruthValidationResult(
        ok=len(unsupported) == 0,
        truth_records=truth_records,
        unsupported=unsupported,
        research_plan=(
            ["cap.knowledge.nepal.search", "federation.web.allowlisted", "agent.researcher"]
            if unsupported
            else None
        ),
    )
