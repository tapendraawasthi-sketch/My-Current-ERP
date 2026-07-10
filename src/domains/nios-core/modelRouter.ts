import type { NiosRequest } from "./niosKernel";
import type { ModelDescriptor } from "./modelRegistry";
import { listModels } from "./modelRegistry";
import { listEnabledProviders } from "./providerManager";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";

export function routeModel(request: NiosRequest): ModelDescriptor {
  const models = listModels();
  const providers = listEnabledProviders();

  if (!isMigrationFlagEnabled("MIGRATION_NIOS_PROVIDERS")) {
    return models.find((m) => m.id === "ollama-local") ?? models[0];
  }

  const ollamaAvailable = providers.some((p) => p.type === "ollama" && p.enabled);
  if (ollamaAvailable) {
    return models.find((m) => m.provider === "ollama") ?? models[0];
  }

  const reasoningRequired = (request.message?.length ?? 0) > 200;
  if (reasoningRequired) {
    return models.find((m) => m.supportsReasoning) ?? models[0];
  }

  return models.sort((a, b) => a.costTier - b.costTier)[0] ?? models[0];
}
