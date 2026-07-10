import type { IPromptRegistry, PromptTemplateVersion } from "../contracts/promptContract";
import { ALL_PROMPT_TEMPLATES } from "./templates/system-v1";

export class PromptRegistry implements IPromptRegistry {
  private templates = new Map<string, PromptTemplateVersion[]>();

  constructor(templates: readonly PromptTemplateVersion[] = ALL_PROMPT_TEMPLATES) {
    for (const t of templates) {
      const key = t.id;
      const existing = this.templates.get(key) ?? [];
      existing.push(t);
      this.templates.set(key, existing);
    }
  }

  get(id: string, version?: string): PromptTemplateVersion | undefined {
    const versions = this.templates.get(id) ?? [];
    if (version) return versions.find((v) => v.version === version);
    return versions.filter((v) => !v.deprecated).sort((a, b) => b.version.localeCompare(a.version))[0];
  }

  list(domain?: string): readonly PromptTemplateVersion[] {
    const all = [...this.templates.values()].flat();
    return domain ? all.filter((t) => t.domain === domain) : all;
  }

  register(template: PromptTemplateVersion): void {
    const existing = this.templates.get(template.id) ?? [];
    existing.push(template);
    this.templates.set(template.id, existing);
  }
}

let registryInstance: PromptRegistry | null = null;

export function getPromptRegistry(): PromptRegistry {
  if (!registryInstance) registryInstance = new PromptRegistry();
  return registryInstance;
}

export function resetPromptRegistry(): void {
  registryInstance = null;
}
