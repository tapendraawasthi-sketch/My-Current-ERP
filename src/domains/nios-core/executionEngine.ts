import type { ExecutionPlan } from "./planner";
import type { NiosProposal } from "./niosKernel";
import { createProposal } from "./proposalEngine";
import { listReadOnlyTools } from "./toolRegistry";
import { recordDiagnostic } from "./diagnostics";

export interface ExecutionResult {
  planId: string;
  outputs: Record<string, unknown>;
  proposals: NiosProposal[];
  readOnlyToolsUsed: string[];
}

export async function executePlan(
  plan: ExecutionPlan,
  sessionId: string,
  reasoning: { requiresProposal: boolean; summary: string },
): Promise<ExecutionResult> {
  const readOnlyToolsUsed = listReadOnlyTools().map((t) => t.id);
  const proposals: NiosProposal[] = [];

  if (reasoning.requiresProposal) {
    const proposeStep = plan.steps.find((s) => s.action === "propose");
    if (proposeStep) {
      proposals.push(
        createProposal({
          sessionId,
          capabilityId: proposeStep.capabilityId,
          commandType: mapCapabilityToCommand(proposeStep.capabilityId),
          payload: { planId: plan.id, summary: reasoning.summary },
          rationale: reasoning.summary,
        }),
      );
    }
  }

  recordDiagnostic({
    stage: "execution-complete",
    sessionId,
    message: `plan ${plan.id} executed with ${proposals.length} proposals`,
    timestamp: new Date().toISOString(),
  });

  return {
    planId: plan.id,
    outputs: { status: "completed", readOnly: true },
    proposals,
    readOnlyToolsUsed,
  };
}

function mapCapabilityToCommand(capabilityId: string): string {
  if (capabilityId.includes("voucher")) return "PostVoucher";
  if (capabilityId.includes("invoice")) return "PostInvoice";
  if (capabilityId.includes("khata")) return "PostKhataEntry";
  return "Unknown";
}
