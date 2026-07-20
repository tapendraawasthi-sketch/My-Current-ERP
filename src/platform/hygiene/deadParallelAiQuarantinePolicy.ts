/**
 * PR-H3 / ADR_0094 — dead parallel AI quarantine (flag OFF; no deletes).
 */

export const DEAD_PARALLEL_AI_QUARANTINE_ADR = "ADR_0094" as const;
export const DEAD_PARALLEL_AI_QUARANTINE_STEP = "PR-H3" as const;
export const DEAD_PARALLEL_AI_QUARANTINE_DECISION =
  "SECONDARY_AI_STACK_QUARANTINE" as const;
export const PRIMARY_CHAT_ROUTE = "/orbix/chat/stream" as const;
export const DELETION_IN_THIS_SHIP = false;
export const GAP_P1_001_CLOSED = false;
export const GAP_P3_001_CLOSED = false;
export const PRODUCTION_APPROVED = false;

export const QUARANTINED_FALCON_ORPHAN_UI = [
  "src/components/falcon/FalconPanel.tsx",
  "src/components/falcon/FalconLauncher.tsx",
  "src/components/falcon/FalconThinkingPanel.tsx",
] as const;

export const RETAINED_FALCON_SURFACES = [
  "src/components/falcon/FalconProvider.tsx",
  "src/lib/falcon/",
  "src/store/falconStore.ts",
] as const;

export function deadParallelAiQuarantineSnapshot() {
  return {
    authority: DEAD_PARALLEL_AI_QUARANTINE_ADR,
    step: DEAD_PARALLEL_AI_QUARANTINE_STEP,
    decision: DEAD_PARALLEL_AI_QUARANTINE_DECISION,
    primaryChatRoute: PRIMARY_CHAT_ROUTE,
    deletionInThisShip: DELETION_IN_THIS_SHIP,
    gapP1001Closed: GAP_P1_001_CLOSED,
    gapP3001Closed: GAP_P3_001_CLOSED,
    productionApproved: PRODUCTION_APPROVED,
    falconOrphanUi: [...QUARANTINED_FALCON_ORPHAN_UI],
    retainedFalconSurfaces: [...RETAINED_FALCON_SURFACES],
  };
}
