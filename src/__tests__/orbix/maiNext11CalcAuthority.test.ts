import { describe, expect, it } from "vitest";
import {
  AI_JOURNAL_MATH_ALLOWED,
  CALC_AUTHORITY_ADR,
  CALC_AUTHORITY_ON_CONFIRM,
  EDIT_LOOP_INVENTS_PARTY_OR_AMOUNT,
  GAP_P2_002_REGISTER_STATUS,
  INVOICE_FORM_TOTALS_DISCLAIMER,
  ORBIX_CONFIRM_PREVIEW_HEADING,
  ORBIX_CONFIRM_PREVIEW_HINT,
  UI_CALCULATES_AUTHORITATIVE_TOTALS,
  calcAuthorityHonestySnapshot,
  editLoopMayInventPartyOrAmount,
} from "@/platform/calc/calcAuthorityPolicy";

describe("NEXT-11 calc authority honesty", () => {
  it("declares Dexie confirm ownership and REDUCED gap", () => {
    const snap = calcAuthorityHonestySnapshot();
    expect(snap.authority).toBe(CALC_AUTHORITY_ADR);
    expect(snap.authority).toBe("ADR_0078");
    expect(snap.calcAuthorityOnConfirm).toBe(CALC_AUTHORITY_ON_CONFIRM);
    expect(snap.calcAuthorityOnConfirm).toBe("DEXIE_DOMAIN_ENGINE");
    expect(snap.uiCalculatesAuthoritativeTotals).toBe(false);
    expect(UI_CALCULATES_AUTHORITATIVE_TOTALS).toBe(false);
    expect(snap.aiJournalMathAllowed).toBe(false);
    expect(AI_JOURNAL_MATH_ALLOWED).toBe(false);
    expect(snap.editLoopInventsPartyOrAmount).toBe(false);
    expect(EDIT_LOOP_INVENTS_PARTY_OR_AMOUNT).toBe(false);
    expect(snap.gapP2002RegisterStatus).toBe("REDUCED");
    expect(GAP_P2_002_REGISTER_STATUS).toBe("REDUCED");
    expect(snap.gapP2002Closed).toBe(false);
    expect(snap.productionApproved).toBe(false);
  });

  it("never invents party or amount in edit loop", () => {
    expect(editLoopMayInventPartyOrAmount()).toBe(false);
  });

  it("exposes non-authoritative UI label constants", () => {
    expect(ORBIX_CONFIRM_PREVIEW_HEADING).toBe("Confirm preview");
    expect(ORBIX_CONFIRM_PREVIEW_HINT.toLowerCase()).toContain("domain engine");
    expect(INVOICE_FORM_TOTALS_DISCLAIMER.toLowerCase()).toContain("display estimate");
    expect(INVOICE_FORM_TOTALS_DISCLAIMER.toLowerCase()).toContain("domain engine");
  });
});
