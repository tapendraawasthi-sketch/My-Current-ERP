import { listCapabilities } from "./capabilityRegistry";
import { listAgents } from "./agentRegistry";
import { listModels } from "./modelRegistry";
import { listWorkflows } from "./workflowRegistry";
import { listSkills } from "./skillRegistry";
import { listTools } from "./toolRegistry";
import { listPrompts } from "./promptRegistry";
import { listExtensions } from "./extensionRegistry";

export function getNiosRegistrySnapshot() {
  return {
    capabilities: listCapabilities().length,
    agents: listAgents().length,
    models: listModels().length,
    workflows: listWorkflows().length,
    skills: listSkills().length,
    tools: listTools().length,
    prompts: listPrompts().length,
    extensions: listExtensions().length,
  };
}

export function validateRegistry(): string[] {
  const issues: string[] = [];
  if (listCapabilities().length === 0) issues.push("no capabilities registered");
  if (listAgents().length === 0) issues.push("no agents registered");
  return issues;
}
