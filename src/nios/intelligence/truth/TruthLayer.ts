/**
 * Truth Layer — Phase 1
 * Every fact must be evidence-bound. Unsupported facts trigger research plan.
 */

import type { TruthRecord, VerificationReport } from "../contracts/types";

export interface TruthValidationResult {
  ok: boolean;
  truthRecords: TruthRecord[];
  unsupported: string[];
  researchPlan?: string[];
}

export function createTruthRecord(
  statement: string,
  source: string,
  evidence: string[],
  options?: {
    confidence?: number;
    jurisdiction?: string;
    knowledge_version?: string;
    verification_status?: TruthRecord["verification_status"];
  },
): TruthRecord {
  return {
    statement,
    evidence,
    source,
    confidence: options?.confidence ?? 1.0,
    timestamp: new Date().toISOString(),
    jurisdiction: options?.jurisdiction ?? "NP",
    knowledge_version: options?.knowledge_version,
    verification_status: options?.verification_status ?? "verified_deterministic",
  };
}

export function validateFacts(
  statements: Array<{ text: string; evidence: string[]; source: string }>,
): TruthValidationResult {
  const truthRecords: TruthRecord[] = [];
  const unsupported: string[] = [];

  for (const stmt of statements) {
    if (!stmt.evidence.length) {
      unsupported.push(stmt.text);
      continue;
    }
    truthRecords.push(
      createTruthRecord(stmt.text, stmt.source, stmt.evidence, {
        verification_status:
          stmt.source.startsWith("cap.engine") ? "verified_deterministic" : "verified_evidence",
      }),
    );
  }

  return {
    ok: unsupported.length === 0,
    truthRecords,
    unsupported,
    researchPlan:
      unsupported.length > 0
        ? [
            "cap.knowledge.nepal.search",
            "federation.web.allowlisted",
            "agent.researcher",
          ]
        : undefined,
  };
}

export function mergeVerificationWithTruth(
  report: VerificationReport,
  validation: TruthValidationResult,
): VerificationReport {
  return {
    ...report,
    ok: report.ok && validation.ok,
    truthRecords: [...report.truthRecords, ...validation.truthRecords],
    checks: [
      ...report.checks,
      {
        name: "truth_layer",
        passed: validation.ok,
        detail:
          validation.unsupported.length > 0
            ? `Unsupported: ${validation.unsupported.join("; ")}`
            : "All facts evidenced",
      },
    ],
  };
}
