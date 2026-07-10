import type { AuthStage, InitErrorState } from "../../store/store.types";
import { isW1FlagEnabled } from "../../platform/flags/w1Registry";

/** Application initialization lifecycle (single source of truth for startup state). */
export type InitLifecycleState =
  | "initializing"
  | "loading"
  | "ready"
  | "recoverable-error"
  | "fatal-error";

/** Single startup timeout used by initializeApp (App.tsx must not duplicate). */
export const INIT_APP_TIMEOUT_MS = 15000;

export const DATA_LOAD_WARNING_MESSAGE =
  "Some company data could not be loaded from the local database. Balances and reports may be incomplete until you sign out and sign in again, or use Backup & Restore.";

export function resolveInitFailureState(err: unknown): {
  authStage: AuthStage;
  isDbReady: boolean;
  initError: InitErrorState | null;
  initLifecycle: InitLifecycleState;
} {
  if (!isW1FlagEnabled("W1_FAIL_CLOSED_INIT")) {
    return {
      authStage: "no-company",
      isDbReady: true,
      initError: null,
      initLifecycle: "ready",
    };
  }
  const error = err as Error | undefined;
  return {
    authStage: "error",
    isDbReady: false,
    initLifecycle: "fatal-error",
    initError: {
      message: error?.message || "Application initialization failed.",
      code: error?.name || "INIT_FAILURE",
      occurredAt: new Date().toISOString(),
    },
  };
}

export function readyInitPatch(): {
  initLifecycle: InitLifecycleState;
  isDbReady: boolean;
  isInitializing: boolean;
} {
  return {
    initLifecycle: "ready",
    isDbReady: true,
    isInitializing: false,
  };
}

export function recoverableDataLoadPatch(): {
  initLifecycle: InitLifecycleState;
  isDbReady: boolean;
  dataLoadWarning: string;
} {
  return {
    initLifecycle: "recoverable-error",
    isDbReady: true,
    dataLoadWarning: DATA_LOAD_WARNING_MESSAGE,
  };
}
