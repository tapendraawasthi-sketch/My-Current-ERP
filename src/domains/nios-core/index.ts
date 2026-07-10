export {
  NIOS_CORE_VERSION,
  ProposalStatus,
  type ProposalStatusType,
  type NiosProposal,
  type NiosRequest,
  type NiosResponse,
  type NiosKernelState,
  getNiosKernelState,
  markKernelInitialized,
  updateKernelCounters,
} from "./niosKernel";

export { processNiosRequest, isNiosRuntimeReady, initializeRuntime, shutdownRuntime } from "./niosRuntime";
export { coordinateAgents, selectAgentForCapability, type CoordinatorTask, type CoordinatorResult } from "./niosCoordinator";
export { getNiosRegistrySnapshot, validateRegistry } from "./niosRegistry";
export { registerCapability, getCapability, listCapabilities, type CapabilityDescriptor } from "./capabilityRegistry";
export { registerAgent, getAgent, listAgents, type AgentDescriptor } from "./agentRegistry";
export { registerModel, getModel, listModels, type ModelDescriptor } from "./modelRegistry";
export { registerWorkflow, getWorkflow, listWorkflows, type WorkflowDescriptor } from "./workflowRegistry";
export { registerSkill, getSkill, listSkills, type SkillDescriptor } from "./skillRegistry";
export { registerTool, getTool, listTools, listReadOnlyTools, type ToolDescriptor } from "./toolRegistry";
export { registerPrompt, getPrompt, listPrompts, renderPrompt, type PromptTemplate } from "./promptRegistry";
export { buildContext, type UnifiedContext } from "./contextEngine";
export { storeMemory, getMemorySnapshot, clearSessionMemory, listMemoryRecords, type MemoryRecord, type MemoryLevel } from "./memoryEngine";
export { addKnowledge, searchKnowledge, listKnowledge, clearKnowledge, type KnowledgeEntry } from "./knowledgeEngine";
export { retrieveContext, retrieveForCapability, type RetrievalResult } from "./retrievalEngine";
export { createPlan, type PlanStep, type ExecutionPlan } from "./planner";
export { runReasoning, type ReasoningResult } from "./reasoningEngine";
export { executePlan, type ExecutionResult } from "./executionEngine";
export { runOrchestration } from "./orchestrationEngine";
export {
  createProposal,
  getProposal,
  listProposals,
  listPendingProposals,
  updateProposalStatus,
  type CreateProposalInput,
} from "./proposalEngine";
export { requestApproval, approveProposal, rejectProposal, type ApprovalResult } from "./approvalGateway";
export { submitProposal, executeCommand, isCommandExecutionAllowed, type CommandGatewayResult } from "./commandGateway";
export { appendConversationTurn, getConversationHistory, clearConversation, getConversationSummary, type ConversationTurn } from "./conversationManager";
export { getOrCreateSession, getSession, listSessions, endSession, clearExpiredSessions, type NiosSession } from "./sessionManager";
export { setTokenBudget, recordTokenUsage, getTokenUsage, resetTokenBudget } from "./tokenManager";
export { registerProvider, getProvider, listProviders, listEnabledProviders, type ProviderDescriptor } from "./providerManager";
export { routeModel } from "./modelRouter";
export { trackCost, getSessionCost, getTotalCost, getCostBreakdown } from "./costTracker";
export { usageMetrics } from "./usageMetrics";
export { recordDiagnostic, getDiagnostics, clearDiagnostics, type DiagnosticRecord } from "./diagnostics";
export { niosLogger } from "./logger";
export { bootstrapNiosCore, shutdownNiosCore, isNiosCoreBootstrapped } from "./bootstrap";
export { NIOS_CORE_SCHEMA_VERSION, versionPayload, type VersionedPayload } from "./versioning";
export { checkHealth, type HealthStatus } from "./health";
export { recoverNiosCore, type RecoveryResult } from "./recovery";
export { getNiosConfiguration, type NiosConfiguration } from "./configuration";
export { registerPlugin, loadPlugin, unloadPlugin, listPlugins, type NiosPlugin } from "./pluginHost";
export { registerExtension, getExtension, listExtensions, getExtensionByEntryPoint, type ExtensionDescriptor } from "./extensionRegistry";
