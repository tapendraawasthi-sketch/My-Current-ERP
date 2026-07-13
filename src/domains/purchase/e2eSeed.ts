/**
 * Disposable Orbix E2E company seed / reset — development only.
 * Prefixed identifiers; never target production companies.
 */

import { getDB, generateId } from "@/lib/db";
import {
  E2E_COMPANY_ID,
  E2E_COMPANY_NAME,
  E2E_ITEM_ID,
  E2E_ITEM_NAME,
} from "./postPurchaseTransaction";

// E2E_ITEM_NAME used in reset filters

export const E2E_USER_AUTHORIZED = "user-e2e-accountant";
export const E2E_USER_RESTRICTED = "user-e2e-viewer";
export const E2E_FY_ID = "fy-e2e-orbix";

const E2E_PREFIXES = {
  invoice: "E2E-",
  item: E2E_ITEM_ID,
  company: E2E_COMPANY_ID,
};

/** Remove prior E2E purchase artifacts and restore known masters. */
export async function resetOrbixE2ECompany(): Promise<void> {
  const db = getDB();

  const invoices = await db.invoices.toArray();
  const e2eInvoiceIds = new Set<string>();
  for (const inv of invoices) {
    const isE2E =
      inv.invoiceNo?.startsWith(E2E_PREFIXES.invoice) ||
      inv.narration?.includes("E2E") ||
      inv.narration?.toLowerCase().includes("bike") ||
      inv.createdBy === E2E_USER_AUTHORIZED ||
      (inv.lines || []).some(
        (l: { itemId?: string; itemName?: string }) =>
          l.itemId === E2E_ITEM_ID || l.itemName === E2E_ITEM_NAME,
      );
    if (!isE2E) continue;
    e2eInvoiceIds.add(inv.id);
    await db.stockMovements.where("referenceId").equals(inv.id).delete();
    // Journal may be jnl-{invoiceId} or linked via accountingVoucherId
    const jnlId = (inv as { accountingVoucherId?: string }).accountingVoucherId || `jnl-${inv.id}`;
    await db.vouchers.delete(jnlId);
    await db.invoices.delete(inv.id);
  }

  // Orphan bike stock / AUTO vouchers for bike
  const movements = await db.stockMovements.toArray();
  for (const m of movements) {
    if (m.itemId === E2E_ITEM_ID || m.itemName === E2E_ITEM_NAME) {
      await db.stockMovements.delete(m.id);
    }
  }

  const receipts = (await db.orbixPostingReceipts?.toArray?.().catch(() => [])) ?? [];
  for (const r of receipts) {
    if (
      r.companyId === E2E_COMPANY_ID ||
      r.companyId === "main" ||
      r.userId === E2E_USER_AUTHORIZED ||
      String(r.draftId || "").includes("e2e") ||
      (r.invoiceId && e2eInvoiceIds.has(r.invoiceId))
    ) {
      await db.orbixPostingReceipts.delete(r.id);
    }
  }

  const audits = await db.auditLogs.toArray();
  for (const a of audits) {
    const after = (a as { after?: Record<string, unknown> }).after || {};
    const entityId = String((a as { entityId?: string; recordId?: string }).entityId || (a as { recordId?: string }).recordId || "");
    if (
      (a as { userId?: string }).userId === E2E_USER_AUTHORIZED ||
      e2eInvoiceIds.has(entityId) ||
      String(after.itemId || "") === E2E_ITEM_ID ||
      String((a as { action?: string }).action || "").includes("purchase")
    ) {
      // Only delete clearly E2E-scoped audits
      if (
        (a as { userId?: string }).userId === E2E_USER_AUTHORIZED ||
        e2eInvoiceIds.has(entityId) ||
        String(after.itemId || "") === E2E_ITEM_ID
      ) {
        await db.auditLogs.delete((a as { id: string | number }).id);
      }
    }
  }

  const outbox = await db.syncOutbox.toArray();
  for (const ev of outbox) {
    if (
      e2eInvoiceIds.has(ev.entityId) ||
      String((ev.payload as { itemId?: string } | undefined)?.itemId || "") === E2E_ITEM_ID ||
      (ev.entityType === "invoice" && String(ev.payload?.narration || "").toLowerCase().includes("bike"))
    ) {
      await db.syncOutbox.delete(ev.id);
    }
  }

  // Phase 5: clear E2E-scoped event sync queue / conflicts / dead letters
  if (db.eventSyncQueue) {
    const queue = await db.eventSyncQueue.toArray();
    for (const row of queue) {
      const companyOk =
        row.companyId === E2E_COMPANY_ID ||
        String(row.idempotencyKey || "").includes("e2e") ||
        String(row.eventId || "").includes("e2e");
      if (companyOk || row.origin === "remote_sync") {
        await db.eventSyncQueue.delete(row.id);
      }
    }
  }
  if (db.eventSyncConflicts) {
    const conflicts = await db.eventSyncConflicts.toArray();
    for (const c of conflicts) {
      await db.eventSyncConflicts.delete(c.id);
    }
  }
  if (db.eventSyncDeadLetter) {
    const letters = await db.eventSyncDeadLetter.toArray();
    for (const d of letters) {
      await db.eventSyncDeadLetter.delete(d.id);
    }
  }
  if (db.domainEvents) {
    const events = await db.domainEvents.toArray();
    for (const e of events) {
      if (
        e.companyId === E2E_COMPANY_ID ||
        e.eventType === "purchase_posted" ||
        String(e.commandId || "").includes("e2e")
      ) {
        await db.domainEvents.delete(e.id);
      }
    }
  }
  if (db.syncLocalSequences) {
    const seqs = await db.syncLocalSequences.toArray();
    for (const s of seqs) {
      if (s.companyId === E2E_COMPANY_ID || String(s.id || "").includes(E2E_COMPANY_ID)) {
        await db.syncLocalSequences.delete(s.id);
      }
    }
  }

  // Restore known opening balances for seeded accounts
  for (const id of ["acc-cash", "acc-bank", "acc-purchase", "acc-sundry-creditors"]) {
    await db.accounts.update(id, { balance: 0 });
  }

  await seedOrbixE2ECompany();
}

