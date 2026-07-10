import { ProposalStatuses } from "./proposalTypes";
import { listProposalsByStatus } from "./proposalRepository";
import { transitionProposal } from "./proposalLifecycle";
import { executionLogger } from "./executionLogger";

export function recoverFailedExecutions(): number {
  const failed = listProposalsByStatus(ProposalStatuses.FAILED);
  let recovered = 0;
  for (const proposal of failed) {
    if (transitionProposal(proposal.id, ProposalStatuses.APPROVED)) {
      recovered += 1;
    }
  }
  executionLogger.info("execution-recovery", { recovered });
  return recovered;
}

export function resetExecutingProposals(): number {
  const executing = listProposalsByStatus(ProposalStatuses.EXECUTING);
  let reset = 0;
  for (const proposal of executing) {
    if (transitionProposal(proposal.id, ProposalStatuses.APPROVED)) {
      reset += 1;
    }
  }
  return reset;
}
