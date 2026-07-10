import type { AiProposal } from "./proposalTypes";
import { ProposalStatuses } from "./proposalTypes";
import {
  getProposalById,
  listAllProposals,
  listProposalsByStatus,
  saveProposal,
} from "./proposalRepository";

export function createProposalRecord(
  input: Omit<AiProposal, "id" | "version" | "status" | "createdAt" | "updatedAt" | "correlationId"> & {
    correlationId?: string;
  },
): AiProposal {
  const now = new Date().toISOString();
  const proposal: AiProposal = {
    id: crypto.randomUUID(),
    version: 1,
    status: ProposalStatuses.PENDING,
    correlationId: input.correlationId ?? crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  saveProposal(proposal);
  return proposal;
}

export function updateProposalRecord(
  id: string,
  patch: Partial<AiProposal>,
): AiProposal | null {
  const existing = getProposalById(id);
  if (!existing) return null;
  const updated: AiProposal = {
    ...existing,
    ...patch,
    version: existing.version + 1,
    updatedAt: new Date().toISOString(),
  };
  saveProposal(updated);
  return updated;
}

export function getPendingProposals(): AiProposal[] {
  return listProposalsByStatus(ProposalStatuses.PENDING);
}

export function getApprovedProposals(): AiProposal[] {
  return listProposalsByStatus(ProposalStatuses.APPROVED);
}

export function countProposals(): number {
  return listAllProposals().length;
}