/** Seed company settings, FY, users, cash/purchase accounts (if missing), inventory bike. */
export async function seedOrbixE2ECompany(): Promise<{
  companyId: string;
  itemId: string;
  authorizedUserId: string;
  restrictedUserId: string;
}> {
  const db = getDB();
  const now = new Date().toISOString();

  await db.companySettings.put({
    id: "main",
    companyId: E2E_COMPANY_ID,
    name: E2E_COMPANY_NAME,
    companyName: E2E_COMPANY_NAME,
    syncPolicy: "sync_enabled",
    updatedAt: now,
  } as any);

  const fyExisting = await db.fiscalYears.get(E2E_FY_ID);
  if (!fyExisting) {
    await db.fiscalYears.add({
      id: E2E_FY_ID,
      name: "E2E FY 2082/83",
      startDate: "2025-07-16",
      endDate: "2026-07-15",
      status: "open",
      isDefault: true,
      isCurrent: true,
      createdAt: now,
    } as any);
  }

  const ensureUser = async (
    id: string,
    username: string,
    role: string,
    permissions: string[],
  ) => {
    const existing = await db.users.get(id);
    if (existing) {
      await db.users.update(id, { role, permissions, isActive: true, name: username });
      return;
    }
    await db.users.add({
      id,
      username,
      name: username,
      role,
      permissions,
      isActive: true,
      createdAt: now,
    } as any);
  };

  await ensureUser(E2E_USER_AUTHORIZED, "e2e.accountant", "accountant", [
    "purchase.post",
    "purchase.draft",
    "purchase.preview",
    "report.view",
    "journal.view",
    "inventory.view",
    "inventory.post",
  ]);
  await ensureUser(E2E_USER_RESTRICTED, "e2e.viewer", "viewer", ["report.view", "journal.view"]);

  // Ensure chart accounts used by purchase journal exist
  for (const acc of [
    { id: "acc-cash", code: "1401", name: "Cash", type: "asset", balance: 0 },
    { id: "acc-bank", code: "1402", name: "Bank", type: "asset", balance: 0 },
    { id: "acc-purchase", code: "5101", name: "Purchases", type: "expense", balance: 0 },
    {
      id: "acc-sundry-creditors",
      code: "2101",
      name: "Sundry Creditors",
      type: "liability",
      balance: 0,
    },
  ]) {
    const found = await db.accounts.get(acc.id);
    if (!found) {
      await db.accounts.add({
        ...acc,
        level: 1,
        isGroup: false,
        isActive: true,
        createdAt: now,
      } as any);
    }
  }

  const bike = await db.items.get(E2E_ITEM_ID);
  if (!bike) {
    await db.items.add({
      id: E2E_ITEM_ID,
      code: "E2E-BIKE",
      name: E2E_ITEM_NAME,
      unit: "pcs",
      type: "goods",
      isActive: true,
      costPrice: 50000,
      salesPrice: 60000,
      openingQty: 0,
      createdAt: now,
    } as any);
  } else {
    await db.items.update(E2E_ITEM_ID, {
      name: E2E_ITEM_NAME,
      unit: "pcs",
      type: "goods",
      isActive: true,
    });
  }

  return {
    companyId: E2E_COMPANY_ID,
    itemId: E2E_ITEM_ID,
    authorizedUserId: E2E_USER_AUTHORIZED,
    restrictedUserId: E2E_USER_RESTRICTED,
  };
}

export function isE2ECompanyName(name: string | undefined | null): boolean {
  return (name || "").trim() === E2E_COMPANY_NAME;
}

/** Test helper — unused in production UI */
export function e2eMarker(): string {
  return `e2e-${generateId().slice(0, 8)}`;
}
