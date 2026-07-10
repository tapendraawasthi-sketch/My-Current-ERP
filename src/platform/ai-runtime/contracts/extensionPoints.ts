import type { AiRuntimeRequest, FrozenAiOutput, PipelineContext } from "../types";

export type AiRuntimeExtensionPoint =
  | "before_observe"
  | "after_observe"
  | "before_understand"
  | "after_understand"
  | "before_retrieve"
  | "after_retrieve"
  | "before_reason"
  | "after_reason"
  | "before_plan"
  | "after_plan"
  | "before_verify_plan"
  | "after_verify_plan"
  | "before_execute"
  | "after_execute"
  | "before_verify_result"
  | "after_verify_result"
  | "before_explain"
  | "after_explain"
  | "before_learn"
  | "after_learn"
  | "before_complete";

export interface AiRuntimeHookContext {
  readonly request: AiRuntimeRequest;
  readonly pipeline: PipelineContext;
  readonly output?: FrozenAiOutput;
}

export interface AiRuntimePlugin {
  readonly id: string;
  readonly version: string;
  readonly extensionPoints: readonly AiRuntimeExtensionPoint[];
  onHook(point: AiRuntimeExtensionPoint, ctx: AiRuntimeHookContext): Promise<AiRuntimeHookContext | void>;
}

export interface IAiRuntimeExtensionRegistry {
  register(plugin: AiRuntimePlugin): void;
  unregister(pluginId: string): void;
  runHooks(point: AiRuntimeExtensionPoint, ctx: AiRuntimeHookContext): Promise<AiRuntimeHookContext>;
  listPlugins(): readonly AiRuntimePlugin[];
}

/** Future extension point catalog — implementation paths for upcoming adapters. */
export const AI_RUNTIME_FUTURE_EXTENSIONS = {
  llmProvider: "reasoning/llmProvider.ts",
  vectorMemory: "memory/vectorMemoryAdapter.ts",
  ocrProvider: "tool-router/tools/ocrTool.ts",
  customTools: "tool-router/toolRouter.ts",
  pipelinePlugins: "extensionRegistry.ts",
  uiAdapter: "src/components/sutra-ai/",
  niosCoreBridge: "src/domains/nios-core/niosRuntime.ts",
} as const;

export type AiRuntimeFutureExtensionKey = keyof typeof AI_RUNTIME_FUTURE_EXTENSIONS;
