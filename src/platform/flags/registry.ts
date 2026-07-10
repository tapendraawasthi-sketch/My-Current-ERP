export type MigrationFlag =
  | "MIGRATION_COMMAND_BUS"
  | "MIGRATION_EVENT_BUS"
  | "MIGRATION_EVENT_STORE"
  | "MIGRATION_DUAL_WRITE"
  | "MIGRATION_QUERY_FACADE"
  | "MIGRATION_QUERY_BUS"
  | "MIGRATION_PROJECTIONS"
  | "MIGRATION_SHADOW_PROJECTIONS"
  | "MIGRATION_OIDC"
  | "MIGRATION_EVENT_SYNC"
  | "MIGRATION_CQRS_REPORTS"
  | "MIGRATION_NIOS_COMMAND_GATE"
  | "MIGRATION_PLUGINS"
  | "MIGRATION_SAFE_OPEN_DB"
  | "MIGRATION_STRUCTURED_ERRORS"
  | "MIGRATION_CORRELATION_IDS"
  | "MIGRATION_GOLDEN_CI"
  | "MIGRATION_DOMAIN_FACADES"
  | "MIGRATION_IDENTITY"
  | "MIGRATION_JWT_VALIDATION"
  | "MIGRATION_VECTOR_CLOCKS"
  | "MIGRATION_CONFLICT_ENGINE"
  | "MIGRATION_INVENTORY_ENGINE"
  | "MIGRATION_INVENTORY_PARITY"
  | "MIGRATION_ACCOUNTING_ENGINE"
  | "MIGRATION_ACCOUNTING_PARITY"
  | "MIGRATION_ACCOUNTING_REPLAY"
  | "MIGRATION_REPORT_ENGINE"
  | "MIGRATION_REPORT_CUTOVER"
  | "MIGRATION_REPORT_PARITY"
  | "MIGRATION_NIOS_CORE"
  | "MIGRATION_NIOS_MEMORY"
  | "MIGRATION_NIOS_REASONING"
  | "MIGRATION_NIOS_PROVIDERS"
  | "MIGRATION_AI_PROPOSALS"
  | "MIGRATION_AI_APPROVAL"
  | "MIGRATION_AI_EXECUTION"
  | "MIGRATION_AI_RUNTIME"
  | "MIGRATION_PLUGIN_KERNEL"
  | "MIGRATION_PLUGIN_SDK"
  | "MIGRATION_PLUGIN_SANDBOX";

export interface FlagContext {
  env?: string;
}

const DEFAULT_FLAGS: Record<MigrationFlag, boolean> = {
  MIGRATION_COMMAND_BUS: true,
  MIGRATION_EVENT_BUS: true,
  MIGRATION_EVENT_STORE: true,
  MIGRATION_DUAL_WRITE: false,
  MIGRATION_QUERY_FACADE: true,
  MIGRATION_QUERY_BUS: true,
  MIGRATION_PROJECTIONS: true,
  MIGRATION_SHADOW_PROJECTIONS: true,
  MIGRATION_OIDC: false,
  MIGRATION_EVENT_SYNC: true,
  MIGRATION_VECTOR_CLOCKS: true,
  MIGRATION_CONFLICT_ENGINE: true,
  MIGRATION_CQRS_REPORTS: false,
  MIGRATION_NIOS_COMMAND_GATE: true,
  MIGRATION_PLUGINS: false,
  MIGRATION_SAFE_OPEN_DB: true,
  MIGRATION_STRUCTURED_ERRORS: false,
  MIGRATION_CORRELATION_IDS: false,
  MIGRATION_GOLDEN_CI: false,
  MIGRATION_DOMAIN_FACADES: true,
  MIGRATION_IDENTITY: true,
  MIGRATION_JWT_VALIDATION: true,
  MIGRATION_INVENTORY_ENGINE: true,
  MIGRATION_INVENTORY_PARITY: true,
  MIGRATION_ACCOUNTING_ENGINE: true,
  MIGRATION_ACCOUNTING_PARITY: true,
  MIGRATION_ACCOUNTING_REPLAY: true,
  MIGRATION_REPORT_ENGINE: true,
  MIGRATION_REPORT_CUTOVER: false,
  MIGRATION_REPORT_PARITY: true,
  MIGRATION_NIOS_CORE: true,
  MIGRATION_NIOS_MEMORY: true,
  MIGRATION_NIOS_REASONING: true,
  MIGRATION_NIOS_PROVIDERS: true,
  MIGRATION_AI_PROPOSALS: true,
  MIGRATION_AI_APPROVAL: true,
  MIGRATION_AI_EXECUTION: false,
  MIGRATION_AI_RUNTIME: false,
  MIGRATION_PLUGIN_KERNEL: true,
  MIGRATION_PLUGIN_SDK: true,
  MIGRATION_PLUGIN_SANDBOX: true,
};

const envOverrides: Partial<Record<MigrationFlag, boolean>> = {};

function envKey(flag: MigrationFlag): string {
  return `VITE_${flag}`;
}

function readEnvFlag(flag: MigrationFlag): boolean | undefined {
  try {
    const raw = import.meta.env[envKey(flag)];
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
  } catch {
    /* non-Vite context */
  }
  return undefined;
}

export function isMigrationFlagEnabled(flag: MigrationFlag, _ctx?: FlagContext): boolean {
  if (flag in envOverrides) return Boolean(envOverrides[flag]);
  const fromEnv = readEnvFlag(flag);
  if (fromEnv !== undefined) return fromEnv;
  return DEFAULT_FLAGS[flag] ?? false;
}

export function setMigrationFlagOverride(flag: MigrationFlag, enabled: boolean): void {
  envOverrides[flag] = enabled;
}

export function clearMigrationFlagOverrides(): void {
  for (const key of Object.keys(envOverrides) as MigrationFlag[]) {
    delete envOverrides[key];
  }
}

export function getMigrationFlagSnapshot(): Record<MigrationFlag, boolean> {
  const out = { ...DEFAULT_FLAGS };
  for (const flag of Object.keys(DEFAULT_FLAGS) as MigrationFlag[]) {
    out[flag] = isMigrationFlagEnabled(flag);
  }
  return out;
}
