import type { AiProposal } from "./proposalTypes";

const queue: AiProposal[] = [];

export function enqueueApproval(proposal: AiProposal): void {
  queue.push(proposal);
}

export function dequeueApproval(): AiProposal | null {
  return queue.shift() ?? null;
}

export function listApprovalQueue(): AiProposal[] {
  return [...queue];
}

export function removeFromQueue(proposalId: string): void {
  const index = queue.findIndex((p) => p.id === proposalId);
  if (index >= 0) queue.splice(index, 1);
}

export function clearApprovalQueue(): void {
  queue.length = 0;
}
