export interface AgentDescriptor {
  id: string;
  name: string;
  capabilities: string[];
  entryPoint?: string;
  readOnly: boolean;
}

const agents = new Map<string, AgentDescriptor>();

const DEFAULT_AGENTS: AgentDescriptor[] = [
  { id: "sutra", name: "SUTRA Assistant", capabilities: ["erp.read.trial_balance", "erp.read.ledger"], entryPoint: "sutra", readOnly: true },
  { id: "falcon", name: "Falcon Assistant", capabilities: ["erp.read.trial_balance"], entryPoint: "falcon", readOnly: true },
  { id: "ekhata", name: "e-Khata Assistant", capabilities: ["khata.propose.entry"], entryPoint: "ekhata", readOnly: true },
  { id: "nios", name: "NIOS Core", capabilities: ["erp.propose.voucher", "erp.propose.invoice"], entryPoint: "nios", readOnly: true },
  { id: "orbix", name: "Orbix Assistant", capabilities: ["erp.read.ledger"], entryPoint: "orbix", readOnly: true },
];

for (const agent of DEFAULT_AGENTS) {
  agents.set(agent.id, agent);
}

export function registerAgent(descriptor: AgentDescriptor): void {
  agents.set(descriptor.id, descriptor);
}

export function getAgent(id: string): AgentDescriptor | null {
  return agents.get(id) ?? null;
}

export function listAgents(): AgentDescriptor[] {
  return Array.from(agents.values());
}
