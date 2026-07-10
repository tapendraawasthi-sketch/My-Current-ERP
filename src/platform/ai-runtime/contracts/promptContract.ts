import type { JsonObject } from "@fios/kernel";

export interface PromptTemplateVersion {
  readonly id: string;
  readonly version: string;
  readonly domain: string;
  readonly template: string;
  readonly outputSchema: JsonObject;
  readonly createdAt: string;
  readonly deprecated?: boolean;
}

export interface PromptAssemblyInput {
  readonly systemTemplateId: string;
  readonly domainContext?: string;
  readonly businessContext?: JsonObject;
  readonly retrievedKnowledge?: readonly string[];
  readonly conversationHistory?: readonly string[];
  readonly executionConstraints?: readonly string[];
  readonly outputSchema?: JsonObject;
}

export interface AssembledPrompt {
  readonly templateId: string;
  readonly version: string;
  readonly system: string;
  readonly user?: string;
  readonly outputSchema: JsonObject;
  readonly tokenEstimate: number;
  readonly assembledAt: string;
}

export interface IPromptRegistry {
  get(id: string, version?: string): PromptTemplateVersion | undefined;
  list(domain?: string): readonly PromptTemplateVersion[];
  register(template: PromptTemplateVersion): void;
}

export interface IPromptBuilder {
  assemble(input: PromptAssemblyInput): AssembledPrompt;
}
