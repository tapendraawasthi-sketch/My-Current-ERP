/**
 * PR-H4 / ADR_0095 — forbid vacuous greens / assertion weakening (docs + honesty).
 * Runtime scoring enforcement lives in Python r3h2 contracts; this is the TS mirror.
 */

export const VACUOUS_GREEN_FORBID_ADR = "ADR_0095" as const;
export const VACUOUS_GREEN_FORBID_STEP = "PR-H4" as const;
export const VACUOUS_GREEN_FORBID_DECISION = "VACUOUS_GREEN_FORBID" as const;
export const EXTENDS = "ADR_0089" as const;

export const VACUOUS_GREENS_ALLOWED = false;
export const ASSERTION_WEAKENING_ALLOWED = false;
export const LEGACY_SCORERS_ALL_REWRITTEN = false;
export const PRODUCTION_APPROVED = false;

export const GOVERNED_CONTRACT_MODULES = [
  "erp_bot/src/oip/modules/language_runtime/transliteration/application/r3h2_scoring_contracts.py",
  "erp_bot/src/oip/modules/language_runtime/transliteration/application/r3n_scoring_contracts.py",
  "erp_bot/src/oip/modules/language_runtime/transliteration/application/r3n2_scoring_contracts.py",
  "erp_bot/src/oip/modules/language_runtime/transliteration/application/r3n3_scoring_contracts.py",
  "erp_bot/src/oip/modules/language_runtime/transliteration/application/r3n4_scoring_contracts.py",
] as const;

export function vacuousGreenForbidSnapshot() {
  return {
    authority: VACUOUS_GREEN_FORBID_ADR,
    step: VACUOUS_GREEN_FORBID_STEP,
    decision: VACUOUS_GREEN_FORBID_DECISION,
    extends: EXTENDS,
    vacuousGreensAllowed: VACUOUS_GREENS_ALLOWED,
    assertionWeakeningAllowed: ASSERTION_WEAKENING_ALLOWED,
    legacyScorersAllRewritten: LEGACY_SCORERS_ALL_REWRITTEN,
    productionApproved: PRODUCTION_APPROVED,
    governedContractModules: [...GOVERNED_CONTRACT_MODULES],
  };
}
