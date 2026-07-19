import { describe, expect, it } from "vitest";
import { syncStatusPresentation } from "@/features/orbix";
import { isAccountingEntitySyncBlocked } from "@/store/syncEnqueueRouter";
import {
  DUAL_SYNC_CLOSED,
  GAP_P1_002_CLOSED,
  NON_SYNCED_POST_STATUSES,
  PRODUCTION_APPROVED,
  QUEUED_MUST_NOT_LABEL_SYNCED,
  STAGING_CONFLICT_ATTESTED,
  SYNC_HONESTY_ADR,
  syncHonestyResidualSnapshot,
} from "@/platform/sync/syncHonestyResidualPolicy";

describe("PR-B3 sync honesty residual", () => {
  it("declares queued≠synced and honest dual residual", () => {
    const snap = syncHonestyResidualSnapshot();
    expect(snap.authority).toBe(SYNC_HONESTY_ADR);
    expect(snap.authority).toBe("ADR_0086");
    expect(snap.queuedMustNotLabelSynced).toBe(true);
    expect(QUEUED_MUST_NOT_LABEL_SYNCED).toBe(true);
    expect(snap.dualSyncClosed).toBe(false);
    expect(DUAL_SYNC_CLOSED).toBe(false);
    expect(snap.gapP1002Closed).toBe(false);
    expect(GAP_P1_002_CLOSED).toBe(false);
    expect(snap.stagingConflictAttested).toBe(false);
    expect(STAGING_CONFLICT_ATTESTED).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
  });

  it("post-success pending/queued never presents as Synced", () => {
    for (const status of NON_SYNCED_POST_STATUSES) {
      const p = syncStatusPresentation(status);
      expect(p.testId).toBe("pending");
      expect(p.label.toLowerCase()).not.toContain("synced");
      expect(p.label.toLowerCase()).toContain("waiting");
    }
    expect(syncStatusPresentation("synced").testId).toBe("synced");
  });

  it("keeps accounting entities on event-sync (legacy outbox blocked)", () => {
    expect(isAccountingEntitySyncBlocked("invoice")).toBe(true);
    expect(isAccountingEntitySyncBlocked("voucher")).toBe(true);
    expect(isAccountingEntitySyncBlocked("stockMovement")).toBe(true);
    expect(isAccountingEntitySyncBlocked("orbixPostingReceipt")).toBe(true);
  });
});
