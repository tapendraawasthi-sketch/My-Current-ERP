import React, { useState } from "react";
import toast from "react-hot-toast";
import { useStore } from "../../store/useStore";
import { getDB } from "../../lib/db";

const RebuildBalancesAction: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { accounts, vouchers } = useStore();

  const handleRebuild = async () => {
    const confirmed = window.confirm(
      "This will recalculate all ledger balances from posted vouchers. Continue?",
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const db = getDB();

      // Build balance map from vouchers
      const balanceMap: Record<string, number> = {};
      for (const a of accounts) {
        balanceMap[a.id] = Number(a.openingBalance ?? 0);
      }
      for (const v of vouchers) {
        if (v.status !== "posted") continue;
        for (const l of v.lines ?? []) {
          if (!l.accountId) continue;
          if (!(l.accountId in balanceMap)) balanceMap[l.accountId] = 0;
          balanceMap[l.accountId] += Number(l.debit ?? 0) - Number(l.credit ?? 0);
        }
      }

      // Re-save each account with recomputed balance
      const accountsTable = (db as any).table("accounts");
      const dbAccounts: any[] = await accountsTable.toArray();
      for (const a of dbAccounts) {
        if (a.id in balanceMap) {
          await accountsTable.put({ ...a, balance: balanceMap[a.id] });
        }
      }

      toast.success("Master balances updated successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update master balances");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRebuild}
      disabled={loading}
      className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Updating..." : "Update Master Balances"}
    </button>
  );
};

export default RebuildBalancesAction;
