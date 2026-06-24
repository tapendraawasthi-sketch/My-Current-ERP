// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { Card, Badge, Button, Input, Select, Modal, ConfirmDialog } from "./ui";
import Pagination from "./ui/Pagination";
import {
  Plus,
  Search,
  Edit2,
  Lock,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
  Trash2,
  ArrowRight,
  CheckSquare,
  Square,
  FolderOpen,
  BookOpen,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import { formatNumber } from "../lib/utils";
import { AccountType, AccountLevel, Account } from "../lib/types";
import { isDebitNature } from "../lib/accounting";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { PillTitle, FormPanel } from "../components/BusyShell";

interface TreeNode {
  id: string;
  name: string;
  nameNepali?: string;
  code: string;
  type: AccountType;
  level: "root" | AccountLevel;
  depth: number;
  isActive: boolean;
  isGroup: boolean;
  isSystemAccount?: boolean;
  parentId?: string;
  balance: number;
  rowObject?: Account;
  children: TreeNode[];
}

// ─── TYPE COLOR CONFIG ─────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<
  AccountType,
  { bg: string; text: string; border: string; badge: string; dot: string; label: string }
> = {
  [AccountType.ASSET]: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-l-blue-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    label: "Assets",
  },
  [AccountType.LIABILITY]: {
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-l-red-600",
    badge: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
    label: "Liabilities",
  },
  [AccountType.EQUITY]: {
    bg: "bg-purple-50",
    text: "text-purple-800",
    border: "border-l-purple-600",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
    label: "Equity",
  },
  [AccountType.INCOME]: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-l-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    label: "Income",
  },
  [AccountType.EXPENSE]: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-l-amber-600",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    label: "Expenses",
  },
};

const LEVEL_LABELS: Record<string, string> = {
  root: "Primary",
  group: "Group",
  subgroup: "Sub-Group",
  ledger: "Ledger",
  subledger: "Sub-Ledger",
};

