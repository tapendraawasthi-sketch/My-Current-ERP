import { beforeEach, describe, expect, it, vi } from "vitest";
import * as dbModule from "@/lib/db";
import { PeriodLockedError, isPeriodLockedError } from "@/lib/ledger/postingPeriodGuard";
import { useStore } from "@/store/useStore";
import { usePermissionsStore } from "@/store/permissionsStore";
import { createWorkflowActions } from "@/store/workflowActions";
import { applySyncPullFinancialRecords } from "@/lib/syncEngine";
import { confirmKhataEntry } from "@/lib/ekhata/confirmKhata";
import {
  balancedVoucherLines,
  lockPeriod,
  minimalInvoice,
  resetAccountingTestDb,
  seedMinimalAccounting,
} from "./testHarness";

describe("posting path integration — period lock enforcement", () => {
  let db: Awaited<ReturnType<typeof resetAccountingTestDb>>;
  const lockedDate = "2026-06-15";
  const openDate = "2026-08-15";

  beforeEach(async () => {
    db = await resetAccountingTestDb();
    await seedMinimalAccounting(db);
    await lockPeriod(db, "2026-6", lockedDate);
  });

  it("addVoucher throws PeriodLockedError in locked period", async () => {
    const { addVoucher } = useStore.getState();
    await expect(
      addVoucher({
        type: "journal",
        status: "posted",
        date: lockedDate,
        lines: balancedVoucherLines(),
        narration: "test",
      }),
    ).rejects.toSatisfy((err: unknown) => isPeriodLockedError(err));
  });

  it("updateVoucher throws PeriodLockedError when posting into locked period", async () => {
    const { addVoucher, updateVoucher } = useStore.getState();
    const draft = await addVoucher({
      type: "journal",
      status: "draft",
      date: openDate,
      lines: balancedVoucherLines(),
      narration: "draft",
    });

    await expect(updateVoucher(draft.id, { status: "posted", date: lockedDate })).rejects.toSatisfy(
      (err: unknown) => err instanceof PeriodLockedError,
    );
  });

  it("addInvoice / postInvoice throws PeriodLockedError in locked period", async () => {
    const { addInvoice } = useStore.getState();
    await expect(addInvoice(minimalInvoice(lockedDate, "posted"))).rejects.toSatisfy(
      (err: unknown) => isPeriodLockedError(err),
    );
  });

  it("updateInvoice throws PeriodLockedError when posting into locked period", async () => {
    const { addInvoice, updateInvoice } = useStore.getState();
    const draft = await addInvoice(minimalInvoice(openDate, "draft"));
    await expect(
      updateInvoice(draft.id, { status: "posted", date: lockedDate }),
    ).rejects.toSatisfy((err: unknown) => isPeriodLockedError(err));
  });

  it("approveVoucher throws PeriodLockedError for locked voucher date", async () => {
    const voucherUpdate = vi.fn();
    vi.spyOn(dbModule, "getDB").mockReturnValue({
      pendingApprovals: {
        update: vi.fn(),
        get: vi.fn().mockResolvedValue({
          id: "apr-1",
          voucherId: "v-1",
          voucherNo: "JV-1",
          voucherDate: lockedDate,
        }),
      },
      vouchers: { update: voucherUpdate },
    } as never);

    await expect(
      usePermissionsStore.getState().approveVoucher("apr-1", "admin", "Admin"),
    ).rejects.toSatisfy((err: unknown) => isPeriodLockedError(err));
    expect(voucherUpdate).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("workflow GRN posting throws PeriodLockedError in locked period", async () => {
    const workflow = createWorkflowActions(useStore.setState, useStore.getState);
    await expect(
      workflow.createGrnAgainstPo({
        poIds: [],
        grn: { voucherNo: "GRN-1", date: lockedDate },
        lines: [{ id: "wl1", qty: 1, rate: 100, amount: 100 }],
      }),
    ).rejects.toSatisfy((err: unknown) => isPeriodLockedError(err));
  });

  it("sync replay throws PeriodLockedError for posted remote voucher", async () => {
    await expect(
      applySyncPullFinancialRecords(
        {
          vouchers: [
            {
              id: "sync-v1",
              voucher_no: "SV-1",
              voucher_date: lockedDate,
              voucher_type: "journal",
              status: "posted",
            },
          ],
        },
        db,
      ),
    ).rejects.toSatisfy((err: unknown) => isPeriodLockedError(err));
  });

  it("AI Khata confirm throws PeriodLockedError when addVoucher path is locked", async () => {
    const { addVoucher } = useStore.getState();
    await expect(
      confirmKhataEntry(
        {
          intent: "khata_cash_sale",
          date: lockedDate,
          raw_text: "cash sale 1000",
          amount: 1000,
        },
        { addVoucher },
      ),
    ).rejects.toSatisfy((err: unknown) => isPeriodLockedError(err));
  });

  it("cancelVoucher reversal throws PeriodLockedError when today is locked", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await lockPeriod(db, `${new Date().getFullYear()}-${new Date().getMonth() + 1}`, today);

    const { addVoucher, cancelVoucher } = useStore.getState();
    const voucher = await addVoucher({
      type: "journal",
      status: "posted",
      date: openDate,
      lines: balancedVoucherLines(),
      narration: "to cancel",
    });

    await expect(cancelVoucher(voucher.id, "test cancel")).rejects.toSatisfy(
      (err: unknown) => isPeriodLockedError(err),
    );
  });
});
