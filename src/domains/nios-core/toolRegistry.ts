export interface ToolDescriptor {
  id: string;
  name: string;
  capabilityId: string;
  readOnly: boolean;
  schema?: Record<string, unknown>;
}

const tools = new Map<string, ToolDescriptor>();

const DEFAULT_TOOLS: ToolDescriptor[] = [
  { id: "query-trial-balance", name: "Query Trial Balance", capabilityId: "erp.read.trial_balance", readOnly: true },
  { id: "query-ledger", name: "Query Ledger", capabilityId: "erp.read.ledger", readOnly: true },
  { id: "propose-voucher", name: "Propose Voucher", capabilityId: "erp.propose.voucher", readOnly: true },
  { id: "propose-invoice", name: "Propose Invoice", capabilityId: "erp.propose.invoice", readOnly: true },
];

for (const tool of DEFAULT_TOOLS) {
  tools.set(tool.id, tool);
}

export function registerTool(descriptor: ToolDescriptor): void {
  tools.set(descriptor.id, descriptor);
}

export function getTool(id: string): ToolDescriptor | null {
  return tools.get(id) ?? null;
}

export function listTools(): ToolDescriptor[] {
  return Array.from(tools.values());
}

export function listReadOnlyTools(): ToolDescriptor[] {
  return listTools().filter((t) => t.readOnly);
}
