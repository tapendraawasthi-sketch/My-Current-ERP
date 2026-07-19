/**
 * NEXT-11 / ADR_0078 — calc authority constants (launch sales/purchase).
 * Does not post or recompute invoices.
 */

export const CALC_AUTHORITY_ADR = "ADR_0078" as const;
export const CALC_AUTHORITY_ON_CONFIRM = "DEXIE_DOMAIN_ENGINE" as const;
export const UI_CALCULATES_AUTHORITATIVE_TOTALS = false as const;
export const AI_JOURNAL_MATH_ALLOWED = false as const;
export const EDIT_LOOP_INVENTS_PARTY_OR_AMOUNT = false as const;
export const GAP_P2_002_REGISTER_STATUS = "REDUCED" as const;

/** Orbix confirm card heading — not post authority. */
export const ORBIX_CONFIRM_PREVIEW_HEADING = "Confirm preview" as const;
export const ORBIX_CONFIRM_PREVIEW_HINT =
  "Amounts post via the domain engine on confirm — card totals are for review." as const;

/** Manual invoice form totals disclaimer. */
export const INVOICE_FORM_TOTALS_DISCLAIMER =
  "Display estimate — ledger amounts use the domain engine when posted." as const;

export function calcAuthorityHonestySnapshot() {
  return {
    authority: CALC_AUTHORITY_ADR,
    calcAuthorityOnConfirm: CALC_AUTHORITY_ON_CONFIRM,
    uiCalculatesAuthoritativeTotals: UI_CALCULATES_AUTHORITATIVE_TOTALS,
    aiJournalMathAllowed: AI_JOURNAL_MATH_ALLOWED,
    editLoopInventsPartyOrAmount: EDIT_LOOP_INVENTS_PARTY_OR_AMOUNT,
    gapP2002RegisterStatus: GAP_P2_002_REGISTER_STATUS,
    gapP2002Closed: false,
    productionApproved: false,
  };
}

export function editLoopMayInventPartyOrAmount(): false {
  return false;
}
