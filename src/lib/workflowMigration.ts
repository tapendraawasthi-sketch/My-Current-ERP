import { getDB } from "./db";
import type { WorkflowVoucher } from "./workflowUtils";
import { ensureWorkflowFields } from "./workflowUtils";

export async function migrateWorkflowFields(): Promise<void> {
  const db = getDB();

  const vouchers = await db.vouchers.toArray();

  const migrated = vouchers.map((voucher: any) => {
    const next = ensureWorkflowFields(voucher as WorkflowVoucher);

    return {
      ...next,
      linkedPoIds: next.linkedPoIds || [],
      linkedGrnIds: next.linkedGrnIds || [],
      linkedSoIds: next.linkedSoIds || [],
      linkedDcIds: next.linkedDcIds || [],
      linkedDocuments: next.linkedDocuments || [],
      workflowStatus: next.workflowStatus || "open",
    };
  });

  await db.vouchers.bulkPut(migrated as any[]);
}
