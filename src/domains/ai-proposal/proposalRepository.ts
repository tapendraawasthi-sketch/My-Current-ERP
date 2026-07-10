import type { AiProposal } from "./proposalTypes";

const proposals = new Map<string, AiProposal>();

export function saveProposal(proposal: AiProposal): void {
  proposals.set(proposal.id, proposal);
}

export function getProposalById(id: string): AiProposal | null {
  return proposals.get(id) ?? null;
}

export function listAllProposals(): AiProposal[] {
  return Array.from(proposals.values());
}

export function listProposalsByStatus(status: AiProposal["status"]): AiProposal[] {
  return listAllProposals().filter((p) => p.status === status);
}

export function listProposalsBySession(sessionId: string): AiProposal[] {
  return listAllProposals().filter((p) => p.sessionId === sessionId);
}

export function deleteProposal(id: string): boolean {
  return proposals.delete(id);
}

export function clearProposalRepository(): void {
  proposals.clear();
}
