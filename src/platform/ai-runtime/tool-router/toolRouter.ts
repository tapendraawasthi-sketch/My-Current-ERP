import type { AiToolDefinition, AiToolId, AiToolInvocation, AiToolResult, IAiTool, IToolRouter } from "../contracts/toolContract";
import type { FrozenIntent } from "../types";
import { ALL_TOOLS } from "./tools";

const DOMAIN_TOOL_MAP: Record<string, AiToolId[]> = {
  accounting: ["accounting_engine", "reports", "calculator", "simulation"],
  inventory: ["inventory", "search"],
  tax: ["tax", "reports"],
  reports: ["reports", "search"],
  knowledge: ["knowledge", "memory"],
  general: ["search", "memory", "knowledge"],
  documents: ["ocr"],
};

export class ToolRouter implements IToolRouter {
  private tools = new Map<AiToolId, IAiTool>();

  constructor(tools: readonly IAiTool[] = ALL_TOOLS) {
    for (const tool of tools) {
      this.tools.set(tool.definition.metadata.id, tool);
    }
  }

  selectTools(intent: FrozenIntent): readonly AiToolId[] {
    const domainTools = DOMAIN_TOOL_MAP[intent.domain] ?? DOMAIN_TOOL_MAP.general;
    const selected = new Set<AiToolId>(domainTools);

    if (intent.category === "simulation") selected.add("simulation");
    if (intent.category === "query" || intent.category === "report") selected.add("search");
    if (intent.category === "explanation") selected.add("knowledge");
    if (intent.action === "mutate") selected.add("accounting_engine");
    selected.add("memory");

    return [...selected].filter((id) => this.tools.has(id));
  }

  async invoke(invocation: AiToolInvocation): Promise<AiToolResult> {
    const tool = this.tools.get(invocation.toolId);
    if (!tool) {
      return {
        toolId: invocation.toolId,
        action: invocation.action,
        success: false,
        error: `Tool not registered: ${invocation.toolId}`,
        latencyMs: 0,
        confidence: {
          score: 0,
          level: "refused",
          risk: "low",
          missingEvidence: [`Unknown tool: ${invocation.toolId}`],
          nextAction: "refuse",
          rationale: "Tool not found",
        },
      };
    }
    return tool.invoke(invocation);
  }

  listTools(): readonly AiToolDefinition[] {
    return [...this.tools.values()].map((t) => t.definition);
  }

  getTool(id: AiToolId): IAiTool | undefined {
    return this.tools.get(id);
  }

  registerTool(tool: IAiTool): void {
    this.tools.set(tool.definition.metadata.id, tool);
  }
}

let routerInstance: ToolRouter | null = null;

export function getToolRouter(): ToolRouter {
  if (!routerInstance) routerInstance = new ToolRouter();
  return routerInstance;
}

export function resetToolRouter(): void {
  routerInstance = null;
}

export function registerTool(tool: IAiTool): void {
  getToolRouter().registerTool(tool);
}
