import { getDB } from "./db";
import type { WorkflowVoucher } from "./workflowUtils";
import { ensureWorkflowFields } from "./workflowUtils";

export async function migrateWorkflowFields(): Promise<void> {
  const db = getDB();

  const vouchers = await db.vouchers.toArray();

  const migrated = vouchers.map((voucher: any) => {
    const next = ensureWorkflowFields(voucher as WorkflowVoucher);

    const lines = next.lines || [];
    const totalDebit = lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);

    return {
      ...next,
      linkedPoIds: next.linkedPoIds || [],
      linkedGrnIds: next.linkedGrnIds || [],
      linkedSoIds: next.linkedSoIds || [],
      linkedDcIds: next.linkedDcIds || [],
      linkedDocuments: next.linkedDocuments || [],
      workflowStatus: next.workflowStatus || "open",
      totalDebit: (next as any).totalDebit ?? totalDebit,
      totalCredit: (next as any).totalCredit ?? totalCredit,
    };
  });

  await db.vouchers.bulkPut(migrated as any[]);
}
