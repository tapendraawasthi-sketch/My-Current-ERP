import type { DeepReadonly } from "./immutable";
import type { FrozenConfidenceAssessment } from "./confidence";

export type IntentCategory =
  | "query"
  | "command"
  | "report"
  | "simulation"
  | "explanation"
  | "conversation"
  | "unknown";

export interface ParsedIntent {
  readonly id: string;
  readonly rawInput: string;
  readonly category: IntentCategory;
  readonly domain: string;
  readonly action: string;
  readonly entities: Readonly<Record<string, unknown>>;
  readonly language: string;
  readonly confidence: FrozenConfidenceAssessment;
  readonly timestamp: string;
}

export type FrozenIntent = DeepReadonly<ParsedIntent>;
