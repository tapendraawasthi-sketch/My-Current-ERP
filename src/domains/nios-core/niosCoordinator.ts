import type { NiosProposal } from "./niosKernel";
import { listAgents } from "./agentRegistry";
import { listCapabilities } from "./capabilityRegistry";

export interface CoordinatorTask {
  id: string;
  agentId: string;
  capabilityId: string;
  input: Record<string, unknown>;
}

export interface CoordinatorResult {
  taskId: string;
  agentId: string;
  output: Record<string, unknown>;
  proposals: NiosProposal[];
}

export async function coordinateAgents(tasks: CoordinatorTask[]): Promise<CoordinatorResult[]> {
  const agents = listAgents();
  const results: CoordinatorResult[] = [];

  for (const task of tasks) {
    const agent = agents.find((a) => a.id === task.agentId);
    if (!agent) continue;
    results.push({
      taskId: task.id,
      agentId: task.agentId,
      output: { status: "coordinated", capabilityId: task.capabilityId },
      proposals: [],
    });
  }
  return results;
}

export function selectAgentForCapability(capabilityId: string): string | null {
  const capability = listCapabilities().find((c) => c.id === capabilityId);
  if (!capability) return null;
  const agent = listAgents().find((a) => a.capabilities.includes(capabilityId));
  return agent?.id ?? null;
}