const ChartOfAccounts: React.FC = React.memo(() => {
  const {
    accounts,
    vouchers,
    addAccount,
    updateAccount,
    deleteAccount,
    companySettings,
    costCenters,
    setCurrentPage,
    setReportFilters,
    isDbReady,
    currentFiscalYear,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | AccountType>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "root-asset": true,
    "root-liability": true,
    "root-equity": true,
    "root-income": true,
    "root-expense": true,
  });

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<Account | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Form states
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameNepali, setNameNepali] = useState("");
  const [type, setType] = useState<AccountType>(AccountType.ASSET);
  const [level, setLevel] = useState<AccountLevel>(AccountLevel.LEDGER);
  const [parentId, setParentId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isGroup, setIsGroup] = useState(false);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingType, setOpeningType] = useState<"Dr" | "Cr">("Dr");
  const [openingBalanceDate, setOpeningBalanceDate] = useState<string>(
    () => currentFiscalYear?.startDate || new Date().toISOString().split("T")[0],
  );

  useEffect(() => {
    if (currentFiscalYear?.startDate) setOpeningBalanceDate(currentFiscalYear.startDate);
  }, [currentFiscalYear?.startDate]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── PARENT CHANGE HANDLER ────────────────────────────────────────────────────
  const handleParentIdChange = (parentAcctId: string) => {
    setParentId(parentAcctId);
    if (!parentAcctId) {
      setLevel(AccountLevel.GROUP);
      setIsGroup(true);
      suggestNextCode(undefined);
      return;
    }
    const parentAcc = accounts.find((a) => a.id === parentAcctId);
    if (parentAcc) {
      setType(parentAcc.type);
      if (parentAcc.level === AccountLevel.GROUP) {
        setLevel(AccountLevel.SUBGROUP);
        setIsGroup(true);
      } else if (parentAcc.level === AccountLevel.SUBGROUP) {
        setLevel(AccountLevel.LEDGER);
        setIsGroup(false);
      } else if (parentAcc.level === AccountLevel.LEDGER) {
        setLevel(AccountLevel.SUBLEDGER);
        setIsGroup(false);
      }
      suggestNextCode(parentAcc);
    }
  };

  // ─── AUTO CODE SUGGESTION ─────────────────────────────────────────────────────
  const suggestNextCode = (parentAcc?: Account) => {
    if (!parentAcc) {
      const typeBases: Record<AccountType, number> = {
        [AccountType.ASSET]: 1000,
        [AccountType.LIABILITY]: 3000,
        [AccountType.EQUITY]: 2000,
        [AccountType.INCOME]: 4000,
        [AccountType.EXPENSE]: 5000,
      };
      const base = typeBases[type] || 1000;
      const sisterAccounts = accounts.filter((a) => !a.parentId && a.type === type);
      if (sisterAccounts.length === 0) {
        setCode(String(base));
      } else {
        const maxCode = Math.max(...sisterAccounts.map((a) => parseInt(a.code) || 0));
        setCode(String(maxCode + 100));
      }
      return;
    }
    const sisterAccounts = accounts.filter((a) => a.parentId === parentAcc.id);
    if (sisterAccounts.length === 0) {
      setCode(parentAcc.code + "1");
    } else {
      const maxCode = Math.max(...sisterAccounts.map((a) => parseInt(a.code) || 0));
      if (!isNaN(maxCode) && maxCode > 0) {
        setCode(String(maxCode + 1));
      } else {
        setCode(parentAcc.code + "1");
      }
    }
  };

  // ─── TREE DATA ────────────────────────────────────────────────────────────────
  const treeData = useMemo(() => {
    const rootTypes = [
      { type: AccountType.ASSET, name: "Assets" },
      { type: AccountType.LIABILITY, name: "Liabilities" },
      { type: AccountType.EQUITY, name: "Equity" },
      { type: AccountType.INCOME, name: "Income" },
      { type: AccountType.EXPENSE, name: "Expenses" },
    ];

    const accountMap = new Map<string, Account>();
    accounts.forEach((a) => accountMap.set(a.id, a));

    const getSubNodes = (
      pId: string | undefined,
      currentType: AccountType,
      currentDepth: number,
    ): TreeNode[] => {
      return accounts
        .filter(
          (a) =>
            a.type === currentType &&
            (pId === undefined
              ? !a.parentId || !accountMap.has(a.parentId)
              : a.parentId === pId),
        )
        .map((a) => {
          const children = getSubNodes(a.id, currentType, currentDepth + 1);
          return {
            id: a.id,
            name: a.name,
            nameNepali: a.nameNepali,
            code: a.code,
            type: a.type,
            level: a.level,
            depth: currentDepth,
            isActive: a.isActive,
            isGroup: a.isGroup,
            isSystemAccount: !!a.isSystemAccount,
            parentId: a.parentId,
            balance: a.balance || 0,
            rowObject: a,
            children,
          };
        })
        .sort((a, b) => a.code.localeCompare(b.code));
    };

    return rootTypes.map((rt) => {
      const children = getSubNodes(undefined, rt.type, 1);
      const rootBalance = children.reduce((sum, child) => sum + child.balance, 0);
      return {
        id: `root-${rt.type}`,
        name: rt.name,
        code: "",
        type: rt.type,
        level: "root" as any,
        depth: 0,
        isActive: true,
        isGroup: true,
        balance: rootBalance,
        children,
      };
    });
  }, [accounts]);

  // ─── EXPAND / COLLAPSE ────────────────────────────────────────────────────────
  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const nextStates: Record<string, boolean> = {
      "root-asset": true,
      "root-liability": true,
      "root-equity": true,
      "root-income": true,
      "root-expense": true,
    };
    accounts.forEach((acc) => {
      if (acc.isGroup) nextStates[acc.id] = true;
    });
    setExpandedNodes(nextStates);
    toast.success("All groups expanded.");
  };

  const collapseAll = () => {
    setExpandedNodes({
      "root-asset": false,
      "root-liability": false,
      "root-equity": false,
      "root-income": false,
      "root-expense": false,
    });
    toast.success("All groups collapsed.");
  };

  // ─── FLATTENED ROWS ───────────────────────────────────────────────────────────
  const flattenedRows = useMemo(() => {
    const list: TreeNode[] = [];
    const visit = (node: TreeNode) => {
      if (activeTab !== "ALL" && node.depth === 0 && node.type !== activeTab) return;
      if (node.depth > 0) {
        list.push(node);
      } else if (activeTab === "ALL" || node.type === activeTab) {
        list.push(node);
      }
      if (expandedNodes[node.id] && node.children.length > 0) {
        node.children.forEach(visit);
      }
    };
    treeData.forEach(visit);
    return list;
  }, [treeData, expandedNodes, activeTab]);

  // ─── SEARCH ───────────────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase().trim();
    return accounts.filter((acc) => {
      const matchText =
        acc.name.toLowerCase().includes(q) ||
        acc.code.includes(q) ||
        (acc.nameNepali && acc.nameNepali.includes(q));
      const matchTab = activeTab === "ALL" || acc.type === activeTab;
      return matchText && matchTab;
    });
  }, [accounts, searchTerm, activeTab]);

  // ─── BALANCE DISPLAY ──────────────────────────────────────────────────────────
  const formatDrCrBalance = (balance: number, type: AccountType) => {
    const absVal = Math.abs(balance);
    if (absVal === 0) return "—";
    const isDr = balance >= 0 ? isDebitNature(type) : !isDebitNature(type);
    const suffix = isDr ? " Dr" : " Cr";
    return `Rs. ${formatNumber(absVal)}${suffix}`;
  };

  // ─── DETAIL PANEL DATA ────────────────────────────────────────────────────────
  const detailPanelData = useMemo(() => {
    if (!selectedNode || selectedNode.level === "root") return null;
    const acctId = selectedNode.id;
    const ledgerLines = vouchers
      .filter((v) => v.status === "posted")
      .flatMap((v) => v.lines.map((line) => ({ ...line, date: v.date, voucherNo: v.voucherNo })))
      .filter((line) => line.accountId === acctId);
    const transactionsCount = ledgerLines.length;
    const lastTxDate =
      ledgerLines.length > 0
        ? ledgerLines.reduce((max, line) => (line.date > max ? line.date : max), "")
        : null;
    return { transactionsCount, lastTxDate };
  }, [selectedNode, vouchers]);

  // ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true");
      if (isTyping) return;

      if (e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleOpenCreateModal();
      } else if (e.ctrlKey && e.key.toLowerCase() === "e") {
        if (selectedNode && selectedNode.level !== "root") {
          e.preventDefault();
          handleOpenEditModal(selectedNode.rowObject);
        }
      } else if (e.key === "Delete") {
        if (selectedNode && selectedNode.level !== "root" && !selectedNode.isSystemAccount) {
          e.preventDefault();
          setConfirmDeleteAccount(selectedNode.rowObject || null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNode, accounts]);

  // ─── CRUD HANDLERS ────────────────────────────────────────────────────────────
  const handleOpenCreateModal = () => {
    setCode("");
    setName("");
    setNameNepali("");
    setType(AccountType.ASSET);
    setLevel(AccountLevel.LEDGER);
    setParentId("");
    setCostCenterId("");
    setIsActive(true);
    setIsGroup(false);
    setOpeningBalance(0);
    setOpeningType("Dr");
    setOpeningBalanceDate(currentFiscalYear?.startDate || new Date().toISOString().split("T")[0]);
    setAddModalOpen(true);
  };

  const handleOpenEditModal = (acc: any) => {
    if (!acc) return;
    setCode(acc.code);
    setName(acc.name);
    setNameNepali(acc.nameNepali || "");
    setType(acc.type);
    setLevel(acc.level);
    setParentId(acc.parentId || "");
    setCostCenterId(acc.costCenterId || "");
    setIsActive(acc.isActive);
    setIsGroup(!!acc.isGroup);
    setOpeningBalance(acc.openingBalance || 0);
    setOpeningType(acc.openingBalanceDr && acc.openingBalanceDr > 0 ? "Dr" : "Cr");
    setOpeningBalanceDate(acc.openingBalanceDate || currentFiscalYear?.startDate || new Date().toISOString().split("T")[0]);
    setEditModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Account name is required."); return; }
    if (!code.trim()) { toast.error("Account code is required."); return; }
    const codeMatch = accounts.find((a) => a.code === code.trim());
    if (codeMatch) { toast.error(`Code '${code}' is already used by '${codeMatch.name}'.`); return; }
    if (level !== AccountLevel.GROUP && !parentId) {
      toast.error("A parent group is required for this account level.");
      return;
    }
    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        nameNepali: nameNepali.trim() || undefined,
        type,
        level,
        parentId: parentId || undefined,
        costCenterId: costCenterId || undefined,
        isGroup: ["group", "subgroup"].includes(level),
        isActive,
        openingBalance,
        openingBalanceDr: openingType === "Dr" ? openingBalance : 0,
        openingBalanceCr: openingType === "Cr" ? openingBalance : 0,
        openingBalanceDate: openingBalanceDate || new Date().toISOString().split("T")[0],
      };
      await addAccount(payload);
      toast.success(`'${name}' created successfully.`);
      setAddModalOpen(false);
      setSelectedNode(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to create account.");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode || !selectedNode.rowObject) return;
    const accId = selectedNode.rowObject.id;
    if (!name.trim()) { toast.error("Account name is required."); return; }
    const codeMatch = accounts.find((a) => a.code === code.trim() && a.id !== accId);
    if (codeMatch) { toast.error(`Code '${code}' is already used by '${codeMatch.name}'.`); return; }
    if (level !== AccountLevel.GROUP && !parentId) {
      toast.error("A parent group is required for this account level.");
      return;
    }
    try {
      const updates = {
        code: code.trim(),
        name: name.trim(),
        nameNepali: nameNepali.trim() || undefined,
        type,
        level,
        parentId: parentId || undefined,
        costCenterId: costCenterId || undefined,
        isGroup: ["group", "subgroup"].includes(level),
        isActive,
        openingBalance,
        openingBalanceDr: openingType === "Dr" ? openingBalance : 0,
        openingBalanceCr: openingType === "Cr" ? openingBalance : 0,
        openingBalanceDate: openingBalanceDate || new Date().toISOString().split("T")[0],
      };
      await updateAccount(accId, updates);
      toast.success(`'${name}' updated successfully.`);
      setEditModalOpen(false);
      setSelectedNode(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update account.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteAccount) return;
    try {
      const res = await deleteAccount(confirmDeleteAccount.id);
      if (res) {
        toast.success(`'${confirmDeleteAccount.name}' deleted.`);
        setConfirmDeleteAccount(null);
        setSelectedNode(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Cannot delete. Check for linked transactions.");
    }
  };

  // ─── EXPORT / IMPORT ──────────────────────────────────────────────────────────
  const handleExportToExcel = () => {
    const headers = ["Code", "Account Name", "Nepali Name", "Type", "Level", "Balance", "Status", "System Account"];
    const rows: any[] = [];
    const visit = (node: TreeNode, indent = "") => {
      rows.push([
        node.code || "-",
        indent + node.name,
        node.nameNepali || "",
        node.type.toUpperCase(),
        LEVEL_LABELS[node.level] || node.level,
        node.balance,
        node.isActive ? "Active" : "Inactive",
        node.isSystemAccount ? "Yes" : "No",
      ]);
      node.children.forEach((c) => visit(c, indent + "  "));
    };
    treeData.forEach((node) => {
      if (activeTab === "ALL" || node.type === activeTab) visit(node);
    });
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Chart of Accounts");
    XLSX.writeFile(workbook, `Chart_of_Accounts_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Chart of Accounts exported to Excel.");
  };

  const handleDownloadTemplate = () => {
    const headers = ["Account_Code", "Account_Name", "Nepali_Name", "Type", "Level", "Parent_Code", "Opening_Balance", "Dr_Cr"];
    const example1 = ["1111", "Everest Bank Account", "एभरेष्ट बैंक खाता", "asset", "ledger", "1100", "75000", "Dr"];
    const example2 = ["5208", "Stationery Expenses", "स्टेशनरी खर्च", "expense", "ledger", "5200", "0", "Dr"];
    const ws = XLSX.utils.aoa_to_sheet([headers, example1, example2]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "COA Import Template");
    XLSX.writeFile(wb, "COA_Import_Template.csv");
    toast.success("Import template downloaded.");
  };

  const handleImportCSVData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length <= 1) { toast.error("No data rows found in file."); return; }
        let successCount = 0;
        let failCount = 0;
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i]
            .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
            .map((cell) => cell.replace(/^"|"$/g, "").trim());
          if (row.length === 0 || !row[0]) continue;
          const accCode = row[0];
          const accName = row[1];
          const accNepali = row[2] || undefined;
          const rawType = (row[3] || "asset").toLowerCase() as AccountType;
          const rawLevel = (row[4] || "ledger").toLowerCase() as AccountLevel;
          const pCodeOrId = row[5] || undefined;
          const oBalance = parseFloat(row[6]) || 0;
          const balDrCr = (row[7] || "Dr").trim();
          if (!accCode || !accName) { failCount++; continue; }
          let resolvedParentId: string | undefined;
          if (pCodeOrId) {
            const parentDef = accounts.find((a) => a.id === pCodeOrId || a.code === pCodeOrId);
            if (parentDef) resolvedParentId = parentDef.id;
          }
          await addAccount({
            code: accCode,
            name: accName,
            nameNepali: accNepali,
            type: rawType,
            level: rawLevel,
            parentId: resolvedParentId,
            isActive: true,
            isGroup: ["group", "subgroup"].includes(rawLevel),
            openingBalance: oBalance,
            openingBalanceDr: balDrCr.toLowerCase() === "dr" ? oBalance : 0,
            openingBalanceCr: balDrCr.toLowerCase() === "cr" ? oBalance : 0,
            openingBalanceDate: currentFiscalYear?.startDate || new Date().toISOString().split("T")[0],
          });
          successCount++;
        }
        toast.success(`Import complete: ${successCount} accounts added, ${failCount} skipped.`);
        setImportModalOpen(false);
      } catch (err: any) {
        toast.error(`Import failed: ${err.message || "File parse error."}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── BULK SELECT ──────────────────────────────────────────────────────────────
  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getActiveSelectedList = () => Object.keys(selectedIds).filter((id) => selectedIds[id]);

  const selectAllFlattened = () => {
    const list = getActiveSelectedList();
    if (list.length === flattenedRows.filter((r) => !r.id.startsWith("root-")).length) {
      setSelectedIds({});
    } else {
      const dict: Record<string, boolean> = {};
      flattenedRows.forEach((row) => { if (!row.id.startsWith("root-")) dict[row.id] = true; });
      setSelectedIds(dict);
    }
  };

  const handleBulkDeactivate = async () => {
    const list = getActiveSelectedList();
    if (list.length === 0) return;
    try {
      const load = toast.loading(`Deactivating ${list.length} accounts...`);
      for (const id of list) {
        const acc = accounts.find((a) => a.id === id);
        if (acc && !acc.isSystemAccount) await updateAccount(id, { isActive: false });
      }
      toast.dismiss(load);
      toast.success(`${list.length} accounts deactivated.`);
      setSelectedIds({});
    } catch {
      toast.error("Bulk deactivation failed.");
    }
  };

  const handleBulkActivate = async () => {
    const list = getActiveSelectedList();
    if (list.length === 0) return;
    try {
      const load = toast.loading(`Activating ${list.length} accounts...`);
      for (const id of list) {
        const acc = accounts.find((a) => a.id === id);
        if (acc) await updateAccount(id, { isActive: true });
      }
      toast.dismiss(load);
      toast.success(`${list.length} accounts activated.`);
      setSelectedIds({});
    } catch {
      toast.error("Bulk activation failed.");
    }
  };

  // ─── COMPUTED ─────────────────────────────────────────────────────────────────
  const isSearchActive = useMemo(() => searchTerm.trim().length > 0, [searchTerm]);
  const filteredAccounts = useMemo(() => (isSearchActive ? searchResults : flattenedRows), [isSearchActive, searchResults, flattenedRows]);
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAccounts.slice(start, start + pageSize);
  }, [filteredAccounts, page, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));

  useEffect(() => { setPage(1); }, [searchTerm, activeTab]);

  // ─── SHARED LEDGER FORM JSX ───────────────────────────────────────────────────
  const renderLedgerForm = (onSubmit: (e: React.FormEvent) => void) => (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* Type + Level row */}
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Account Type"
          options={[
            { value: AccountType.ASSET, label: "Asset" },
            { value: AccountType.LIABILITY, label: "Liability" },
            { value: AccountType.EQUITY, label: "Equity" },
            { value: AccountType.INCOME, label: "Income" },
            { value: AccountType.EXPENSE, label: "Expense" },
          ]}
          value={type}
          onChange={(val) => setType(val as AccountType)}
          required
          disabled={!!parentId}
        />
        <Select
          label="Account Level"
          options={Object.values(AccountLevel).map((v) => ({
            value: v,
            label: LEVEL_LABELS[v] || v,
          }))}
          value={level}
          onChange={(val) => {
            const nextLevel = val as AccountLevel;
            setLevel(nextLevel);
            setIsGroup(["group", "subgroup"].includes(nextLevel));
          }}
          required
        />
      </div>

      {/* Under (Parent) */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Under (Parent Group)</span>
        <Select
          label=""
          options={accounts
            .filter((a) => {
              if (!a.isGroup) return false;
              if (editModalOpen && selectedNode && a.id === selectedNode.id) return false;
              return true;
            })
            .map((a) => ({
              value: a.id,
              label: `${a.code ? a.code + " · " : ""}${a.name}  [${LEVEL_LABELS[a.level] || a.level}]`,
            }))}
          value={parentId}
          onChange={handleParentIdChange}
          placeholder="— Primary (No parent) —"
          searchable={true}
        />
        {parentId && (
          <p className="text-[10px] text-blue-600 font-medium">
            Account type and level are auto-set based on the selected parent group.
          </p>
        )}
      </div>

      {/* Code + Status */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Account Code"
          placeholder="e.g. 1151"
          value={code}
          onChange={setCode}
          required
        />
        <div className="flex flex-col gap-1 justify-end pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Status</span>
          <label className="inline-flex items-center gap-2 cursor-pointer border border-gray-200 bg-white rounded-md px-3 py-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-gray-700">Active</span>
          </label>
        </div>
      </div>

      {/* Account Name */}
      <Input
        label="Account Name (English)"
        placeholder="e.g. Nepal Investment Bank Ltd."
        value={name}
        onChange={setName}
        required
      />
      <Input
        label="Account Name (Nepali) — Optional"
        placeholder="जस्तै: नेपाल इन्भेष्टमेन्ट बैंक लि."
        value={nameNepali}
        onChange={setNameNepali}
      />

      {/* Opening Balance — ledger/subledger only */}
      {!["group", "subgroup"].includes(level) && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Opening Balance</span>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount"
              type="number"
              placeholder="0.00"
              value={openingBalance === 0 ? "" : openingBalance}
              onChange={(v) => {
                const val = parseFloat(v);
                setOpeningBalance(isNaN(val) ? 0 : val);
              }}
              prefix="Rs."
              align="right"
            />
            <Select
              label="Dr / Cr"
              options={[
                { value: "Dr", label: "Debit (Dr)" },
                { value: "Cr", label: "Credit (Cr)" },
              ]}
              value={openingType}
              onChange={(v) => setOpeningType(v as "Dr" | "Cr")}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="As on Date"
              type="date"
              value={openingBalanceDate}
              onChange={setOpeningBalanceDate}
            />
            {companySettings?.enableCostCenter && (
              <Select
                label="Cost Centre"
                options={costCenters.map((cc) => ({ value: cc.id, label: cc.name }))}
                value={costCenterId}
                onChange={setCostCenterId}
                placeholder="Not Applicable"
              />
            )}
          </div>
        </div>
      )}
    </form>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#e8e4f0", padding: 12 }}>
      <PillTitle title="Chart of Accounts" />
      <FormPanel>
        <div className="flex flex-col gap-4 animate-fadeIn select-none pb-12">

          {/* ── TOP TOOLBAR ─────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Chart of Accounts</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {accounts.length} accounts &nbsp;·&nbsp; {accounts.filter((a) => a.isGroup).length} groups &nbsp;·&nbsp; {accounts.filter((a) => !a.isGroup).length} ledgers
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={collapseAll}
                title="Collapse All"
                className="h-8 px-3 text-[11px] font-medium rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" /> Collapse
              </button>
              <button
                type="button"
                onClick={expandAll}
                title="Expand All"
                className="h-8 px-3 text-[11px] font-medium rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" /> Expand
              </button>
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className="h-8 px-3 text-[11px] font-medium rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" /> Import
              </button>
              <button
                type="button"
                onClick={handleExportToExcel}
                className="h-8 px-3 text-[11px] font-medium rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Export
              </button>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="h-8 px-3 text-[11px] font-semibold rounded-md bg-[#1557b0] hover:bg-[#0f4a96] text-white flex items-center gap-1.5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> New Account
              </button>
            </div>
          </div>

          {/* ── SEARCH + TABS ────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-shrink-0">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or code…"
                className="h-8 pl-8 pr-3 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-400 w-56 transition"
              />
            </div>
            <div className="flex items-center gap-1 border border-gray-200 rounded-md bg-white p-0.5">
              {(["ALL", "asset", "liability", "equity", "income", "expense"] as const).map((tab) => {
                const cfg = tab !== "ALL" ? TYPE_CONFIG[tab as AccountType] : null;
                const isActive2 = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`h-7 px-3 text-[11px] font-semibold rounded transition-colors flex items-center gap-1.5 ${
                      isActive2
                        ? "bg-[#1557b0] text-white shadow-sm"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    }`}
                  >
                    {cfg && isActive2 && (
                      <span className={`inline-block h-1.5 w-1.5 rounded-full bg-white opacity-80`} />
                    )}
                    {cfg && !isActive2 && (
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                    )}
                    {tab === "ALL" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                );
              })}
            </div>
            <div className="ml-auto flex items-center gap-1 text-[10.5px] text-gray-400 font-medium">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] shadow-sm font-mono mr-0.5">Ctrl+N</kbd> New
              &nbsp;&nbsp;
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] shadow-sm font-mono mr-0.5">Ctrl+E</kbd> Edit
              &nbsp;&nbsp;
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] shadow-sm font-mono mr-0.5">Del</kbd> Delete
            </div>
          </div>

          {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row gap-4 items-start">

            {/* ── ACCOUNTS TABLE ────────────────────────────────────────────────── */}
            <div className="flex-1 w-full flex flex-col gap-3">
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="w-10 px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={selectAllFlattened}
                            className="text-gray-400 hover:text-gray-700"
                            title="Select all"
                          >
                            {getActiveSelectedList().length > 0 &&
                            getActiveSelectedList().length ===
                              flattenedRows.filter((r) => !r.id.startsWith("root-")).length ? (
                              <CheckSquare className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider text-[10px] w-24">
                          Code
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider text-[10px]">
                          Account Name
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider text-[10px] w-28">
                          Type
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider text-[10px] w-24">
                          Level
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold text-gray-500 uppercase tracking-wider text-[10px] w-40">
                          Closing Balance
                        </th>
                        <th className="px-3 py-2.5 text-center font-semibold text-gray-500 uppercase tracking-wider text-[10px] w-20">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* ── SEARCH MODE ── */}
                      {isSearchActive ? (
                        paginatedData.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-14 text-gray-400 text-xs font-medium">
                              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                              No accounts match your search.
                            </td>
                          </tr>
                        ) : (
                          (paginatedData as Account[]).map((row) => {
                            const cfg = TYPE_CONFIG[row.type];
                            const isSelected = !!selectedIds[row.id];
                            return (
                              <tr
                                key={row.id}
                                onClick={() =>
                                  setSelectedNode({
                                    id: row.id,
                                    name: row.name,
                                    nameNepali: row.nameNepali,
                                    code: row.code,
                                    type: row.type,
                                    level: row.level,
                                    depth: 1,
                                    isActive: row.isActive,
                                    isGroup: row.isGroup,
                                    isSystemAccount: !!row.isSystemAccount,
                                    balance: row.balance || 0,
                                    rowObject: row,
                                    children: [],
                                  })
                                }
                                className={`cursor-pointer transition-colors hover:bg-blue-50/30 ${selectedNode?.id === row.id ? "bg-blue-50/50" : ""}`}
                              >
                                <td className="px-3 py-2.5 text-center" onClick={(e) => handleToggleSelectRow(row.id, e)}>
                                  {isSelected
                                    ? <CheckSquare className="h-4 w-4 text-blue-600 mx-auto" />
                                    : <Square className="h-4 w-4 text-gray-300 hover:text-gray-400 mx-auto" />}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-[11px] text-gray-700 font-semibold">{row.code}</td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-1.5">
                                    {!row.isActive && (
                                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-500 border border-red-100">Inactive</span>
                                    )}
                                    {row.isSystemAccount && <Lock className="h-3 w-3 text-amber-400 shrink-0" />}
                                    <span className={`font-semibold text-gray-800 ${!row.isActive ? "opacity-50" : ""}`}>{row.name}</span>
                                    {row.nameNepali && (
                                      <span className="text-[10px] text-gray-400 ml-1">· {row.nameNepali}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                    {cfg.label}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-0.5">
                                    {LEVEL_LABELS[row.level] || row.level}
                                  </span>
                                </td>
                                <td className={`px-3 py-2.5 text-right font-mono text-[11px] font-bold ${row.balance < 0 ? "text-red-600" : "text-gray-800"}`}>
                                  {formatDrCrBalance(row.balance || 0, row.type)}
                                </td>
                                <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-0.5">
                                    <button onClick={() => handleOpenEditModal(row)} className="p-1.5 rounded text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition" title="Edit">
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    {!row.isSystemAccount && (
                                      <button onClick={() => setConfirmDeleteAccount(row)} className="p-1.5 rounded text-gray-400 hover:bg-red-50 hover:text-red-500 transition" title="Delete">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )
                      ) : (
                        /* ── TREE MODE ── */
                        (paginatedData as TreeNode[]).map((row) => {
                          const isVirtualRoot = row.level === "root";
                          const cfg = TYPE_CONFIG[row.type];
                          const isSelected = !!selectedIds[row.id];

                          // ── ROOT ROW ──
                          if (isVirtualRoot) {
                            return (
                              <tr
                                key={row.id}
                                onClick={() => setSelectedNode(row)}
                                className={`cursor-pointer border-l-4 ${cfg.border} ${cfg.bg} hover:brightness-95 transition-all`}
                              >
                                <td className="px-3 py-3 text-center w-10" />
                                <td className="px-3 py-3 font-mono text-[11px] text-gray-500 font-medium">—</td>
                                <td className="px-3 py-3" colSpan={1}>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => toggleExpand(row.id, e)}
                                      className="p-0.5 rounded hover:bg-black/5 transition"
                                    >
                                      {expandedNodes[row.id]
                                        ? <ChevronDown className={`h-4 w-4 ${cfg.text}`} />
                                        : <ChevronRight className={`h-4 w-4 ${cfg.text}`} />}
                                    </button>
                                    <span className={`text-[12px] font-bold uppercase tracking-wide ${cfg.text}`}>
                                      {row.name}
                                    </span>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                                      {row.children.length} groups
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                    {cfg.label}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <span className="text-[10px] font-medium text-gray-500 bg-white/60 border border-gray-200 rounded px-2 py-0.5">Primary</span>
                                </td>
                                <td className={`px-3 py-3 text-right font-mono text-[11px] font-bold ${cfg.text}`}>
                                  {formatDrCrBalance(row.balance, row.type)}
                                </td>
                                <td className="px-3 py-3 text-center w-20" />
                              </tr>
                            );
                          }

                          // ── GROUP / LEDGER ROW ──
                          const depthPad = (row.depth - 1) * 20 + 8;
                          const isGroupRow = row.isGroup;
                          return (
                            <tr
                              key={row.id}
                              onClick={() => setSelectedNode(row)}
                              className={`cursor-pointer transition-colors
                                ${selectedNode?.id === row.id ? "bg-blue-50/60 ring-1 ring-inset ring-blue-200" : ""}
                                ${isGroupRow ? "bg-gray-50/70 hover:bg-gray-100/60" : "bg-white hover:bg-slate-50/50"}
                                ${!row.isActive ? "opacity-60" : ""}
                              `}
                            >
                              {/* Checkbox */}
                              <td className="px-3 py-2.5 text-center w-10" onClick={(e) => handleToggleSelectRow(row.id, e)}>
                                {isSelected
                                  ? <CheckSquare className="h-4 w-4 text-blue-600 mx-auto" />
                                  : <Square className="h-4 w-4 text-gray-300 hover:text-gray-400 mx-auto" />}
                              </td>

                              {/* Code */}
                              <td className="px-3 py-2.5 font-mono text-[11px] text-gray-600 font-medium">
                                {row.code || "—"}
                              </td>

                              {/* Name with indent */}
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1.5" style={{ paddingLeft: `${depthPad}px` }}>
                                  {/* Expand/collapse or leaf spacer */}
                                  {isGroupRow ? (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleExpand(row.id, e)}
                                      className="p-0.5 rounded hover:bg-gray-200/70 text-gray-400 hover:text-gray-700 transition shrink-0"
                                      title={expandedNodes[row.id] ? "Collapse" : "Expand"}
                                    >
                                      {expandedNodes[row.id]
                                        ? <ChevronDown className="h-3.5 w-3.5" />
                                        : <ChevronRight className="h-3.5 w-3.5" />}
                                    </button>
                                  ) : (
                                    <span className="w-5 shrink-0" />
                                  )}

                                  {/* Icon */}
                                  {isGroupRow
                                    ? <FolderOpen className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                    : <BookOpen className="h-3 w-3 text-gray-300 shrink-0" />}

                                  {/* Name */}
                                  <div className="flex flex-col leading-tight min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`leading-tight ${isGroupRow ? "font-semibold text-gray-800" : "font-medium text-gray-700"} text-[12px]`}>
                                        {row.name}
                                      </span>
                                      {row.isSystemAccount && (
                                        <Lock className="h-2.5 w-2.5 text-amber-400 shrink-0" title="System account — protected" />
                                      )}
                                      {!row.isActive && (
                                        <span className="text-[9px] font-bold px-1 py-0 rounded bg-red-50 text-red-400 border border-red-100">INACTIVE</span>
                                      )}
                                    </div>
                                    {row.nameNepali && (
                                      <span className="text-[10px] text-gray-400 mt-0.5">{row.nameNepali}</span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Type badge */}
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                  {cfg.label}
                                </span>
                              </td>

                              {/* Level */}
                              <td className="px-3 py-2.5">
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${isGroupRow ? "bg-gray-100 text-gray-600 border-gray-200" : "bg-white text-gray-500 border-gray-100"}`}>
                                  {LEVEL_LABELS[row.level] || row.level}
                                </span>
                              </td>

                              {/* Balance */}
                              <td className={`px-3 py-2.5 text-right font-mono text-[11px] font-semibold ${row.balance < 0 ? "text-red-600" : isGroupRow ? "text-gray-700" : "text-gray-600"}`}>
                                {formatDrCrBalance(row.balance, row.type)}
                              </td>

                              {/* Actions */}
                              <td className="px-3 py-2.5 text-center w-20" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-0.5">
                                  <button
                                    onClick={() => handleOpenEditModal(row.rowObject)}
                                    className="p-1.5 rounded text-gray-300 hover:bg-blue-50 hover:text-blue-600 transition"
                                    title="Edit account (Ctrl+E)"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  {!row.isSystemAccount && (
                                    <button
                                      onClick={() => setConfirmDeleteAccount(row.rowObject || null)}
                                      className="p-1.5 rounded text-gray-300 hover:bg-red-50 hover:text-red-500 transition"
                                      title="Delete account"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalRecords={filteredAccounts.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                />
              </div>

              {/* ── BULK ACTION BAR ───────────────────────────────────────────── */}
              {getActiveSelectedList().length > 0 && (
                <div className="sticky bottom-4 bg-gray-900 text-white rounded-xl shadow-xl border border-gray-800 px-4 py-3 flex items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckSquare className="h-4 w-4 text-blue-400" />
                    <span className="font-semibold">
                      {getActiveSelectedList().length} account{getActiveSelectedList().length > 1 ? "s" : ""} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedIds({})}
                      className="bg-transparent text-gray-300 border-gray-700 hover:bg-gray-800 text-xs">
                      Clear
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleBulkDeactivate}
                      className="bg-transparent text-red-400 border-red-800/60 hover:bg-red-900/20 text-xs">
                      Deactivate
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleBulkActivate}
                      className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-xs">
                      Activate
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT DETAIL PANEL ─────────────────────────────────────────────── */}
            {selectedNode && selectedNode.level !== "root" && (
              <div className="w-full lg:w-72 shrink-0 sticky top-6">
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  {/* Panel header */}
                  <div className={`px-4 py-3 border-b border-gray-100 flex items-center justify-between ${TYPE_CONFIG[selectedNode.type].bg}`}>
                    <div className="flex items-center gap-2">
                      {selectedNode.isGroup
                        ? <FolderOpen className={`h-4 w-4 ${TYPE_CONFIG[selectedNode.type].text}`} />
                        : <BookOpen className={`h-4 w-4 ${TYPE_CONFIG[selectedNode.type].text}`} />}
                      <span className={`text-[11px] font-bold uppercase tracking-wide ${TYPE_CONFIG[selectedNode.type].text}`}>
                        Account Details
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="text-gray-400 hover:text-gray-700 text-[10px] font-bold border border-gray-200 bg-white rounded px-2 py-0.5 leading-none hover:bg-gray-50 transition"
                    >
                      ✕ Close
                    </button>
                  </div>

                  <div className="p-4 flex flex-col gap-4">
                    {/* Account title block */}
                    <div>
                      <p className="text-[13px] font-bold text-gray-800 leading-snug">{selectedNode.name}</p>
                      {selectedNode.nameNepali && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{selectedNode.nameNepali}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="font-mono text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200 font-semibold">
                          {selectedNode.code || "—"}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_CONFIG[selectedNode.type].badge}`}>
                          {TYPE_CONFIG[selectedNode.type].label}
                        </span>
                        <span className="text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-0.5">
                          {LEVEL_LABELS[selectedNode.level] || selectedNode.level}
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-between text-xs border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
                      <span className="text-gray-500 font-medium">Status</span>
                      <span className={`flex items-center gap-1.5 font-semibold text-[11px] ${selectedNode.isActive ? "text-emerald-600" : "text-red-500"}`}>
                        <span className={`h-2 w-2 rounded-full ${selectedNode.isActive ? "bg-emerald-400" : "bg-red-400"}`} />
                        {selectedNode.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {/* Balance */}
                    <div className={`rounded-lg border p-3 ${TYPE_CONFIG[selectedNode.type].bg} border-opacity-40`}>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Closing Balance</p>
                      <p className={`text-[15px] font-bold font-mono leading-tight ${TYPE_CONFIG[selectedNode.type].text}`}>
                        {formatDrCrBalance(selectedNode.balance, selectedNode.type)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium">As per posted vouchers</p>
                    </div>

                    {/* Voucher stats */}
                    {detailPanelData && (
                      <div className="flex flex-col gap-1.5 text-[11px]">
                        <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                          <span className="text-gray-500 font-medium">Voucher entries</span>
                          <span className="font-mono font-semibold text-gray-700">{detailPanelData.transactionsCount}</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                          <span className="text-gray-500 font-medium">Last transaction</span>
                          <span className="font-semibold text-gray-700">{detailPanelData.lastTxDate || "—"}</span>
                        </div>
                      </div>
                    )}

                    {/* Quick actions */}
                    <div className="flex flex-col gap-2 pt-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick Actions</p>
                      <button
                        onClick={() => handleOpenEditModal(selectedNode.rowObject)}
                        className="w-full px-3 py-2 bg-[#1557b0] hover:bg-[#0f4a96] text-white rounded-lg font-semibold text-[11px] text-left flex items-center justify-between transition"
                      >
                        <span>Edit This Account</span>
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => { setCurrentPage("reports"); setReportFilters({ selectedReport: "trial-balance" }); }}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg font-medium text-[11px] text-left flex items-center justify-between transition"
                      >
                        <span>View Trial Balance</span>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                      <button
                        onClick={() => setCurrentPage("vouchers")}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg font-medium text-[11px] text-left flex items-center justify-between transition"
                      >
                        <span>View Vouchers</span>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── CREATE LEDGER MODAL ────────────────────────────────────────────────── */}
        <Modal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          title="Create Ledger / Group"
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleAddSubmit}>Create Account</Button>
            </div>
          }
        >
          {renderLedgerForm(handleAddSubmit)}
        </Modal>

        {/* ── ALTER LEDGER MODAL ─────────────────────────────────────────────────── */}
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title="Alter Ledger / Group"
          size="md"
          footer={
            <div className="flex justify-between items-center w-full">
              {selectedNode?.rowObject && !selectedNode.rowObject.isSystemAccount ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setConfirmDeleteAccount(selectedNode.rowObject || null); setEditModalOpen(false); }}
                  className="text-red-600 hover:bg-red-50 border-red-200"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Delete
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleEditSubmit}>Save Changes</Button>
              </div>
            </div>
          }
        >
          {renderLedgerForm(handleEditSubmit)}
        </Modal>

        {/* ── IMPORT MODAL ───────────────────────────────────────────────────────── */}
        <Modal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          title="Import Chart of Accounts"
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportModalOpen(false)}>Close</Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4 text-xs">
            <p className="text-gray-500 leading-relaxed">
              Import accounts from a CSV file. Download the template first to ensure correct column mapping.
            </p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-700 text-[11px]">Import Template (CSV)</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Pre-formatted columns for correct import</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                icon={<Download className="h-3.5 w-3.5" />}
              >
                Download
              </Button>
            </div>
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl text-center flex flex-col items-center justify-center gap-3 py-8 bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="p-2.5 bg-blue-100 rounded-full">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-700">Click to upload CSV file</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Accepts .csv format only</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-[11px] transition"
              >
                Select File
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportCSVData}
                accept=".csv"
                className="hidden"
              />
            </div>
          </div>
        </Modal>

        {/* ── DELETE CONFIRM ─────────────────────────────────────────────────────── */}
        <ConfirmDialog
          isOpen={confirmDeleteAccount !== null}
          onClose={() => setConfirmDeleteAccount(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Account"
          message={`Are you sure you want to permanently delete '${confirmDeleteAccount?.name}' (${confirmDeleteAccount?.code})? This cannot be undone.`}
          confirmText="Yes, Delete"
          cancelText="Cancel"
          danger={true}
        />
      </FormPanel>
    </div>
  );
});

export default ChartOfAccounts;
