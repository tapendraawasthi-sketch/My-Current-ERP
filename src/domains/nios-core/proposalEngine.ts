import type { NiosProposal } from "./niosKernel";
import { ProposalStatus, updateKernelCounters } from "./niosKernel";

const proposals = new Map<string, NiosProposal>();

export interface CreateProposalInput {
  sessionId: string;
  capabilityId?: string;
  agentId?: string;
  commandType: string;
  aggregateType?: string;
  payload: Record<string, unknown>;
  rationale?: string;
  confidence?: number;
}

export function createProposal(input: CreateProposalInput): NiosProposal {
  const proposal: NiosProposal = {
    id: crypto.randomUUID(),
    sessionId: input.sessionId,
    agentId: input.agentId,
    capabilityId: input.capabilityId,
    commandType: input.commandType,
    aggregateType: input.aggregateType,
    payload: input.payload,
    status: ProposalStatus.PENDING,
    rationale: input.rationale,
    confidence: input.confidence ?? 0.7,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  proposals.set(proposal.id, proposal);
  updateKernelCounters({ pendingProposals: listPendingProposals().length });
  return proposal;
}

export function getProposal(id: string): NiosProposal | null {
  return proposals.get(id) ?? null;
}

export function listProposals(sessionId?: string): NiosProposal[] {
  const all = Array.from(proposals.values());
  if (!sessionId) return all;
  return all.filter((p) => p.sessionId === sessionId);
}

export function listPendingProposals(): NiosProposal[] {
  return listProposals().filter((p) => p.status === ProposalStatus.PENDING);
}

export function updateProposalStatus(
  id: string,
  status: NiosProposal["status"],
): NiosProposal | null {
  const proposal = proposals.get(id);
  if (!proposal) return null;
  proposal.status = status;
  proposals.set(id, proposal);
  updateKernelCounters({ pendingProposals: listPendingProposals().length });
  return proposal;
}
