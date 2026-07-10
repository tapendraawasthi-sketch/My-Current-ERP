import type { AiProposal } from "./proposalTypes";
import { PROPOSAL_SCHEMA_VERSION } from "./proposalVersioning";

export function serializeProposal(proposal: AiProposal): string {
  return JSON.stringify({
    schemaVersion: PROPOSAL_SCHEMA_VERSION,
    proposal,
  });
}

export function deserializeProposal(raw: string): AiProposal | null {
  try {
    const parsed = JSON.parse(raw) as { proposal?: AiProposal };
    return parsed.proposal ?? null;
  } catch {
    return null;
  }
}

export function toAuditPayload(proposal: AiProposal): Record<string, unknown> {
  return {
    id: proposal.id,
    version: proposal.version,
    commandType: proposal.commandType,
    aggregateType: proposal.aggregateType,
    status: proposal.status,
    correlationId: proposal.correlationId,
  };
}
