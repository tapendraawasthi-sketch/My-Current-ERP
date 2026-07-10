export interface WorkflowDescriptor {
  id: string;
  name: string;
  steps: string[];
  capabilityIds: string[];
}

const workflows = new Map<string, WorkflowDescriptor>();

const DEFAULT_WORKFLOWS: WorkflowDescriptor[] = [
  {
    id: "invoice-assist",
    name: "Invoice Assistance",
    steps: ["observe", "plan", "propose"],
    capabilityIds: ["erp.propose.invoice"],
  },
  {
    id: "khata-assist",
    name: "Khata Assistance",
    steps: ["observe", "plan", "propose"],
    capabilityIds: ["khata.propose.entry"],
  },
];

for (const wf of DEFAULT_WORKFLOWS) {
  workflows.set(wf.id, wf);
}

export function registerWorkflow(descriptor: WorkflowDescriptor): void {
  workflows.set(descriptor.id, descriptor);
}

export function getWorkflow(id: string): WorkflowDescriptor | null {
  return workflows.get(id) ?? null;
}

export function listWorkflows(): WorkflowDescriptor[] {
  return Array.from(workflows.values());
}
