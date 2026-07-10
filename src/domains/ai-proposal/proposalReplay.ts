import { deserializeProposal, serializeProposal } from "./proposalSerializer";
import type { AiProposal } from "./proposalTypes";
import { createProposalRecord } from "./proposalStore";
import { recordProposalDiagnostic } from "./proposalDiagnostics";

export interface ProposalReplayResult {
  replayed: number;
  failed: number;
}

export function replayProposalsFromSnapshots(snapshots: string[]): ProposalReplayResult {
  let replayed = 0;
  let failed = 0;

  for (const snapshot of snapshots) {
    const proposal = deserializeProposal(snapshot);
    if (!proposal) {
      failed += 1;
      continue;
    }
    createProposalRecord({
      ...proposal,
      expiresAt: proposal.expiresAt,
    });
    replayed += 1;
  }

  recordProposalDiagnostic({
    stage: "replay-complete",
    message: `replayed=${replayed} failed=${failed}`,
    timestamp: new Date().toISOString(),
  });

  return { replayed, failed };
}

export function exportProposalSnapshots(proposals: AiProposal[]): string[] {
  return proposals.map(serializeProposal);
}
