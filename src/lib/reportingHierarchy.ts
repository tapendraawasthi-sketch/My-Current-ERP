import { VoucherStatus } from "./types";

export interface AccountNode {
  id: string;
  name: string;
  type: string;
  level: string;
  parentId?: string;
  isGroup: boolean;
  isActive: boolean;
  children: AccountNode[];
}

export interface LedgerTotals {
  account: any;
  openingDr: number;
  openingCr: number;
  periodDr: number;
  periodCr: number;
  closingDr: number;
  closingCr: number;
  net: number;
  hasActivity: boolean;
}

export interface GroupTotals {
  closingDr: number;
  closingCr: number;
  net: number;
  hasActivity: boolean;
}

export const buildAccountTree = (accounts: any[]) => {
  const nodesById = new Map<string, AccountNode>();
  accounts.forEach((acc) => {
    nodesById.set(acc.id, { ...acc, children: [] });
  });

  nodesById.forEach((node) => {
    if (node.parentId && nodesById.has(node.parentId)) {
      nodesById.get(node.parentId)!.children.push(node);
    }
  });

  const roots = Array.from(nodesById.values()).filter(
    (node) => node.isGroup && !node.parentId
  );

  return { roots, nodesById };
};

export const computeLedgerTotals = (
  accounts: any[],
  vouchers: any[],
  options: { startDate?: string; endDate?: string; includeOpening?: boolean } = {}
) => {
  const { startDate, endDate, includeOpening = true } = options;
  const totals = new Map<string, LedgerTotals>();

  accounts.forEach((acc) => {
    if (acc.isGroup) return;
    totals.set(acc.id, {
      account: acc,
      openingDr: includeOpening ? acc.openingBalanceDr || 0 : 0,
      openingCr: includeOpening ? acc.openingBalanceCr || 0 : 0,
      periodDr: 0,
      periodCr: 0,
      closingDr: 0,
      closingCr: 0,
      net: 0,
      hasActivity: false,
    });
  });

  const posted = vouchers.filter(
    (v) =>
      v.status === VoucherStatus.POSTED &&
      (!startDate || v.date >= startDate) &&
      (!endDate || v.date <= endDate)
  );

  for (const v of posted) {
    for (const line of v.lines || []) {
      const entry = totals.get(line.accountId);
      if (!entry) continue;
      entry.periodDr += Number(line.debit) || 0;
      entry.periodCr += Number(line.credit) || 0;
    }
  }

  totals.forEach((entry) => {
    const totalDr = entry.openingDr + entry.periodDr;
    const totalCr = entry.openingCr + entry.periodCr;

    if (totalDr >= totalCr) {
      entry.closingDr = totalDr - totalCr;
      entry.closingCr = 0;
      entry.net = totalDr - totalCr;
    } else {
      entry.closingCr = totalCr - totalDr;
      entry.closingDr = 0;
      entry.net = -(totalCr - totalDr);
    }

    entry.hasActivity =
      Math.abs(entry.openingDr) > 0.005 ||
      Math.abs(entry.openingCr) > 0.005 ||
      Math.abs(entry.periodDr) > 0.005 ||
      Math.abs(entry.periodCr) > 0.005;
  });

  return totals;
};

export const computeGroupTotals = (
  tree: ReturnType<typeof buildAccountTree>,
  ledgerTotals: Map<string, LedgerTotals>
) => {
  const totals = new Map<string, GroupTotals>();

  const walk = (node: AccountNode): GroupTotals => {
    if (!node.isGroup) {
      const leaf = ledgerTotals.get(node.id);
      return {
        closingDr: leaf?.closingDr || 0,
        closingCr: leaf?.closingCr || 0,
        net: leaf?.net || 0,
        hasActivity: leaf?.hasActivity || false,
      };
    }

    let totalDr = 0;
    let totalCr = 0;
    let hasActivity = false;

    node.children.forEach((child) => {
      const childTotals = walk(child);
      totalDr += childTotals.closingDr;
      totalCr += childTotals.closingCr;
      hasActivity = hasActivity || childTotals.hasActivity;
    });

    const net = totalDr - totalCr;
    const entry = {
      closingDr: net >= 0 ? Math.abs(net) : 0,
      closingCr: net < 0 ? Math.abs(net) : 0,
      net,
      hasActivity,
    };
    totals.set(node.id, entry);
    return entry;
  };

  tree.roots.forEach(walk);
  return totals;
};

export const getLedgerEntries = (
  ledgerId: string,
  vouchers: any[],
  options: { startDate?: string; endDate?: string } = {}
) => {
  const { startDate, endDate } = options;
  return vouchers
    .filter(
      (v) =>
        v.status === VoucherStatus.POSTED &&
        (!startDate || v.date >= startDate) &&
        (!endDate || v.date <= endDate)
    )
    .flatMap((v) =>
      (v.lines || [])
        .filter((line: any) => line.accountId === ledgerId)
        .map((line: any) => ({
          date: v.date,
          voucherNo: v.voucherNo,
          narration: line.narration || v.narration || "",
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          voucherId: v.id,
          voucherType: v.type,
        }))
    )
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const groupEntriesByMonth = (entries: any[]) => {
  const map = new Map<
    string,
    { monthKey: string; debit: number; credit: number; entries: any[] }
  >();

  entries.forEach((entry) => {
    const monthKey = entry.date.slice(0, 7);
    const bucket =
      map.get(monthKey) || { monthKey, debit: 0, credit: 0, entries: [] };
    bucket.debit += entry.debit;
    bucket.credit += entry.credit;
    bucket.entries.push(entry);
    map.set(monthKey, bucket);
  });

  return Array.from(map.values()).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  );
};
