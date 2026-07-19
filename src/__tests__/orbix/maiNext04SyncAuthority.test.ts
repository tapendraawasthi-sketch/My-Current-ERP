import { describe, expect, it } from "vitest";
import { isAccountingEntitySyncBlocked } from "@/store/syncEnqueueRouter";
import {
  ACCOUNTING_SYNC_AUTHORITY,
  CONFLICT_AUTO_OVERWRITE,
  CONFLICT_POLICY,
  GAP_P1_002_REGISTER_STATUS,
  GAP_P1_002_RUNTIME_STATUS,
  QUEUED_MUST_NOT_LABEL_SYNCED,
  SYNC_AUTHORITY_ADR,
  syncAuthorityHonestySnapshot,
} from "@/platform/sync/syncAuthorityPolicy";

describe("NEXT-04 sync authority policy", () => {
  it("declares event-sync authority and conflict honesty", () => {
    const snap = syncAuthorityHonestySnapshot();
    expect(snap.authority).toBe(SYNC_AUTHORITY_ADR);
    expect(snap.accountingSyncAuthority).toBe(ACCOUNTING_SYNC_AUTHORITY);
    expect(snap.conflictPolicy).toBe(CONFLICT_POLICY);
    expect(snap.queuedMustNotLabelSynced).toBe(QUEUED_MUST_NOT_LABEL_SYNCED);
    expect(snap.conflictAutoOverwrite).toBe(CONFLICT_AUTO_OVERWRITE);
    expect(snap.gapP1002RuntimeStatus).toBe(GAP_P1_002_RUNTIME_STATUS);
    expect(snap.gapP1002RegisterStatus).toBe(GAP_P1_002_REGISTER_STATUS);
    expect(CONFLICT_AUTO_OVERWRITE).toBe(false);
    expect(QUEUED_MUST_NOT_LABEL_SYNCED).toBe(true);
  });

  it("keeps accounting entities blocked from legacy outbox", () => {
    expect(isAccountingEntitySyncBlocked("invoice")).toBe(true);
    expect(isAccountingEntitySyncBlocked("voucher")).toBe(true);
    expect(isAccountingEntitySyncBlocked("orbixPostingReceipt")).toBe(true);
    expect(isAccountingEntitySyncBlocked("party")).toBe(false);
  });
});
