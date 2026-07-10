import { isMigrationFlagEnabled } from "@/platform/flags/registry";

export interface NiosConfiguration {
  coreEnabled: boolean;
  memoryEnabled: boolean;
  reasoningEnabled: boolean;
  providersEnabled: boolean;
  proposalOnly: boolean;
  maxSessionAgeMs: number;
  tokenBudgetDefault: number;
}

export function getNiosConfiguration(): NiosConfiguration {
  return {
    coreEnabled: isMigrationFlagEnabled("MIGRATION_NIOS_CORE"),
    memoryEnabled: isMigrationFlagEnabled("MIGRATION_NIOS_MEMORY"),
    reasoningEnabled: isMigrationFlagEnabled("MIGRATION_NIOS_REASONING"),
    providersEnabled: isMigrationFlagEnabled("MIGRATION_NIOS_PROVIDERS"),
    proposalOnly: true,
    maxSessionAgeMs: 24 * 60 * 60 * 1000,
    tokenBudgetDefault: 8192,
  };
}
