import type { EntityId } from "@fios/kernel";

export const NIOS_CORE_VERSION = "1.0.0";

export const ProposalStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
} as const;

export type ProposalStatusType = (typeof ProposalStatus)[keyof typeof ProposalStatus];

export interface NiosProposal {
  id: EntityId;
  sessionId: string;
  agentId?: string;
  capabilityId?: string;
  commandType: string;
  aggregateType?: string;
  payload: Record<string, unknown>;
  status: ProposalStatusType;
  rationale?: string;
  confidence?: number;
  createdAt: string;
  expiresAt?: string;
}

export interface NiosRequest {
  sessionId: string;
  message: string;
  channel?: "chat" | "voice" | "ocr" | "api" | "event";
  context?: Record<string, unknown>;
  tenantId?: string;
  userId?: string;
}

export interface NiosResponse {
  sessionId: string;
  answer: string;
  proposals: NiosProposal[];
  engine: string;
  trace?: Record<string, unknown>;
}

export interface NiosKernelState {
  initialized: boolean;
  version: string;
  activeSessions: number;
  pendingProposals: number;
}

let kernelState: NiosKernelState = {
  initialized: false,
  version: NIOS_CORE_VERSION,
  activeSessions: 0,
  pendingProposals: 0,
};

export function getNiosKernelState(): NiosKernelState {
  return { ...kernelState };
}

export function markKernelInitialized(): void {
  kernelState = { ...kernelState, initialized: true };
}

export function updateKernelCounters(input: Partial<Pick<NiosKernelState, "activeSessions" | "pendingProposals">>): void {
  kernelState = { ...kernelState, ...input };
}
