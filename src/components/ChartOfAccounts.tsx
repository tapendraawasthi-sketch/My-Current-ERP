// src/components/ChartOfAccounts.tsx
// Removed @ts-nocheck
/**
 * BUSY-style Chart of Accounts â€” Complete Implementation
 * Phases 1-13: All 15 predefined groups, Account Group Master,
 * Account Master (all sections), Features/Options, Master Configuration,
 * Sub-Ledgers, Bill-by-Bill, all modes (Add/Modify/Delete/List/View)
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import toast from "@/lib/appToast";
import * as XLSX from "xlsx";
import { Plus, X } from "lucide-react";

import {
  PREDEFINED_GROUPS,
  CATEGORY_ORDER,
  LS_KEYS,
  DEFAULT_FEATURES,
  DEFAULT_MASTER_CONFIG,
  inputCls,
  labelCls,
  sectionHdr,
  loadFromLS,
  saveToLS,
  buildInitialGroups,
} from "./chart-of-accounts/constants";
import type { AccountGroup, Ledger, FeatureConfig, MasterConfig, DeleteTarget } from "./chart-of-accounts/types";
import { CoaToolbar } from "./chart-of-accounts/CoaToolbar";
import { CoaTreeView } from "./chart-of-accounts/CoaTreeView";
import { CoaDeleteDialog } from "./chart-of-accounts/CoaDeleteDialog";
import { CoaBottomPanel } from "./chart-of-accounts/CoaBottomPanel";
import { CoaGroupForm } from "./chart-of-accounts/CoaGroupForm";
import { CoaLedgerForm, type LedgerTabId } from "./chart-of-accounts/CoaLedgerForm";
import { CoaFeaturesPanel } from "./chart-of-accounts/CoaFeaturesPanel";

/** Thin controller — forms live in chart-of-accounts/Coa* panels (STEP 5.1). */
const ChartOfAccounts: React.FC = () => {

  // â”€â”€ State: Groups & Ledgers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [groups, setGroups] = useState<AccountGroup[]>(() => {
    const stored = loadFromLS<AccountGroup[]>(LS_KEYS.GROUPS, []);
    const initial = buildInitialGroups();
    // Merge: keep predefined, add user groups
    const userGroups = stored.filter((g) => !g.isSystem);
    return [...initial, ...userGroups];
  });

  const [ledgers, setLedgers] = useState<Ledger[]>(() => loadFromLS<Ledger[]>(LS_KEYS.LEDGERS, []));

  const [features, setFeatures] = useState<FeatureConfig>(() =>
    loadFromLS<FeatureConfig>(LS_KEYS.FEATURES, DEFAULT_FEATURES),
  );

  const [masterConfig, setMasterConfig] = useState<MasterConfig>(() =>
    loadFromLS<MasterConfig>(LS_KEYS.MASTER_CONFIG, DEFAULT_MASTER_CONFIG),
  );

  // â”€â”€ Persist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    saveToLS(
      LS_KEYS.GROUPS,
      groups.filter((g) => !g.isSystem),
    );
  }, [groups]);
  useEffect(() => {
    saveToLS(LS_KEYS.LEDGERS, ledgers);
  }, [ledgers]);
  useEffect(() => {
    saveToLS(LS_KEYS.FEATURES, features);
  }, [features]);
  useEffect(() => {
    saveToLS(LS_KEYS.MASTER_CONFIG, masterConfig);
  }, [masterConfig]);

  // â”€â”€ UI State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [activePanel, useState_activePanel] = useState<
    | "list"
    | "addGroup"
    | "editGroup"
    | "addLedger"
    | "editLedger"
    | "features"
    | "masterConfig"
    | "deleteConfirm"
  >("list");

  // NOTE: the code user gave used `const [activePanel, setActivePanel] = useState<...>("list");`
  const setActivePanel = useState_activePanel;

  const [searchTerm, setSearchTerm] = useState("");
  const [filterGroup, setFilterGroup] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(PREDEFINED_GROUPS.map((g) => g.id)),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [clipboardItem, setClipboardItem] = useState<any>(null);

  // â”€â”€ Group Form State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [gForm, setGForm] = useState<Partial<AccountGroup>>({});
  const [gErrors, setGErrors] = useState<Record<string, string>>({});
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // â”€â”€ Ledger Form State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const initLedger = (): Partial<Ledger> => ({
    accountType: "General Ledger",
    openingBalanceType: "Dr",
    gstApplicable: true,
    isActive: true,
    ledgerType: "General Ledger",
    country: "India",
  });
  const [lForm, setLForm] = useState<Partial<Ledger>>(initLedger());
  const [lErrors, setLErrors] = useState<Record<string, string>>({});
  const [editingLedgerId, setEditingLedgerId] = useState<string | null>(null);
  const [ledgerTab, setLedgerTab] = useState<LedgerTabId>("general");

  // â”€â”€ Build tree â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const allGroups = useMemo(() => groups, [groups]);
  const allLedgers = useMemo(() => ledgers, [ledgers]);

  // Hierarchy: category â†’ primary group â†’ sub-groups â†’ ledgers
  const tree = useMemo(() => {
    const groupMap = new Map<string, AccountGroup>();
    allGroups.forEach((g) => groupMap.set(g.id, g));

    function buildNode(g: AccountGroup, depth: number): any {
      const children = allGroups
        .filter((child) => !child.isPrimary && child.parentId === g.id)
        .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
      const ledgerItems = allLedgers
        .filter((l) => l.groupId === g.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      return {
        ...g,
        depth,
        children: children.map((c) => buildNode(c, depth + 1)),
        ledgers: ledgerItems,
      };
    }

    const primaryGroups = allGroups
      .filter((g) => g.isPrimary)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

    const byCategory: Record<string, any[]> = {};
    primaryGroups.forEach((pg) => {
      const cat = pg.category || "Miscellaneous";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(buildNode(pg, 0));
    });
    return byCategory;
  }, [allGroups, allLedgers]);

  // â”€â”€ Flattened for search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function flattenNode(node: any, result: any[] = []): any[] {
    result.push({ ...node, kind: "group" });
    node.ledgers.forEach((l: any) => result.push({ ...l, kind: "ledger", depth: node.depth + 1 }));
    node.children.forEach((c: any) => flattenNode(c, result));
    return result;
  }

  const flatList = useMemo(() => {
    const all: any[] = [];
    CATEGORY_ORDER.forEach((cat) => {
      (tree[cat] || []).forEach((n: any) => flattenNode(n, all));
    });
    if (!searchTerm && filterGroup === "ALL" && filterType === "ALL") return all;
    const q = searchTerm.toLowerCase();
    return all.filter((item) => {
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.alias || "").toLowerCase().includes(q) ||
        (item.gstin || "").toLowerCase().includes(q);
      const matchGroup =
        filterGroup === "ALL" || item.groupId === filterGroup || item.id === filterGroup;
      const matchType =
        filterType === "ALL" ||
        (item.kind === "group" && filterType === "group") ||
        (item.kind === "ledger" && (filterType === "ALL" || item.accountType === filterType));
      return matchSearch && matchGroup && matchType;
    });
  }, [tree, searchTerm, filterGroup, filterType]);

  // â”€â”€ Balance calculations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function getGroupBalance(groupId: string): number {
    const directLedgers = allLedgers.filter((l) => l.groupId === groupId);
    const directBalance = directLedgers.reduce((s, l) => s + (l.balance || 0), 0);
    const childGroups = allGroups.filter((g) => g.parentId === groupId);
    const childBalance = childGroups.reduce((s, g) => s + getGroupBalance(g.id), 0);
    return directBalance + childBalance;
  }

  // â”€â”€ Toggle expand â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  // â”€â”€â”€ GROUP MASTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function openAddGroup(parentId?: string) {
    const parentGroup = parentId ? allGroups.find((g) => g.id === parentId) : null;
    setGForm({
      isPrimary: !parentId,
      parentId: parentId,
      nature: parentGroup?.nature || "debit",
      category: parentGroup?.category || "Assets",
    });
    setGErrors({});
    setEditingGroupId(null);
    setActivePanel("addGroup");
  }

  function openEditGroup(g: AccountGroup) {
    setGForm({ ...g });
    setGErrors({});
    setEditingGroupId(g.id);
    setActivePanel("editGroup");
  }

  function validateGroupForm(): boolean {
    const e: Record<string, string> = {};
    if (!gForm.name?.trim()) e.name = "Group Name is required";
    if (!gForm.isPrimary && !gForm.parentId) e.parentId = "Under Group is required";
    if (
      allGroups.find(
        (g) => g.name.toLowerCase() === gForm.name?.trim().toLowerCase() && g.id !== editingGroupId,
      )
    ) {
      e.name = `Group "${gForm.name}" already exists`;
    }
    setGErrors(e);
    return Object.keys(e).length === 0;
  }

  function saveGroup(andNew = false) {
    if (!validateGroupForm()) return;
    const parentGroup = gForm.parentId ? allGroups.find((g) => g.id === gForm.parentId) : null;
    const newGroup: AccountGroup = {
      id: editingGroupId || `ug-${Date.now()}`,
      name: gForm.name!.trim(),
      alias: gForm.alias?.trim(),
      isPrimary: gForm.isPrimary ?? false,
      parentId: gForm.isPrimary ? undefined : gForm.parentId,
      narration: gForm.narration?.trim(),
      isSystem: false,
      nature: gForm.nature || parentGroup?.nature || "debit",
      category: gForm.category || parentGroup?.category || "Assets",
      sortOrder: gForm.sortOrder,
    };
    if (editingGroupId) {
      setGroups((prev) => prev.map((g) => (g.id === editingGroupId ? newGroup : g)));
      toast.success(`Group "${newGroup.name}" updated.`);
    } else {
      setGroups((prev) => [...prev, newGroup]);
      toast.success(`Group "${newGroup.name}" created.`);
    }
    if (andNew) {
      setGForm({
        isPrimary: false,
        parentId: gForm.parentId,
        nature: gForm.nature,
        category: gForm.category,
      });
      setEditingGroupId(null);
    } else {
      setActivePanel("list");
    }
  }

  function confirmDeleteGroup(g: AccountGroup) {
    if (g.isSystem) {
      toast.error("System groups cannot be deleted.");
      return;
    }
    const hasChildren = allGroups.some((x) => x.parentId === g.id);
    if (hasChildren) {
      toast.error("Cannot delete: Group has sub-groups.");
      return;
    }
    const hasLedgers = allLedgers.some((l) => l.groupId === g.id);
    if (hasLedgers) {
      toast.error("Cannot delete: Group has ledger accounts.");
      return;
    }
    setDeleteTarget({ type: "group", id: g.id, name: g.name });
    setActivePanel("deleteConfirm");
  }

  function executeDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "group") {
      setGroups((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      toast.success(`Group "${deleteTarget.name}" deleted.`);
    } else {
      setLedgers((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      toast.success(`Ledger "${deleteTarget.name}" deleted.`);
    }
    setDeleteTarget(null);
    setActivePanel("list");
  }

  function copyGroup(g: AccountGroup) {
    setClipboardItem({ type: "group", data: g });
    toast.success(`"${g.name}" copied. Press "Paste" to create duplicate.`);
  }

  // â”€â”€â”€ LEDGER MASTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function openAddLedger(groupId?: string) {
    const grp = groupId ? allGroups.find((g) => g.id === groupId) : null;
    const defaultType = (() => {
      if (!grp) return "General Ledger";
      const name = grp.name.toLowerCase();
      if (name.includes("bank")) return "Bank";
      if (name.includes("cash")) return "Cash";
      if (name.includes("debtor") || name.includes("creditor") || name.includes("sundry"))
        return "Party";
      return "General Ledger";
    })();
    setLForm({ ...initLedger(), groupId: groupId, accountType: defaultType });
    setLErrors({});
    setLedgerTab("general");
    setEditingLedgerId(null);
    setActivePanel("addLedger");
  }

  function openEditLedger(l: Ledger) {
    setLForm({ ...l });
    setLErrors({});
    setLedgerTab("general");
    setEditingLedgerId(l.id);
    setActivePanel("editLedger");
  }

  function validateLedgerForm(): boolean {
    const e: Record<string, string> = {};
    if (!lForm.name?.trim()) e.name = "Account Name is required";
    if (!lForm.groupId) e.groupId = "Account Group is required";
    if (
      allLedgers.find(
        (l) =>
          l.name.toLowerCase() === lForm.name?.trim().toLowerCase() && l.id !== editingLedgerId,
      )
    ) {
      e.name = `Ledger "${lForm.name}" already exists`;
    }
    if (features.subLedgers && lForm.ledgerType === "Sub Ledger" && !lForm.parentLedgerId) {
      e.parentLedgerId = "Parent Account is required for Sub Ledger";
    }
    setLErrors(e);
    return Object.keys(e).length === 0;
  }

  function saveLedger(andNew = false) {
    if (!validateLedgerForm()) {
      setLedgerTab("general");
      return;
    }
    const newLedger: Ledger = {
      ...(lForm as Ledger),
      id: editingLedgerId || `led-${Date.now()}`,
      name: lForm.name!.trim(),
      createdAt: editingLedgerId
        ? allLedgers.find((l) => l.id === editingLedgerId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      balance: lForm.balance || 0,
    };
    if (editingLedgerId) {
      setLedgers((prev) => prev.map((l) => (l.id === editingLedgerId ? newLedger : l)));
      toast.success(`Ledger "${newLedger.name}" updated.`);
    } else {
      setLedgers((prev) => [...prev, newLedger]);
      toast.success(`Ledger "${newLedger.name}" created.`);
    }
    if (andNew) {
      setLForm({ ...initLedger(), groupId: lForm.groupId, accountType: lForm.accountType });
      setEditingLedgerId(null);
      setLedgerTab("general");
    } else {
      setActivePanel("list");
    }
  }

  function confirmDeleteLedger(l: Ledger) {
    if ((l.balance || 0) !== 0) {
      toast.error("Cannot delete: Ledger has non-zero balance.");
      return;
    }
    setDeleteTarget({ type: "ledger", id: l.id, name: l.name });
    setActivePanel("deleteConfirm");
  }

  function copyLedger(l: Ledger) {
    setClipboardItem({ type: "ledger", data: l });
    toast.success(`"${l.name}" copied.`);
  }

  function pasteCopied() {
    if (!clipboardItem) return;
    if (clipboardItem.type === "group") {
      setGForm({ ...clipboardItem.data, name: `${clipboardItem.data.name} (Copy)`, id: undefined });
      setEditingGroupId(null);
      setGErrors({});
      setActivePanel("addGroup");
    } else {
      setLForm({ ...clipboardItem.data, name: `${clipboardItem.data.name} (Copy)`, id: undefined });
      setEditingLedgerId(null);
      setLErrors({});
      setLedgerTab("general");
      setActivePanel("addLedger");
    }
  }

  // â”€â”€â”€ EXPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function exportToExcel() {
    const rows: any[] = [
      ["Group/Ledger", "Type", "Parent", "Nature", "Account Type", "GSTIN", "Balance"],
    ];
    flatList.forEach((item) => {
      const grp =
        item.kind === "ledger"
          ? allGroups.find((g) => g.id === item.groupId)
          : allGroups.find((g) => g.id === item.parentId);
      rows.push([
        "  ".repeat(item.depth || 0) + item.name,
        item.kind === "group" ? "Group" : "Ledger",
        grp?.name || "",
        item.nature || "",
        item.accountType || "",
        item.gstin || "",
        item.balance || 0,
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chart of Accounts");
    XLSX.writeFile(wb, `COA_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Exported to Excel.");
  }

  // â”€â”€â”€ Keyboard shortcuts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (activePanel === "list") {
        if (e.key === "F3") {
          e.preventDefault();
          openAddLedger();
        }
      }
      if (activePanel !== "list") {
        if (e.key === "Escape") {
          e.preventDefault();
          setActivePanel("list");
        }
        if (e.key === "F2") {
          e.preventDefault();
          if (activePanel === "addGroup" || activePanel === "editGroup") saveGroup();
          if (activePanel === "addLedger" || activePanel === "editLedger") saveLedger();
        }
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [activePanel, gForm, lForm]);

  // â”€â”€â”€ MASTER CONFIG PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderMasterConfig = () => (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-bold text-gray-800">Master Configuration â€” Account</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              saveToLS(LS_KEYS.MASTER_CONFIG, masterConfig);
              toast.success("Master Configuration saved. Dropdowns updated.");
              setActivePanel("list");
            }}
            className="h-7 px-3 bg-[var(--ds-action-primary)] text-white text-[12px] font-medium rounded hover:bg-[var(--ds-action-primary-hover)]"
          >
            Save & Apply
          </button>
          <button
            onClick={() => setActivePanel("list")}
            className="h-7 px-3 bg-white border border-[var(--ds-border-default)] text-gray-700 text-[12px] rounded hover:bg-gray-50"
          >
            â† Back
          </button>
        </div>
      </div>

      {/* Dropdown Display */}
      <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
        <div className={sectionHdr + " -mx-3 mb-3"}>Master Dropdown List Configuration</div>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Elements to be shown in Dropdown</label>
            <select
              value={masterConfig.dropdownDisplay}
              onChange={(e) =>
                setMasterConfig((p) => ({ ...p, dropdownDisplay: e.target.value as any }))
              }
              className={inputCls}
            >
              <option value="name">Name Only</option>
              <option value="name_alias">Name and Alias</option>
              <option value="name_alias_group">Name, Alias and Group</option>
              <option value="name_code">Name and Code</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Additional Dropdown Fields (max 3)</label>
            {masterConfig.additionalDropdownFields.map((f, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <select
                  value={f.field}
                  onChange={(e) => {
                    const upd = [...masterConfig.additionalDropdownFields];
                    upd[i] = { ...upd[i], field: e.target.value };
                    setMasterConfig((p) => ({ ...p, additionalDropdownFields: upd }));
                  }}
                  className={`${inputCls} flex-1`}
                >
                  <option value="">â€” Select Field â€”</option>
                  {[
                    "group",
                    "city",
                    "state",
                    "gstin",
                    "pan",
                    "phone",
                    "opening_balance",
                    "credit_limit",
                    "account_type",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={f.width}
                  onChange={(e) => {
                    const upd = [...masterConfig.additionalDropdownFields];
                    upd[i] = { ...upd[i], width: Number(e.target.value) };
                    setMasterConfig((p) => ({ ...p, additionalDropdownFields: upd }));
                  }}
                  className="w-16 h-8 px-2 text-[12px] border border-[var(--ds-border-default)] rounded"
                  placeholder="Width"
                />
                <button
                  onClick={() =>
                    setMasterConfig((p) => ({
                      ...p,
                      additionalDropdownFields: p.additionalDropdownFields.filter(
                        (_, j) => j !== i,
                      ),
                    }))
                  }
                  className="h-8 w-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {masterConfig.additionalDropdownFields.length < 3 && (
              <button
                onClick={() =>
                  setMasterConfig((p) => ({
                    ...p,
                    additionalDropdownFields: [
                      ...p.additionalDropdownFields,
                      { field: "", width: 15 },
                    ],
                  }))
                }
                className="h-7 px-3 bg-white border border-[var(--ds-border-default)] text-gray-700 text-[12px] rounded hover:bg-gray-50 flex items-center gap-1.5 mt-1"
              >
                <Plus className="h-3 w-3" /> Add Field
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Panel */}
      <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
        <div className={sectionHdr + " -mx-3 mb-3"}>Bottom Panel Configuration</div>
        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={masterConfig.showBottomPanel}
            onChange={(e) => setMasterConfig((p) => ({ ...p, showBottomPanel: e.target.checked }))}
            className="h-4 w-4 rounded accent-[var(--ds-action-primary)]"
          />
          <span className="text-[12px] font-medium text-gray-700">
            Show Additional Information in Bottom of List
          </span>
        </label>
        {masterConfig.showBottomPanel && (
          <div>
            <label className={labelCls}>Fields to show in bottom panel</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                "Name",
                "Alias",
                "Group",
                "Address",
                "City",
                "State",
                "PIN Code",
                "Phone",
                "Mobile",
                "Email",
                "GSTIN",
                "PAN",
                "Registration Type",
                "Opening Balance",
                "Account Type",
                "Credit Limit",
                "TDS Applicable",
              ].map((f) => (
                <label key={f} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={masterConfig.bottomPanelFields.includes(f)}
                    onChange={(e) =>
                      setMasterConfig((p) => ({
                        ...p,
                        bottomPanelFields: e.target.checked
                          ? [...p.bottomPanelFields, f]
                          : p.bottomPanelFields.filter((x) => x !== f),
                      }))
                    }
                    className="h-3.5 w-3.5 rounded accent-[var(--ds-action-primary)]"
                  />
                  <span className="text-[12px] text-gray-700">{f}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Optional Fields */}
      <div className="p-3 bg-gray-50 rounded border border-gray-200">
        <div className={sectionHdr + " -mx-3 mb-3"}>Optional / Additional Fields (up to 10)</div>
        {masterConfig.optionalFields.map((f, i) => (
          <div key={f.id} className="border border-gray-200 rounded p-3 mb-2 bg-white">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Field Name</label>
                <input
                  value={f.name}
                  onChange={(e) => {
                    const upd = [...masterConfig.optionalFields];
                    upd[i] = { ...upd[i], name: e.target.value };
                    setMasterConfig((p) => ({ ...p, optionalFields: upd }));
                  }}
                  className={inputCls}
                  placeholder="e.g. Contact Person"
                />
              </div>
              <div>
                <label className={labelCls}>Data Type</label>
                <select
                  value={f.dataType}
                  onChange={(e) => {
                    const upd = [...masterConfig.optionalFields];
                    upd[i] = { ...upd[i], dataType: e.target.value as any };
                    setMasterConfig((p) => ({ ...p, optionalFields: upd }));
                  }}
                  className={inputCls}
                >
                  <option value="text">Text</option>
                  <option value="numeric">Numeric</option>
                  <option value="date">Date</option>
                  <option value="list">List (Dropdown)</option>
                  <option value="yesno">Yes/No</option>
                </select>
              </div>
              {f.dataType === "list" && (
                <div className="col-span-2">
                  <label className={labelCls}>List Values (comma separated)</label>
                  <input
                    value={f.listValues || ""}
                    onChange={(e) => {
                      const upd = [...masterConfig.optionalFields];
                      upd[i] = { ...upd[i], listValues: e.target.value };
                      setMasterConfig((p) => ({ ...p, optionalFields: upd }));
                    }}
                    className={inputCls}
                    placeholder="A,B,C or North,South,East"
                  />
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-[12px]">
                  <input
                    type="checkbox"
                    checked={f.mandatory}
                    onChange={(e) => {
                      const upd = [...masterConfig.optionalFields];
                      upd[i] = { ...upd[i], mandatory: e.target.checked };
                      setMasterConfig((p) => ({ ...p, optionalFields: upd }));
                    }}
                    className="h-3.5 w-3.5 rounded accent-[var(--ds-action-primary)]"
                  />{" "}
                  Mandatory
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[12px]">
                  <input
                    type="checkbox"
                    checked={f.maintainDB}
                    onChange={(e) => {
                      const upd = [...masterConfig.optionalFields];
                      upd[i] = { ...upd[i], maintainDB: e.target.checked };
                      setMasterConfig((p) => ({ ...p, optionalFields: upd }));
                    }}
                    className="h-3.5 w-3.5 rounded accent-[var(--ds-action-primary)]"
                  />{" "}
                  Maintain Database
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() =>
                    setMasterConfig((p) => ({
                      ...p,
                      optionalFields: p.optionalFields.filter((_, j) => j !== i),
                    }))
                  }
                  className="h-7 px-2 bg-red-50 text-red-600 text-[12px] rounded border border-red-200 hover:bg-red-100"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
        {masterConfig.optionalFields.length < 10 && (
          <button
            onClick={() =>
              setMasterConfig((p) => ({
                ...p,
                optionalFields: [
                  ...p.optionalFields,
                  {
                    id: `opt-${Date.now()}`,
                    name: "",
                    dataType: "text",
                    mandatory: false,
                    maintainDB: true,
                  },
                ],
              }))
            }
            className="h-7 px-3 bg-white border border-[var(--ds-border-default)] text-gray-700 text-[12px] rounded hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Plus className="h-3 w-3" /> Add Optional Field
          </button>
        )}
      </div>
    </div>
  );


  // â”€â”€â”€ SELECTED ITEM BOTTOM PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const selectedItem = selectedId
    ? allLedgers.find((l) => l.id === selectedId) || allGroups.find((g) => g.id === selectedId)
    : null;
  const selectedIsLedger = selectedId ? !!allLedgers.find((l) => l.id === selectedId) : false;

  // â”€â”€â”€ RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (activePanel === "addGroup" || activePanel === "editGroup") {
    return (
      <div className="h-full overflow-y-auto bg-white">
        <CoaGroupForm
          mode={activePanel === "editGroup" ? "edit" : "add"}
          gForm={gForm}
          gErrors={gErrors}
          editingGroupId={editingGroupId}
          allGroups={allGroups}
          onChange={setGForm}
          onSave={saveGroup}
          onCancel={() => setActivePanel("list")}
          onDelete={confirmDeleteGroup}
          onCopy={copyGroup}
        />
      </div>
    );
  }
  if (activePanel === "addLedger" || activePanel === "editLedger") {
    return (
      <div className="h-full overflow-y-auto bg-white">
        <CoaLedgerForm
          mode={activePanel === "editLedger" ? "edit" : "add"}
          lForm={lForm}
          lErrors={lErrors}
          ledgerTab={ledgerTab}
          editingLedgerId={editingLedgerId}
          allGroups={allGroups}
          allLedgers={allLedgers}
          features={features}
          masterConfig={masterConfig}
          onChange={setLForm}
          onTabChange={setLedgerTab}
          onSave={saveLedger}
          onCancel={() => setActivePanel("list")}
          onDelete={confirmDeleteLedger}
          onCopy={copyLedger}
        />
      </div>
    );
  }
  if (activePanel === "features") {
    return (
      <div className="h-full overflow-y-auto bg-white">
        <CoaFeaturesPanel
          features={features}
          onChange={(updated, meta) => {
            setFeatures(updated);
            saveToLS(LS_KEYS.FEATURES, updated);
            toast.success(`${meta.label} ${meta.enabled ? "enabled" : "disabled"}.`);
          }}
          onBack={() => setActivePanel("list")}
        />
      </div>
    );
  }
  if (activePanel === "masterConfig") {
    return <div className="h-full overflow-y-auto bg-white">{renderMasterConfig()}</div>;
  }
  const isSearchActive =
    searchTerm.trim().length > 0 || filterGroup !== "ALL" || filterType !== "ALL";
  const displayRows = isSearchActive ? flatList : null;

  return (
    <div className="flex flex-col h-full bg-[var(--ds-surface-muted)]">
      <CoaToolbar
        allGroups={allGroups}
        allLedgersCount={allLedgers.length}
        clipboardItem={clipboardItem}
        onPaste={pasteCopied}
        onOpenFeatures={() => setActivePanel("features")}
        onOpenMasterConfig={() => setActivePanel("masterConfig")}
        onExport={exportToExcel}
        onAddGroup={() => openAddGroup()}
        onAddLedger={() => openAddLedger()}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterGroup={filterGroup}
        onFilterGroupChange={setFilterGroup}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        isSearchActive={isSearchActive}
        onClearFilters={() => {
          setSearchTerm("");
          setFilterGroup("ALL");
          setFilterType("ALL");
        }}
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        <CoaTreeView
          isSearchActive={isSearchActive}
          displayRows={displayRows}
          tree={tree}
          expandedIds={expandedIds}
          selectedId={selectedId}
          allGroups={allGroups}
          onSelect={(id, isGroup, hasChildren) => {
            setSelectedId(id);
            if (isGroup && hasChildren) toggleExpand(id);
          }}
          onToggleExpand={toggleExpand}
          onEditGroup={openEditGroup}
          onEditLedger={openEditLedger}
          onCopyGroup={copyGroup}
          onCopyLedger={copyLedger}
          onDeleteGroup={confirmDeleteGroup}
          onDeleteLedger={confirmDeleteLedger}
          getGroupBalance={getGroupBalance}
        />

        <CoaBottomPanel
          showBottomPanel={masterConfig.showBottomPanel}
          selectedItem={selectedItem}
          selectedIsLedger={selectedIsLedger}
          masterConfig={masterConfig}
          allGroups={allGroups}
          allLedgers={allLedgers}
          features={features}
        />
      </div>

      <CoaDeleteDialog
        deleteTarget={deleteTarget}
        onCancel={() => {
          setDeleteTarget(null);
          setActivePanel("list");
        }}
        onConfirm={executeDelete}
      />
    </div>
  );
};

export default ChartOfAccounts;
