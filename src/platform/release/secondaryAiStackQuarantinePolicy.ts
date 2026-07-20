/**
 * PR-H3 / ADR_0094 — secondary AI stack quarantine (extends ADR_0073).
 */

export const SECONDARY_AI_STACK_QUARANTINE_ADR = "ADR_0094" as const;
export const SECONDARY_AI_STACK_QUARANTINE_STEP = "PR-H3" as const;
export const SECONDARY_AI_STACK_QUARANTINE_DECISION =
  "SECONDARY_AI_STACK_QUARANTINE" as const;
export const DISPOSITION = "QUARANTINED_NON_PROD_ONLY" as const;
export const PRIMARY_CHAT_ROUTE = "/orbix/chat/stream" as const;
export const DELETION_IN_THIS_SHIP = false;
export const GAP_P1_001_CLOSED = false;
export const PRODUCTION_APPROVED = false;

export function secondaryAiStackQuarantineSnapshot() {
  return {
    authority: SECONDARY_AI_STACK_QUARANTINE_ADR,
    step: SECONDARY_AI_STACK_QUARANTINE_STEP,
    decision: SECONDARY_AI_STACK_QUARANTINE_DECISION,
    disposition: DISPOSITION,
    primaryChatRoute: PRIMARY_CHAT_ROUTE,
    deletionInThisShip: DELETION_IN_THIS_SHIP,
    gapP1001Closed: GAP_P1_001_CLOSED,
    productionApproved: PRODUCTION_APPROVED,
  };
}
