import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useStore } from "../store/useStore";
import { type DrillRow, useDrillDownNav } from "../hooks/useDrillDownNav";
import LedgerStatementView from "../components/accounts/LedgerStatementView";

interface Account {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  isGroup?: boolean;
  balance?: number;
  isActive?: boolean;
}

function getPrimaryGroups(accounts: Account[]): Account[] {
  const roots = accounts.filter((a) => a.isGroup && !a.parentId);
  const rootIds = new Set(roots.map((r) => r.id));
  let primary = accounts.filter((a) => a.isGroup && a.parentId && rootIds.has(a.parentId));
  if (primary.length === 0) primary = roots;
  return primary.sort((a, b) => a.name.localeCompare(b.name));
}

function getGroupBalance(groupId: string, accounts: Account[]): number {
  const directLedgers = accounts.filter((a) => !a.isGroup && a.parentId === groupId);
  const directBalance = directLedgers.reduce((s, l) => s + Number(l.balance || 0), 0);
  const childGroups = accounts.filter((a) => a.isGroup && a.parentId === groupId);
  const childBalance = childGroups.reduce((s, g) => s + getGroupBalance(g.id, accounts), 0);
  return directBalance + childBalance;
}

function buildVisibleRows(accounts: Account[], expandedIds: Set<string>): DrillRow[] {
  const rows: DrillRow[] = [];

  const appendLedger = (ledger: Account, parentId: string) => {
    rows.push({
      id: ledger.id,
      depth: 2,
      isLeaf: true,
      parentId,
      label: ledger.name,
    });
  };

  const appendSubGroup = (sg: Account, parentId: string) => {
    const ledgers = accounts
      .filter((a) => !a.isGroup && a.parentId === sg.id && a.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
    const isExpanded = expandedIds.has(sg.id);

    rows.push({
      id: sg.id,
      depth: 1,
      isLeaf: false,
      isExpanded: ledgers.length > 0 ? isExpanded : undefined,
      parentId,
      label: sg.name,
    });

    if (isExpanded) {
      ledgers.forEach((l) => appendLedger(l, sg.id));
    }
  };

  const appendPrimaryGroup = (group: Account) => {
    const subGroups = accounts
      .filter((a) => a.isGroup && a.parentId === group.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    const directLedgers = accounts
      .filter((a) => !a.isGroup && a.parentId === group.id && a.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
    const hasChildren = subGroups.length > 0 || directLedgers.length > 0;
    const isExpanded = expandedIds.has(group.id);

    rows.push({
      id: group.id,
      depth: 0,
      isLeaf: false,
      isExpanded: hasChildren ? isExpanded : undefined,
      parentId: null,
      label: group.name,
    });

    if (isExpanded) {
      subGroups.forEach((sg) => appendSubGroup(sg, group.id));
      directLedgers.forEach((l) => appendLedger(l, group.id));
    }
  };

  getPrimaryGroups(accounts).forEach(appendPrimaryGroup);
  return rows;
}

function formatBalance(value: number): string {
  return Math.abs(Number(value || 0)).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface TreeSnapshot {
  expandedIds: Set<string>;
  focusedId: string | null;
  scrollTop: number;
}

const GeneralLedger: React.FC = () => {
  const { accounts } = useStore() as { accounts: Account[] };

  const accountList = useMemo(
    () => (accounts || []).filter((a) => a.isActive !== false),
    [accounts],
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const [treeSnapshot, setTreeSnapshot] = useState<TreeSnapshot | null>(null);

  const treeRef = useRef<HTMLDivElement>(null);

  const visibleRows = useMemo(
    () => buildVisibleRows(accountList, expandedIds),
    [accountList, expandedIds],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openLeaf = useCallback(
    (id: string) => {
      setTreeSnapshot({
        expandedIds: new Set(expandedIds),
        focusedId: id,
        scrollTop: treeRef.current?.scrollTop ?? 0,
      });
      setSelectedLedgerId(id);
    },
    [expandedIds],
  );

  const { focusedId, setFocusedId, handleKeyDown } = useDrillDownNav({
    visibleRows,
    onToggleExpand: toggleExpand,
    onOpenLeaf: openLeaf,
  });

  const handleBack = useCallback(() => {
    if (treeSnapshot) {
      setExpandedIds(new Set(treeSnapshot.expandedIds));
      setFocusedId(treeSnapshot.focusedId);
    }
    setSelectedLedgerId(null);
  }, [treeSnapshot, setFocusedId]);

  useEffect(() => {
    if (!selectedLedgerId && treeSnapshot && treeRef.current) {
      treeRef.current.scrollTop = treeSnapshot.scrollTop;
    }
  }, [selectedLedgerId, treeSnapshot]);

  useEffect(() => {
    if (!selectedLedgerId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedLedgerId, handleBack]);

  if (selectedLedgerId) {
    return <LedgerStatementView ledgerId={selectedLedgerId} onBack={handleBack} />;
  }

  return (
    <div className="p-4 bg-[var(--ds-surface-muted)] min-h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Account activity</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">
            History of one account — pick a ledger to open the statement.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md flex flex-col flex-1 min-h-0">
        <div
          ref={treeRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="overflow-y-auto flex-1 outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
        >
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Account</th>
                <th className="th-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const account = accountList.find((a) => a.id === row.id);
                const balance = row.isLeaf
                  ? Number(account?.balance || 0)
                  : getGroupBalance(row.id, accountList);
                const isFocused = focusedId === row.id;
                const hasChevron = !row.isLeaf && row.isExpanded !== undefined;

                return (
                  <tr
                    key={row.id}
                    onClick={() => setFocusedId(row.id)}
                    onMouseEnter={() => setFocusedId(row.id)}
                    onDoubleClick={() => {
                      if (row.isLeaf) openLeaf(row.id);
                      else toggleExpand(row.id);
                    }}
                    className="cursor-pointer"
                    style={{
                      height: 36,
                      borderLeft: isFocused ? "3px solid var(--color-accent)" : "3px solid transparent",
                      background: isFocused ? "rgba(21,87,176,0.06)" : undefined,
                    }}
                  >
                    <td
                      className="text-[12px] text-gray-800"
                      style={{ paddingLeft: `${12 + row.depth * 20}px` }}
                    >
                      <div className="flex items-center gap-1.5">
                        {hasChevron ? (
                          row.isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          )
                        ) : (
                          <span className="w-3.5 shrink-0" />
                        )}
                        <span className={row.isLeaf ? "font-medium" : "font-semibold"}>
                          {row.label}
                        </span>
                      </div>
                    </td>
                    <td
                      className={
                        row.isLeaf
                          ? balance >= 0
                            ? "number-cell-dr"
                            : "number-cell-cr"
                          : "number-cell-bold"
                      }
                    >
                      {formatBalance(balance)}
                    </td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center py-8">
                    <div className="empty-state">
                      <p className="empty-state-title">No accounts found</p>
                      <p className="empty-state-sub">Add accounts in Chart of Accounts first.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 px-4 py-2 text-[12px] text-gray-500">
          ↑↓ Navigate · → Expand · ← Collapse · Enter Open · Type to search
        </div>
      </div>
    </div>
  );
};

export default GeneralLedger;
