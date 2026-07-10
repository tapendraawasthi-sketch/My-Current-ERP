export type {
  IIntelligenceCapability,
  IAiRuntime,
  IPipelineStage,
  ObserveInput,
  UnderstandInput,
  RetrieveInput,
  ReasonInput,
  PlanInput,
  VerifyPlanInput,
  ExecuteInput,
  VerifyInput,
  ExplainInput,
  LearnInput,
} from "./intelligenceContract";

export type {
  AiToolId,
  AiPermission,
  AiToolDefinition,
  AiToolInvocation,
  AiToolResult,
  IAiTool,
  IToolRouter,
} from "./toolContract";

export type {
  MemoryScope,
  MemoryEntry,
  IWorkingMemory,
  IConversationMemory,
  IBusinessMemory,
  ILongTermMemory,
  IMemoryStore,
} from "./memoryContract";

export type {
  PromptTemplateVersion,
  PromptAssemblyInput,
  AssembledPrompt,
  IPromptRegistry,
  IPromptBuilder,
} from "./promptContract";

export type { IApprovalGate, ApprovalDecision, RiskClassification } from "./approvalContract";
export type { IConfidenceEvaluator, ConfidencePolicyConfig } from "./confidenceContract";
export type { ICommandDispatcher, DispatchResult } from "./executionContract";
export type { AiRuntimeExtensionPoint, AiRuntimePlugin, AiRuntimeHookContext, IAiRuntimeExtensionRegistry, AiRuntimeFutureExtensionKey } from "./extensionPoints";
export { AI_RUNTIME_FUTURE_EXTENSIONS } from "./extensionPoints";
