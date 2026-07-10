import type { ICommandEnvelope, ICommandResult } from "@fios/kernel";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { executeCommand } from "@fios/command-bus";
import { submitProposal } from "@fios/ai-proposal";
import { executeApprovedProposal } from "@fios/ai-proposal";
import type { ICommandDispatcher, DispatchResult } from "../contracts/executionContract";
import type { CommandProposal } from "../types";
import { createImmutable } from "../types/immutable";
import { aiLogger } from "../aiLogger";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class CommandDispatcher implements ICommandDispatcher {
  buildEnvelope(params: {
    commandType: string;
    aggregateType: string;
    aggregateId?: string;
    payload: Record<string, unknown>;
    correlationId?: string;
    causationId?: string;
  }): ICommandEnvelope {
    return {
      commandId: generateId("cmd"),
      commandType: params.commandType,
      commandVersion: 1,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      payload: params.payload,
      correlationId: params.correlationId ?? generateId("corr"),
      causationId: params.causationId,
      issuedAt: new Date().toISOString(),
    };
  }

  async dispatchProposal(
    input: Omit<CommandProposal, "status" | "proposalId"> & {
      sessionId: string;
      agentId?: string;
      capabilityId?: string;
      confidence?: number;
      correlationId?: string;
    },
  ): Promise<DispatchResult> {
    if (!isMigrationFlagEnabled("MIGRATION_AI_PROPOSALS")) {
      return {
        proposal: createImmutable({
          ...input,
          status: "rejected" as const,
          rationale: input.rationale,
        }),
        executed: false,
        error: "MIGRATION_AI_PROPOSALS is disabled",
      };
    }

    const proposal = submitProposal({
      sessionId: input.sessionId,
      commandType: input.commandType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: input.payload,
      agentId: input.agentId ?? "ai-runtime",
      capabilityId: input.capabilityId ?? "ai-runtime-v1",
      rationale: input.rationale,
      confidence: input.confidence,
      correlationId: input.correlationId,
    });

    aiLogger.info("proposal-submitted", { proposalId: proposal.id });

    return {
      proposal: createImmutable({
        proposalId: proposal.id,
        commandType: input.commandType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payload: input.payload,
        rationale: input.rationale,
        status: "pending",
      }),
      executed: false,
    };
  }

  async dispatchApproved(proposalId: string): Promise<DispatchResult> {
    const result = await executeApprovedProposal(proposalId);
    const proposal = createImmutable({
      proposalId,
      commandType: "",
      aggregateType: "",
      payload: {},
      rationale: "",
      status: result.executed ? ("executed" as const) : ("rejected" as const),
    });

    return {
      proposal,
      commandResult: result.data as ICommandResult | undefined,
      executed: result.executed,
      error: result.error,
    };
  }
}

let dispatcherInstance: CommandDispatcher | null = null;

export function getCommandDispatcher(): CommandDispatcher {
  if (!dispatcherInstance) dispatcherInstance = new CommandDispatcher();
  return dispatcherInstance;
}

export function resetCommandDispatcher(): void {
  dispatcherInstance = null;
}

/** Direct command dispatch — only when MIGRATION_AI_EXECUTION auto-approves. */
export async function dispatchCommandViaBus(envelope: ICommandEnvelope): Promise<ICommandResult> {
  if (!isMigrationFlagEnabled("MIGRATION_COMMAND_BUS")) {
    throw new Error("MIGRATION_COMMAND_BUS is disabled");
  }
  aiLogger.info("command-dispatch", { commandType: envelope.commandType });
  return executeCommand({
    commandType: envelope.commandType,
    aggregateType: envelope.aggregateType,
    aggregateId: envelope.aggregateId,
    payload: envelope.payload,
    correlationId: envelope.correlationId,
    causationId: envelope.causationId,
  }) as Promise<ICommandResult>;
}
