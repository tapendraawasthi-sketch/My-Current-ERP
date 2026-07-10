import type { IPromptBuilder, PromptAssemblyInput, AssembledPrompt } from "../contracts/promptContract";
import { getPromptRegistry } from "./promptRegistry";

export class PromptBuilder implements IPromptBuilder {
  assemble(input: PromptAssemblyInput): AssembledPrompt {
    const registry = getPromptRegistry();
    const systemTemplate = registry.get(input.systemTemplateId);
    if (!systemTemplate) {
      throw new Error(`Prompt template not found: ${input.systemTemplateId}`);
    }

    const sections: string[] = [systemTemplate.template];

    if (input.domainContext) {
      sections.push(`\n## Domain Context\n${input.domainContext}`);
    }

    if (input.businessContext && Object.keys(input.businessContext).length > 0) {
      sections.push(`\n## Business Context\n${JSON.stringify(input.businessContext, null, 2)}`);
    }

    if (input.retrievedKnowledge?.length) {
      sections.push(`\n## Retrieved Knowledge\n${input.retrievedKnowledge.join("\n")}`);
    }

    if (input.conversationHistory?.length) {
      sections.push(`\n## Conversation\n${input.conversationHistory.join("\n")}`);
    }

    if (input.executionConstraints?.length) {
      sections.push(`\n## Execution Constraints\n${input.executionConstraints.join("\n")}`);
    }

    sections.push(`\n## Output Schema\n${JSON.stringify(input.outputSchema ?? systemTemplate.outputSchema, null, 2)}`);

    const system = sections.join("\n");
    const tokenEstimate = Math.ceil(system.length / 4);

    return {
      templateId: systemTemplate.id,
      version: systemTemplate.version,
      system,
      outputSchema: input.outputSchema ?? systemTemplate.outputSchema,
      tokenEstimate,
      assembledAt: new Date().toISOString(),
    };
  }
}

let builderInstance: PromptBuilder | null = null;

export function getPromptBuilder(): PromptBuilder {
  if (!builderInstance) builderInstance = new PromptBuilder();
  return builderInstance;
}

export function resetPromptBuilder(): void {
  builderInstance = null;
}
