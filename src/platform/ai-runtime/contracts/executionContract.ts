import type { ICommandEnvelope, ICommandResult } from "@fios/kernel";
import type { CommandProposal } from "../types";

export interface DispatchResult {
  readonly proposal: CommandProposal;
  readonly commandResult?: ICommandResult;
  readonly executed: boolean;
  readonly error?: string;
}

/**
 * Command dispatcher — the ONLY write path for AI runtime.
 * Never writes Zustand, Dexie, or repositories directly.
 */
export interface ICommandDispatcher {
  dispatchProposal(proposal: Omit<CommandProposal, "status" | "proposalId"> & {
    sessionId: string;
    agentId?: string;
    capabilityId?: string;
    confidence?: number;
    correlationId?: string;
  }): Promise<DispatchResult>;

  dispatchApproved(proposalId: string): Promise<DispatchResult>;

  buildEnvelope(params: {
    commandType: string;
    aggregateType: string;
    aggregateId?: string;
    payload: Record<string, unknown>;
    correlationId?: string;
    causationId?: string;
  }): ICommandEnvelope;
}
