/** PR-B2 / ADR_0085 — launch mutation residual honesty (TS mirror). */

export const LAUNCH_MUTATION_ADR = "ADR_0085" as const;
export const LAUNCH_MUTATION_STEP = "PR-B2" as const;
export const LAUNCH_MUTATION_DECISION =
  "LAUNCH_MUTATION_RESIDUAL_HARD_DENY" as const;
export const PRODUCT_MUTATION_PATH = "DEXIE_EXECUTE_ORBIX_CONFIRM" as const;
export const OEC_IS_SOLE_MUTATION_AUTHORITY = false;
export const DUAL_SILENT_WRITER_ON_LAUNCH_PATH = false;
export const GAP_P0_001_REGISTER_STATUS = "REDUCED" as const;
export const GAP_P0_001_CLOSED = false;
export const PRODUCTION_APPROVED = false;

export function launchMutationResidualHonestySnapshot() {
  return {
    authority: LAUNCH_MUTATION_ADR,
    step: LAUNCH_MUTATION_STEP,
    decision: LAUNCH_MUTATION_DECISION,
    productMutationPath: PRODUCT_MUTATION_PATH,
    oecIsSoleMutationAuthority: OEC_IS_SOLE_MUTATION_AUTHORITY,
    dualSilentWriterOnLaunchPath: DUAL_SILENT_WRITER_ON_LAUNCH_PATH,
    gapP0001RegisterStatus: GAP_P0_001_REGISTER_STATUS,
    gapP0001Closed: GAP_P0_001_CLOSED,
    productionApproved: PRODUCTION_APPROVED,
  };
}
