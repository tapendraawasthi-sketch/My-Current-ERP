import type { JsonObject } from "@fios/kernel";
import type { FrozenConfidenceAssessment } from "../types";

export type AiToolId =
  | "accounting_engine"
  | "inventory"
  | "tax"
  | "ocr"
  | "knowledge"
  | "reports"
  | "calculator"
  | "simulation"
  | "search"
  | "memory";

export type AiPermission =
  | "read:accounts"
  | "read:inventory"
  | "read:reports"
  | "read:parties"
  | "read:settings"
  | "write:command"
  | "write:proposal"
  | "read:memory"
  | "write:memory"
  | "run:simulation"
  | "run:ocr";

export interface AiToolMetadata {
  readonly id: AiToolId;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly domain: string;
}

export interface AiToolCostProfile {
  readonly computeUnits: number;
  readonly tokenEstimate: number;
  readonly currency: "internal";
}

export interface AiToolLatencyProfile {
  readonly p50Ms: number;
  readonly p99Ms: number;
  readonly timeoutMs: number;
}

export interface AiToolDefinition {
  readonly metadata: AiToolMetadata;
  readonly cost: AiToolCostProfile;
  readonly latency: AiToolLatencyProfile;
  readonly permissions: readonly AiPermission[];
  readonly minConfidence: number;
}

export interface AiToolInvocation {
  readonly toolId: AiToolId;
  readonly action: string;
  readonly payload: JsonObject;
  readonly correlationId?: string;
}

export interface AiToolResult {
  readonly toolId: AiToolId;
  readonly action: string;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
  readonly latencyMs: number;
  readonly confidence: FrozenConfidenceAssessment;
}

export interface IAiTool {
  readonly definition: AiToolDefinition;
  invoke(invocation: AiToolInvocation): Promise<AiToolResult>;
}

export interface IToolRouter {
  selectTools(intent: import("../types").FrozenIntent): readonly AiToolId[];
  invoke(invocation: AiToolInvocation): Promise<AiToolResult>;
  listTools(): readonly AiToolDefinition[];
  getTool(id: AiToolId): IAiTool | undefined;
}
