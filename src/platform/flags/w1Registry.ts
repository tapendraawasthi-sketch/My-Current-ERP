export type Wave1Flag = "W1_FAIL_CLOSED_INIT" | "W1_PERIOD_LOCK_ENFORCE";

export interface W1FlagContext {
  env?: string;
}

const DEFAULT_W1_FLAGS: Record<Wave1Flag, boolean> = {
  W1_FAIL_CLOSED_INIT: true,
  W1_PERIOD_LOCK_ENFORCE: true,
};

const w1EnvOverrides: Partial<Record<Wave1Flag, boolean>> = {};

function w1EnvKey(flag: Wave1Flag): string {
  return `VITE_${flag}`;
}

function readW1EnvFlag(flag: Wave1Flag): boolean | undefined {
  try {
    const raw = import.meta.env[w1EnvKey(flag)];
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
  } catch {
    /* non-Vite context (tests) */
  }
  return undefined;
}

export function isW1FlagEnabled(flag: Wave1Flag, _ctx?: W1FlagContext): boolean {
  if (flag in w1EnvOverrides) return Boolean(w1EnvOverrides[flag]);
  const fromEnv = readW1EnvFlag(flag);
  if (fromEnv !== undefined) return fromEnv;
  return DEFAULT_W1_FLAGS[flag] ?? false;
}

export function setW1FlagOverride(flag: Wave1Flag, enabled: boolean): void {
  w1EnvOverrides[flag] = enabled;
}

export function clearW1FlagOverrides(): void {
  for (const key of Object.keys(w1EnvOverrides) as Wave1Flag[]) {
    delete w1EnvOverrides[key];
  }
}

export function getW1FlagSnapshot(): Record<Wave1Flag, boolean> {
  const out = { ...DEFAULT_W1_FLAGS };
  for (const flag of Object.keys(DEFAULT_W1_FLAGS) as Wave1Flag[]) {
    out[flag] = isW1FlagEnabled(flag);
  }
  return out;
}
