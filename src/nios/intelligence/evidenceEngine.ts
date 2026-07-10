/** Universal Evidence Engine — TS mirror of Python evidence_engine.py */

import type { EvidenceObject, EvidenceType, TruthRecord } from "../contracts/types";

const AUTHORITY: Record<EvidenceType, number> = {
  tool: 1.0,
  erp: 0.98,
  bank: 0.97,
  law: 0.95,
  ontology: 0.93,
  graph: 0.9,
  simulation: 0.88,
  ocr: 0.85,
  research: 0.82,
  inference: 0.75,
  conversation: 0.7,
  user: 0.6,
};

export function createEvidence(
  type: EvidenceType,
  statement: string,
  source: string,
  opts?: { confidence?: number; lineageIds?: string[]; metadata?: Record<string, unknown> },
): EvidenceObject {
  return {
    id: crypto.randomUUID(),
    type,
    statement,
    source,
    authority: AUTHORITY[type] ?? 0.8,
    confidence: opts?.confidence ?? 0.9,
    lineage_ids: opts?.lineageIds,
    metadata: opts?.metadata,
    timestamp: new Date().toISOString(),
    verification_status: source.startsWith("cap.engine") ? "verified_deterministic" : "verified_evidence",
  };
}

export function toTruthRecord(ev: EvidenceObject): TruthRecord {
  return {
    statement: ev.statement,
    evidence: [ev.id, ...(ev.lineage_ids ?? [])],
    source: ev.source,
    confidence: ev.confidence,
    timestamp: ev.timestamp,
    jurisdiction: ev.jurisdiction ?? "NP",
    verification_status: ev.verification_status ?? "verified_evidence",
  };
}

export function mergeEvidence(objects: EvidenceObject[]): EvidenceObject[] {
  const seen = new Set<string>();
  return [...objects]
    .sort((a, b) => b.authority * b.confidence - a.authority * a.confidence)
    .filter((o) => {
      const key = o.statement.slice(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
