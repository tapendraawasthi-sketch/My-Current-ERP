import type { DeepReadonly } from "./immutable";

export type EvidenceSource =
  | "query_bus"
  | "tool"
  | "memory"
  | "knowledge"
  | "user"
  | "event_bus";

export interface EvidenceItem {
  readonly id: string;
  readonly source: EvidenceSource;
  readonly label: string;
  readonly content: unknown;
  readonly relevance: number;
  readonly retrievedAt: string;
}

export interface EvidenceBundle {
  readonly id: string;
  readonly items: readonly EvidenceItem[];
  readonly queryCount: number;
  readonly timestamp: string;
}

export type FrozenEvidence = DeepReadonly<EvidenceBundle>;
export type FrozenEvidenceItem = DeepReadonly<EvidenceItem>;
