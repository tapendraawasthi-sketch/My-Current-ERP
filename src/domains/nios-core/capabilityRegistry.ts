export interface CapabilityDescriptor {
  id: string;
  version: string;
  tier: "capability" | "skill" | "workflow";
  description?: string;
  provides: string[];
  requires: string[];
  readOnly: boolean;
}

const capabilities = new Map<string, CapabilityDescriptor>();

const DEFAULT_CAPABILITIES: CapabilityDescriptor[] = [
  { id: "erp.read.trial_balance", version: "1.0", tier: "capability", provides: ["trial_balance"], requires: [], readOnly: true },
  { id: "erp.read.ledger", version: "1.0", tier: "capability", provides: ["ledger"], requires: [], readOnly: true },
  { id: "erp.propose.voucher", version: "1.0", tier: "capability", provides: ["voucher_proposal"], requires: ["approval"], readOnly: true },
  { id: "erp.propose.invoice", version: "1.0", tier: "capability", provides: ["invoice_proposal"], requires: ["approval"], readOnly: true },
  { id: "khata.propose.entry", version: "1.0", tier: "capability", provides: ["khata_proposal"], requires: ["approval"], readOnly: true },
];

for (const cap of DEFAULT_CAPABILITIES) {
  capabilities.set(cap.id, cap);
}

export function registerCapability(descriptor: CapabilityDescriptor): void {
  capabilities.set(descriptor.id, descriptor);
}

export function getCapability(id: string): CapabilityDescriptor | null {
  return capabilities.get(id) ?? null;
}

export function listCapabilities(): CapabilityDescriptor[] {
  return Array.from(capabilities.values());
}
