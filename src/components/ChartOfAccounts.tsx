import React, { useState, useMemo, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { Card, Badge, Button, Input, Select, Modal, ConfirmDialog, ActionToolbar } from "./ui";
import Pagination from "./ui/Pagination";
import {
  FolderOpen,
  Plus,
  Search,
  Edit2,
  Lock,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
  Trash2,
  Filter,
  AlertCircle,
  FileText,
  CheckCircle2,
  XCircle,
  Info,
  Keyboard,
  Calendar,
  ArrowRight,
  Columns,
  RefreshCw,
  CheckSquare,
  Square,
  Eye,
  Printer,
} from "lucide-react";
import { formatCurrency, formatNumber } from "../lib/utils";
import { AccountType, AccountLevel, Account } from "../lib/types";
import { isDebitNature } from "../lib/accounting";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { getDB } from "../lib/db";

// Monkeypatch useStore to enforce double entry postings to Level 3 accounts only
const originalAddVoucher = useStore.getState().addVoucher;
const originalUpdateVoucher = useStore.getState().updateVoucher;

useStore.setState({
  addVoucher: async (voucherData) => {
    const accounts = useStore.getState().accounts;
    for (const line of voucherData.lines) {
      const acc = accounts.find((a) => a.id === line.accountId);
      if (acc && acc.level !== AccountLevel.LEDGER) {
        toast.error("Cannot post to group accounts. Please select a ledger account.");
        throw new Error("Cannot post to group accounts. Please select a ledger account.");
      }
    }
    return originalAddVoucher(voucherData);
  },
  updateVoucher: async (id, updates) => {
    const accounts = useStore.getState().accounts;
    if (updates.lines) {
      for (const line of updates.lines) {
        const acc = accounts.find((a) => a.id === line.accountId);
        if (acc && acc.level !== AccountLevel.LEDGER) {
          toast.error("Cannot post to group accounts. Please select a ledger account.");
          throw new Error("Cannot post to group accounts. Please select a ledger account.");
        }
      }
    }
    return originalUpdateVoucher(id, updates);
  },
});

interface TreeNode {
  id: string; // virtual root like "root-asset" or database account ID
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

interface ImportRow {
  code: string;
  name: string;
  type: string;
  group: string;
  openingBalance: number;
  openingBalanceType: string;
  errors: string[];
}

const ChartOfAccounts: React.FC = () => {
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

  // New Filters states
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterGroup, setFilterGroup] = useState<string>("ALL");
  const [filterActive, setFilterActive] = useState<string>("ALL");

  // Import Preview states
  const [importPreviewRows, setImportPreviewRows] = useState<ImportRow[]>([]);

  // Merge modal states
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");

  // Collapse controller
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "root-asset": true,
    "root-liability": true,
    "root-equity": true,
    "root-income": true,
    "root-expense": true,
  });

  // Bulk execution states
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Account Detail right-side drawer
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  // Modals controllers
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

  // Seed predefined groups on mount if they do not exist
  useEffect(() => {
    if (!isDbReady || accounts.length === 0) return;

    const predefinedGroups = [
      // Assets
      { name: "Fixed Assets", type: AccountType.ASSET },
      { name: "Current Assets", type: AccountType.ASSET },
      { name: "Loans & Advances (Asset)", type: AccountType.ASSET },
      { name: "Misc. Expenses (Asset)", type: AccountType.ASSET },
      // Liabilities
      { name: "Capital Account", type: AccountType.LIABILITY },
      { name: "Loans (Liability)", type: AccountType.LIABILITY },
      { name: "Current Liabilities", type: AccountType.LIABILITY },
      { name: "Provisions", type: AccountType.LIABILITY },
      // Income
      { name: "Sales Accounts", type: AccountType.INCOME },
      { name: "Other Income", type: AccountType.INCOME },
      // Expenses
      { name: "Purchase Accounts", type: AccountType.EXPENSE },
      { name: "Direct Expenses", type: AccountType.EXPENSE },
      { name: "Indirect Expenses", type: AccountType.EXPENSE },
    ];

    const checkAndSeed = async () => {
      let seededAny = false;
      for (const group of predefinedGroups) {
        const exists = accounts.some((a) => a.name.toLowerCase() === group.name.toLowerCase());
        if (!exists) {
          const baseCodes: Record<AccountType, string> = {
            [AccountType.ASSET]: "1000",
            [AccountType.LIABILITY]: "3000",
            [AccountType.EQUITY]: "2000",
            [AccountType.INCOME]: "4000",
            [AccountType.EXPENSE]: "5000",
          };
          const base = baseCodes[group.type] || "1000";
          const typeAccounts = accounts.filter((a) => a.type === group.type && !a.parentId);
          let codeStr = base;
          if (typeAccounts.length > 0) {
            const maxCode = Math.max(...typeAccounts.map((a) => parseInt(a.code) || 0));
            if (!isNaN(maxCode) && maxCode > 0) {
              codeStr = String(maxCode + 100);
            }
          }

          await addAccount({
            code: codeStr,
            name: group.name,
            type: group.type,
            level: AccountLevel.GROUP,
            isGroup: true,
            isActive: true,
            openingBalance: 0,
            openingBalanceDr: 0,
            openingBalanceCr: 0,
            openingBalanceDate:
              currentFiscalYear?.startDate || new Date().toISOString().split("T")[0],
          });
          seededAny = true;
        }
      }
      if (seededAny) {
        toast.success("Predefined account groups seeded.");
      }
    };

    checkAndSeed();
  }, [accounts, isDbReady]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. DYNAMIC ACCOUNT LEVEL PROPAGATION HELPERS
  const handleParentIdChange = (parentAcctId: string) => {
    setParentId(parentAcctId);
    if (!parentAcctId) {
      setLevel(AccountLevel.GROUP);
      setIsGroup(true);
      // Auto-suggest blank parent code
      suggestNextCode(undefined);
      return;
    }

    const parentAcc = accounts.find((a) => a.id === parentAcctId);
    if (parentAcc) {
      setType(parentAcc.type);

      // Select appropriate level hierarchy automatically based on parent
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

  // 2. SMART AUTOMATIC LEDGER CODE GENERATION ALGORITHM
  const suggestNextCode = (parentAcc?: Account) => {
    if (!parentAcc) {
      // Suggesting base level categories starting code
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
        setCode(String(maxCode + 100)); // Incremental of 100
      }
      return;
    }

    // Sister accounts having same parent
    const sisterAccounts = accounts.filter((a) => a.parentId === parentAcc.id);
    if (sisterAccounts.length === 0) {
      // Base nested code
      setCode(parentAcc.code + "1");
    } else {
      // Find max sister numeric code
      const maxCode = Math.max(...sisterAccounts.map((a) => parseInt(a.code) || 0));
      if (!isNaN(maxCode) && maxCode > 0) {
        setCode(String(maxCode + 1));
      } else {
        setCode(parentAcc.code + "1");
      }
    }
  };

  // 3. TREE TRAVERSAL DEFINITION ENGINE
  const treeData = useMemo(() => {
    const rootTypes = [
      { type: AccountType.ASSET, name: "Assets", label: "Assets (Debit Nature)" },
      { type: AccountType.LIABILITY, name: "Liabilities", label: "Liabilities (Credit Nature)" },
      { type: AccountType.EQUITY, name: "Equity", label: "Equity (Credit Nature)" },
      { type: AccountType.INCOME, name: "Income", label: "Income (Credit Nature)" },
      { type: AccountType.EXPENSE, name: "Expenses", label: "Expenses (Debit Nature)" },
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
            (pId === undefined ? !a.parentId || !accountMap.has(a.parentId) : a.parentId === pId),
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
      // Root virtual node rollup balance
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

  // Expand collapse nodes
  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
      if (acc.isGroup) {
        nextStates[acc.id] = true;
      }
    });
    setExpandedNodes(nextStates);
    toast.success("All chart groups fully expanded.");
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

  // Convert Tree structure to flattened row elements for easy rendering
  const flattenedRows = useMemo(() => {
    const list: TreeNode[] = [];

    const visit = (node: TreeNode) => {
      // Skip if root categories do not match active selection filter tab
      if (activeTab !== "ALL" && node.depth === 0 && node.type !== activeTab) {
        return;
      }

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

  // Flat Search matches flat representation
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

  // 4. LEDGER BALANCES COLOR & DISPLAY HELPERS
  const formatDrCrBalance = (balance: number, type: AccountType) => {
    const absVal = Math.abs(balance);
    if (absVal === 0) return "Rs. 0.00";

    const isDr = balance >= 0 ? isDebitNature(type) : !isDebitNature(type);
    const suffix = isDr ? "Dr" : "Cr";
    return `Rs. ${formatNumber(absVal)} ${suffix}`;
  };

  const getAccountGroupColor = (type: AccountType) => {
    switch (type) {
      case AccountType.ASSET:
        return "text-blue-700 bg-blue-50/20 border-blue-100 hover:bg-blue-50/50";
      case AccountType.LIABILITY:
        return "text-red-700 bg-red-50/20 border-red-100 hover:bg-red-50/50";
      case AccountType.EQUITY:
        return "text-purple-700 bg-purple-50/20 border-purple-100 hover:bg-purple-50/50";
      case AccountType.INCOME:
        return "text-emerald-700 bg-emerald-50/20 border-emerald-100 hover:bg-emerald-50/50";
      case AccountType.EXPENSE:
        return "text-amber-700 bg-amber-50/20 border-amber-100 hover:bg-amber-50/50";
      default:
        return "text-gray-700 bg-gray-50 border-gray-100";
    }
  };

  // 5. DETAIL DRAWER TRANSACTIONS SUMMARIES (RIGHT PANEL)
  const detailPanelData = useMemo(() => {
    if (!selectedNode || selectedNode.level === "root") return null;
    const acctId = selectedNode.id;

    // Filter relevant double entry posted lines
    const ledgerLines = vouchers
      .filter((v) => v.status === "posted")
      .flatMap((v) => v.lines.map((line) => ({ ...line, date: v.date, voucherNo: v.voucherNo })))
      .filter((line) => line.accountId === acctId);

    // Dynamic metrics computation
    const transactionsCount = ledgerLines.length;
    const lastTxDate =
      ledgerLines.length > 0
        ? ledgerLines.reduce((max, line) => (line.date > max ? line.date : max), "")
        : "-";

    return {
      transactionsCount,
      lastTxDate,
    };
  }, [selectedNode, vouchers]);

  // 6. SHORTCUT LISTENERS EFFECT (Ctrl+N, Ctrl+E, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard to prevent triggering while typing inside input forms
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

  // 7. ACCOUNT CRUD DISPATCH HANDLERS
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
    setOpeningBalanceDate("2026-04-14");
    setAddModalOpen(true);
  };

  const handleOpenEditModal = (acc: any) => {
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
    setOpeningBalanceDate(acc.openingBalanceDate || "2026-04-14");
    setEditModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Ledger Title can not be blank.");
      return;
    }
    if (!code.trim()) {
      toast.error("Unique Code mapping required.");
      return;
    }

    // Unique code validation
    const codeMatch = accounts.find((a) => a.code === code.trim());
    if (codeMatch) {
      toast.error(`Code conflict: mapping '${code}' already assigned to ${codeMatch.name}.`);
      return;
    }

    // Tree hierarchy validation
    if (level === AccountLevel.GROUP) {
      if (parentId) {
        toast.error("Level 1 Group cannot have a parent.");
        return;
      }
    } else if (level === AccountLevel.SUBGROUP) {
      if (!parentId) {
        toast.error("Level 2 Sub-Group must have a parent.");
        return;
      }
      const parentAcc = accounts.find((a) => a.id === parentId);
      if (!parentAcc || parentAcc.level !== AccountLevel.GROUP) {
        toast.error("Level 2 Sub-Group parent must be a Level 1 Group.");
        return;
      }
    } else if (level === AccountLevel.LEDGER) {
      if (!parentId) {
        toast.error("Level 3 Ledger must have a parent.");
        return;
      }
      const parentAcc = accounts.find((a) => a.id === parentId);
      if (!parentAcc || parentAcc.level !== AccountLevel.SUBGROUP) {
        toast.error("Level 3 Ledger parent must be a Level 2 Sub-Group.");
        return;
      }
    } else {
      toast.error(
        "Invalid account level selection. Only Group (Level 1), Sub-Group (Level 2), and Ledger (Level 3) are supported.",
      );
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
        openingBalanceDate: openingBalanceDate || "2026-04-14",
      };

      await addAccount(payload);
      toast.success(`Account ledger '${name}' generated.`);
      setAddModalOpen(false);

      // Update selected detail
      setSelectedNode(null);
    } catch (err: any) {
      toast.error(err.message || "Error occurred while saving account.");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode || !selectedNode.rowObject) return;
    const accId = selectedNode.rowObject.id;

    if (!name.trim()) {
      toast.error("Ledger name can not be empty.");
      return;
    }

    const codeMatch = accounts.find((a) => a.code === code.trim() && a.id !== accId);
    if (codeMatch) {
      toast.error(`Code conflict: mapping '${code}' already belongs to ${codeMatch.name}.`);
      return;
    }

    // Tree hierarchy validation
    if (level === AccountLevel.GROUP) {
      if (parentId) {
        toast.error("Level 1 Group cannot have a parent.");
        return;
      }
    } else if (level === AccountLevel.SUBGROUP) {
      if (!parentId) {
        toast.error("Level 2 Sub-Group must have a parent.");
        return;
      }
      const parentAcc = accounts.find((a) => a.id === parentId);
      if (!parentAcc || parentAcc.level !== AccountLevel.GROUP) {
        toast.error("Level 2 Sub-Group parent must be a Level 1 Group.");
        return;
      }
    } else if (level === AccountLevel.LEDGER) {
      if (!parentId) {
        toast.error("Level 3 Ledger must have a parent.");
        return;
      }
      const parentAcc = accounts.find((a) => a.id === parentId);
      if (!parentAcc || parentAcc.level !== AccountLevel.SUBGROUP) {
        toast.error("Level 3 Ledger parent must be a Level 2 Sub-Group.");
        return;
      }
    } else {
      toast.error(
        "Invalid account level selection. Only Group (Level 1), Sub-Group (Level 2), and Ledger (Level 3) are supported.",
      );
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
        openingBalanceDate: openingBalanceDate || "2026-04-14",
      };

      await updateAccount(accId, updates);
      toast.success(`Ledger '${name}' edited successfully.`);
      setEditModalOpen(false);

      // Sync detailed display panel
      setSelectedNode(null);
    } catch (err: any) {
      toast.error(err.message || "Failed saving ledger params.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteAccount) return;
    try {
      const res = await deleteAccount(confirmDeleteAccount.id);
      if (res) {
        toast.success(`Account ledger '${confirmDeleteAccount.name}' deleted.`);
        setConfirmDeleteAccount(null);
        setSelectedNode(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Deletion failed. Verify ledger dependencies are clean.");
    }
  };

  // 8. EXPORTS & IMPORTS HANDLERS
  const handleExportToExcel = () => {
    const headers = [
      "Account Code",
      "Account Name (English)",
      "Account Name (Nepali)",
      "Type category",
      "Indented Level",
      "Ledger Balance",
      "Status Active",
      "System Account",
    ];

    const rows: any[] = [];

    const visit = (node: TreeNode, indent: string = "") => {
      rows.push([
        node.code || "-",
        indent + node.name,
        node.nameNepali || "",
        node.type.toUpperCase(),
        node.level.toUpperCase(),
        node.balance,
        node.isActive ? "ACTIVE" : "INACTIVE",
        node.isSystemAccount ? "YES" : "NO",
      ]);
      node.children.forEach((c) => visit(c, indent + "  "));
    };

    treeData.forEach((node) => {
      if (activeTab === "ALL" || node.type === activeTab) {
        visit(node);
      }
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Chart Of Accounts");
    XLSX.writeFile(workbook, `COA_Indented_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel ledger hierarchy statement downloaded.");
  };

  const handleDownloadTemplate = () => {
    // Standard headings template
    const headers = [
      "Account_Code",
      "Account_Name_English",
      "Account_Name_Nepali",
      "Category_Type",
      "Hierarchy_Level",
      "Parent_ID_Or_Code",
      "Opening_Balance",
      "Dr_Or_Cr_Balance",
    ];

    const mockRow = [
      "1111",
      "Everest Bank Ledger",
      "एभरेष्ट बैंक खाता",
      "asset",
      "ledger",
      "grp-bank-accounts",
      "75000",
      "Dr",
    ];

    const mockRow2 = [
      "5208",
      "Administrative Stationery Cost",
      "स्टेशनरी खर्च",
      "expense",
      "subledger",
      "acc-office-rent",
      "1200",
      "Dr",
    ];

    const wsData = [headers, mockRow, mockRow2];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "COA Upload Template");
    XLSX.writeFile(wb, "Sutra_COA_Import_Template.csv");
    toast.success("Excel CSV template layout downloaded successfully.");
  };

  const handleImportCSVData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length <= 1) {
          toast.error("Raw document contains no valid csv rows!");
          return;
        }

        // Expected columns: Code, Name, Type, Group, OpeningBalance, OpeningBalanceType (Dr/Cr)
        const headerCells = lines[0]
          .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          .map((c) => c.replace(/^"|"$/g, "").trim().toLowerCase());
        const codeIdx = headerCells.indexOf("code");
        const nameIdx = headerCells.indexOf("name");
        const typeIdx = headerCells.indexOf("type");
        const groupIdx = headerCells.indexOf("group");
        const balIdx = headerCells.indexOf("openingbalance");
        const balTypeIdx = headerCells.findIndex(
          (h) => h.includes("openingbalancetype") || h.includes("dr/cr") || h.includes("type"),
        );

        const rows: ImportRow[] = [];
        const existingCodes = new Set(accounts.map((a) => a.code));
        const seenCodes = new Set<string>();

        for (let i = 1; i < lines.length; i++) {
          const rawCells = lines[i]
            .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
            .map((c) => c.replace(/^"|"$/g, "").trim());
          if (rawCells.length === 0 || !rawCells.join("")) continue;

          const codeVal = codeIdx !== -1 ? rawCells[codeIdx] || "" : rawCells[0] || "";
          const nameVal = nameIdx !== -1 ? rawCells[nameIdx] || "" : rawCells[1] || "";
          const typeVal = typeIdx !== -1 ? rawCells[typeIdx] || "" : rawCells[2] || "";
          const groupVal = groupIdx !== -1 ? rawCells[groupIdx] || "" : rawCells[3] || "";
          const balVal = balIdx !== -1 ? rawCells[balIdx] || "0" : rawCells[4] || "0";
          const balTypeVal = balTypeIdx !== -1 ? rawCells[balTypeIdx] || "Dr" : rawCells[5] || "Dr";

          const oBalance = parseFloat(balVal) || 0;
          const errors: string[] = [];

          if (!codeVal) {
            errors.push("Code is required.");
          } else {
            if (existingCodes.has(codeVal)) {
              errors.push(`Code "${codeVal}" already exists in the database.`);
            }
            if (seenCodes.has(codeVal)) {
              errors.push(`Duplicate code "${codeVal}" in CSV.`);
            }
            seenCodes.add(codeVal);
          }

          if (!nameVal) {
            errors.push("Name is required.");
          }

          const lowerType = typeVal.toLowerCase();
          const validTypes = ["asset", "liability", "equity", "income", "expense"];
          if (!typeVal) {
            errors.push("Type is required.");
          } else if (!validTypes.includes(lowerType)) {
            errors.push(
              `Invalid type "${typeVal}". Must be Asset, Liability, Equity, Income, or Expense.`,
            );
          }

          if (groupVal) {
            const parent = accounts.find(
              (a) => a.name.toLowerCase() === groupVal.toLowerCase() || a.code === groupVal,
            );
            if (!parent) {
              errors.push(`Parent group "${groupVal}" not found.`);
            } else if (!parent.isGroup) {
              errors.push(`Parent "${groupVal}" is a ledger, not a group.`);
            }
          }

          if (isNaN(oBalance) || oBalance < 0) {
            errors.push("Opening balance must be a non-negative number.");
          }

          const lowerBalType = balTypeVal.toLowerCase();
          if (oBalance > 0 && !["dr", "cr"].includes(lowerBalType)) {
            errors.push("Balance type must be Dr or Cr.");
          }

          rows.push({
            code: codeVal,
            name: nameVal,
            type: lowerType,
            group: groupVal,
            openingBalance: oBalance,
            openingBalanceType: lowerBalType === "cr" ? "Cr" : "Dr",
            errors,
          });
        }

        setImportPreviewRows(rows);
      } catch (err: any) {
        toast.error(`Failed to parse CSV: ${err.message}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confirmCSVImport = async () => {
    if (importPreviewRows.length === 0) return;
    const hasErrors = importPreviewRows.some((r) => r.errors.length > 0);
    if (hasErrors) {
      toast.error("Please fix the errors in your CSV file before importing.");
      return;
    }

    try {
      let importedCount = 0;
      for (const row of importPreviewRows) {
        let resolvedParentId: string | undefined = undefined;
        let resolvedLevel = AccountLevel.GROUP;
        let isGroupVal = true;

        if (row.group) {
          const parentDef = accounts.find(
            (a) => a.name.toLowerCase() === row.group.toLowerCase() || a.code === row.group,
          );
          if (parentDef) {
            resolvedParentId = parentDef.id;
            if (parentDef.level === AccountLevel.GROUP) {
              resolvedLevel = AccountLevel.SUBGROUP;
              isGroupVal = true;
            } else if (parentDef.level === AccountLevel.SUBGROUP) {
              resolvedLevel = AccountLevel.LEDGER;
              isGroupVal = false;
            }
          }
        }

        await addAccount({
          code: row.code,
          name: row.name,
          type: row.type as AccountType,
          level: resolvedLevel,
          parentId: resolvedParentId,
          isActive: true,
          isGroup: isGroupVal,
          openingBalance: row.openingBalance,
          openingBalanceDr: row.openingBalanceType === "Dr" ? row.openingBalance : 0,
          openingBalanceCr: row.openingBalanceType === "Cr" ? row.openingBalance : 0,
          openingBalanceDate: currentFiscalYear?.startDate || "2026-04-14",
        });
        importedCount++;
      }

      toast.success(`Successfully imported ${importedCount} accounts.`);
      setImportModalOpen(false);
      setImportPreviewRows([]);
    } catch (err: any) {
      toast.error(`Import failed: ${err.message || "Unknown error"}`);
    }
  };

  const handleMergeAccounts = async () => {
    if (!mergeSourceId || !mergeTargetId) {
      toast.error("Please select both source and target accounts.");
      return;
    }
    if (mergeSourceId === mergeTargetId) {
      toast.error("Source and target accounts cannot be the same.");
      return;
    }

    const sourceAcc = accounts.find((a) => a.id === mergeSourceId);
    const targetAcc = accounts.find((a) => a.id === mergeTargetId);

    if (!sourceAcc || !targetAcc) {
      toast.error("Selected account(s) not found.");
      return;
    }

    if (sourceAcc.type !== targetAcc.type) {
      toast.error("Both accounts must be of the same type.");
      return;
    }

    if (sourceAcc.level !== AccountLevel.LEDGER || targetAcc.level !== AccountLevel.LEDGER) {
      toast.error("Account merge is only allowed for Level 3 Ledger accounts.");
      return;
    }

    try {
      const db = getDB();
      const allVouchers = await db.vouchers.toArray();
      let updateCount = 0;

      await db.transaction("rw", db.vouchers, db.accounts, async () => {
        for (const voucher of allVouchers) {
          let lineChanged = false;
          const updatedLines = voucher.lines.map((line) => {
            if (line.accountId === mergeSourceId) {
              lineChanged = true;
              return { ...line, accountId: mergeTargetId };
            }
            return line;
          });

          if (lineChanged) {
            await db.vouchers.update(voucher.id, { lines: updatedLines });
            updateCount++;
          }
        }

        // Mark source as inactive
        await db.accounts.update(mergeSourceId, { isActive: false });
      });

      // Reload/Sync the store
      await useStore.getState().initializeApp();
      toast.success(
        `Merged successfully. Transferred entries in ${updateCount} vouchers. Source account "${sourceAcc.name}" marked as inactive.`,
      );
      setMergeModalOpen(false);
      setMergeSourceId("");
      setMergeTargetId("");
    } catch (err: any) {
      toast.error(`Merge failed: ${err.message || "Unknown error"}`);
    }
  };

  // 9. BULK ACTIONS ACTIVATE/DEACTIVATE
  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getActiveSelectedList = () => {
    return Object.keys(selectedIds).filter((id) => selectedIds[id]);
  };

  const selectAllFlattened = () => {
    const list = getActiveSelectedList();
    if (list.length === flattenedRows.length) {
      setSelectedIds({});
    } else {
      const dict: Record<string, boolean> = {};
      flattenedRows.forEach((row) => {
        if (!row.id.startsWith("root-")) {
          dict[row.id] = true;
        }
      });
      setSelectedIds(dict);
    }
  };

  const handleBulkDeactivate = async () => {
    const list = getActiveSelectedList();
    if (list.length === 0) return;
    try {
      const load = toast.loading(`Deactivating ${list.length} selected accounts...`);
      for (const id of list) {
        // System accounts should not be toggled
        const acc = accounts.find((a) => a.id === id);
        if (acc && !acc.isSystemAccount) {
          await updateAccount(id, { isActive: false });
        }
      }
      toast.dismiss(load);
      toast.success(`${list.length} accounts processed successfully.`);
      setSelectedIds({});
    } catch (e: any) {
      toast.error("Bulk deactivation process encountered an error.");
    }
  };

  const handleBulkActivate = async () => {
    const list = getActiveSelectedList();
    if (list.length === 0) return;
    try {
      const load = toast.loading(`Activating ${list.length} selected accounts...`);
      for (const id of list) {
        const acc = accounts.find((a) => a.id === id);
        if (acc) {
          await updateAccount(id, { isActive: true });
        }
      }
      toast.dismiss(load);
      toast.success(`${list.length} accounts processed successfully.`);
      setSelectedIds({});
    } catch (e: any) {
      toast.error("Bulk activation process encountered an error.");
    }
  };

  // 10. CONDITIONAL RENDERING ON FLAT SEARCH VS TREE OR FILTERS
  const isFilterActive = useMemo(() => {
    return (
      searchTerm.trim().length > 0 ||
      filterType !== "ALL" ||
      filterGroup !== "ALL" ||
      filterActive !== "ALL"
    );
  }, [searchTerm, filterType, filterGroup, filterActive]);

  const searchAndFilteredResults = useMemo(() => {
    let result = accounts;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (acc) =>
          acc.name.toLowerCase().includes(q) ||
          acc.code.includes(q) ||
          (acc.nameNepali && acc.nameNepali.includes(q)),
      );
    }

    if (filterType !== "ALL") {
      result = result.filter((acc) => acc.type === filterType);
    }

    if (filterGroup !== "ALL") {
      result = result.filter((acc) => acc.parentId === filterGroup);
    }

    if (filterActive !== "ALL") {
      const wantActive = filterActive === "ACTIVE";
      result = result.filter((acc) => acc.isActive === wantActive);
    }

    return result;
  }, [accounts, searchTerm, filterType, filterGroup, filterActive]);

  const filteredAccounts = useMemo(() => {
    return isFilterActive ? searchAndFilteredResults : flattenedRows;
  }, [isFilterActive, searchAndFilteredResults, flattenedRows]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAccounts.slice(start, start + pageSize);
  }, [filteredAccounts, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterType, filterGroup, filterActive]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none pb-12">
      <div className="no-print">
        <ActionToolbar
          title="Chart of Accounts"
          subtitle="Manage your account hierarchy and ledgers"
          primaryAction={{
            label: "Add Account",
            onClick: handleOpenCreateModal,
            icon: <Plus className="h-4 w-4" />,
          }}
          secondaryActions={[
            { label: "Expand All Groups", onClick: expandAll },
            { label: "Collapse All", onClick: collapseAll },
            {
              label: "Merge Accounts",
              onClick: () => setMergeModalOpen(true),
              icon: <RefreshCw className="h-3.5 w-3.5" />,
            },
            {
              label: "Print",
              onClick: handlePrint,
              icon: <Printer className="h-3.5 w-3.5" />,
            },
            {
              label: "Import from CSV",
              onClick: () => {
                setImportPreviewRows([]);
                setImportModalOpen(true);
              },
              icon: <Upload className="h-3.5 w-3.5" />,
            },
            {
              label: "Export Sheet",
              onClick: handleExportToExcel,
              icon: <Download className="h-3.5 w-3.5" />,
            },
          ]}
        />
      </div>

      {/* 2. LIVE FILTER CONTROLS TABS */}
      <div className="page-toolbar no-print flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="page-toolbar-left flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search accounts..."
              className="search-input"
            />
          </div>

          {/* Type Filter Dropdown */}
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setActiveTab(e.target.value as any);
            }}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          >
            <option value="ALL">All Types</option>
            <option value={AccountType.ASSET}>Asset</option>
            <option value={AccountType.LIABILITY}>Liability</option>
            <option value={AccountType.EQUITY}>Equity</option>
            <option value={AccountType.INCOME}>Income</option>
            <option value={AccountType.EXPENSE}>Expense</option>
          </select>

          {/* Group Filter Dropdown */}
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          >
            <option value="ALL">All Groups</option>
            {accounts
              .filter((a) => a.isGroup)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.code})
                </option>
              ))}
          </select>

          {/* Active status Filter Dropdown */}
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <div className="flex items-center gap-1 ml-2">
            {(["ALL", "asset", "liability", "equity", "income", "expense"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab as any);
                  setFilterType(tab as any);
                }}
                className={`h-7 px-2.5 text-[11px] font-semibold rounded transition-colors ${activeTab === tab ? "bg-[#1557b0] text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
              >
                {tab === "ALL" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="page-toolbar-right ml-auto">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="h-8 px-3 text-[11px] font-bold rounded-md text-white bg-[#1557b0] hover:bg-[#0f4a96] flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> New Account
          </button>
        </div>
      </div>

      {/* KEYBOARD SHORTCUTS LEGEND STRIP */}
      <div className="flex items-center gap-6 bg-slate-50 border border-slate-100 rounded-lg px-4.5 py-2 text-[10.5px] font-bold text-gray-400">
        <span className="flex items-center gap-1.5 uppercase tracking-wider text-slate-500 font-extrabold shrink-0">
          <Keyboard className="h-4 w-4 text-slate-400" /> SYSTEM HOTKEYS:
        </span>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <span>
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] shadow-sm font-mono font-bold mr-1">
              Ctrl+N
            </kbd>{" "}
            New Account
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] shadow-sm font-mono font-bold mr-1">
              Ctrl+E
            </kbd>{" "}
            Edit Selected
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] shadow-sm font-mono font-bold mr-1">
              Delete
            </kbd>{" "}
            Remove Selected
          </span>
        </div>
      </div>

      {/* 3. MAIN CONTENTS PANELS SPLIT VIEW */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Tree view table */}
        <div className="flex-1 w-full flex flex-col gap-4">
          <Card border padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead className="bg-[#f5f6fa] border-b border-gray-200">
                  <tr className="select-none">
                    {/* Checkbox column */}
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase text-center w-12">
                      <button
                        type="button"
                        onClick={selectAllFlattened}
                        className="text-gray-500 hover:text-slate-800 cursor-pointer"
                        title="Toggle select all"
                      >
                        {getActiveSelectedList().length === flattenedRows.length &&
                        flattenedRows.length > 0 ? (
                          <CheckSquare className="h-[18px] w-[18px] text-blue-600" />
                        ) : (
                          <Square className="h-[18px] w-[18px]" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase w-28">
                      Code
                    </th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">
                      Account Head Particulars
                    </th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">
                      Classification
                    </th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">
                      Group
                    </th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">
                      Level
                    </th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase text-right w-36 th-right">
                      Rolled Book Balance
                    </th>
                    <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase text-center w-20">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {/* FLAT SEARCH VIEW */}
                  {isFilterActive ||
                  filterType !== "ALL" ||
                  filterGroup !== "ALL" ||
                  filterActive !== "ALL" ? (
                    paginatedData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-center py-12 text-gray-400 font-bold text-xs"
                        >
                          No accounting ledger records matched your query. Try searching by other
                          names.
                        </td>
                      </tr>
                    ) : (
                      (paginatedData as Account[]).map((row) => {
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
                            className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${selectedNode?.id === row.id ? "bg-blue-50/20" : ""}`}
                          >
                            <td
                              className="p-3 text-center"
                              onClick={(e) => handleToggleSelectRow(row.id, e)}
                            >
                              {isSelected ? (
                                <CheckSquare className="h-[18px] w-[18px] text-blue-600" />
                              ) : (
                                <Square className="h-[18px] w-[18px] text-gray-300 hover:text-gray-400" />
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-900 leading-none">
                              {row.code}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-extrabold text-slate-800 leading-tight flex items-center gap-1.5">
                                  {row.name}
                                  {!row.isActive && (
                                    <span className="scale-90 inline-block">
                                      <Badge variant="danger">INACTIVE</Badge>
                                    </span>
                                  )}
                                  {row.isSystemAccount && (
                                    <span title="System Locked ledger parameter">
                                      <Lock className="h-3 w-3 text-amber-500" />
                                    </span>
                                  )}
                                </span>
                                {row.nameNepali && (
                                  <span className="text-[10px] text-gray-400 font-bold mt-0.5">
                                    {row.nameNepali}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border tracking-wider ${getAccountGroupColor(row.type).split(" ")[0]} ${getAccountGroupColor(row.type).split(" ")[1]} ${getAccountGroupColor(row.type).split(" ")[2]}`}
                              >
                                {row.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {accounts.find((a) => a.id === row.parentId)?.name || "-"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] uppercase font-bold text-gray-400 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 leading-none">
                                {row.level}
                              </span>
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-mono font-extrabold text-slate-800 amt ${row.balance >= 0 ? "amt-dr" : "amt-cr"}`}
                            >
                              {formatDrCrBalance(row.balance || 0, row.type)}
                            </td>
                            <td
                              className="px-4 py-3 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenEditModal(row)}
                                  className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition"
                                  title="Edit properties"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                {!row.isSystemAccount && (
                                  <button
                                    onClick={() => setConfirmDeleteAccount(row)}
                                    className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-red-500 transition"
                                    title="Delete account ledger"
                                  >
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
                    /* HIERARCHICAL TREE VIEW */
                    (paginatedData as TreeNode[]).map((row) => {
                      const isVirtualRoot = row.level === "root";
                      const isSelected = !!selectedIds[row.id];
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedNode(row)}
                          className={`hover:bg-slate-50/40 cursor-pointer transition-colors
                            ${selectedNode?.id === row.id ? "bg-blue-50/25" : ""}
                            ${isVirtualRoot ? "bg-slate-50/40 font-bold tracking-tight text-slate-900 border-l-[3.5px] border-slate-700" : ""}
                          `}
                        >
                          {/* Selection Checkbox */}
                          <td
                            className="p-3 text-center"
                            onClick={(e) => {
                              if (isVirtualRoot) return;
                              handleToggleSelectRow(row.id, e);
                            }}
                          >
                            {!isVirtualRoot &&
                              (isSelected ? (
                                <CheckSquare className="h-[18px] w-[18px] text-blue-600" />
                              ) : (
                                <Square className="h-[18px] w-[18px] text-gray-300 hover:text-gray-400" />
                              ))}
                          </td>

                          {/* Code */}
                          <td className="px-4 py-3.5 font-mono font-bold text-slate-900 leading-none">
                            {row.code || "-"}
                          </td>

                          {/* Name with indentation depths */}
                          <td className="px-4 py-3.5">
                            <div
                              className="flex items-center gap-1 text-xs"
                              style={{ paddingLeft: `${row.depth * 16 + 12}px` }}
                            >
                              {row.isGroup ? (
                                <button
                                  type="button"
                                  onClick={(e) => toggleExpand(row.id, e)}
                                  className="p-1 rounded hover:bg-slate-200/50 text-gray-400 hover:text-gray-650 transition cursor-pointer"
                                  title={expandedNodes[row.id] ? "Collapse group" : "Expand group"}
                                >
                                  {expandedNodes[row.id] ? (
                                    <ChevronDown className="h-3.8 w-3.8" />
                                  ) : (
                                    <ChevronRight className="h-3.8 w-3.8" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-5.5 h-1"></span>
                              )}

                              <div className="flex flex-col leading-none">
                                <span
                                  className={`flex items-center gap-1.5 ${isVirtualRoot ? "font-bold text-sm text-slate-800 uppercase" : "font-extrabold text-slate-800"}`}
                                >
                                  {row.name}
                                  {!row.isActive && (
                                    <span className="scale-90 inline-block">
                                      <Badge variant="danger">INACTIVE</Badge>
                                    </span>
                                  )}
                                  {row.isSystemAccount && (
                                    <span title="System Locked ledger parameter">
                                      <Lock className="h-3 w-3 text-amber-500" />
                                    </span>
                                  )}
                                </span>
                                {row.nameNepali && (
                                  <span className="text-[10px] text-gray-500 font-bold mt-0.5">
                                    {row.nameNepali}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Classification type badges */}
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border tracking-wider ${getAccountGroupColor(row.type).split(" ")[0]} ${getAccountGroupColor(row.type).split(" ")[1]} ${getAccountGroupColor(row.type).split(" ")[2]}`}
                            >
                              {row.type}
                            </span>
                          </td>

                          {/* Group name column */}
                          <td className="px-4 py-3.5 text-xs text-gray-600">
                            {accounts.find((a) => a.id === row.parentId)?.name || "-"}
                          </td>

                          {/* Level indicator */}
                          <td className="px-4 py-3.5">
                            <span className="text-[10px] uppercase font-bold text-gray-400 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 leading-none">
                              {row.level}
                            </span>
                          </td>

                          {/* Account Balance Dr/Cr */}
                          <td
                            className={`px-4 py-3.5 text-right font-mono font-extrabold text-slate-800 amt ${row.balance >= 0 ? "amt-dr" : "amt-cr"}`}
                          >
                            {formatDrCrBalance(row.balance, row.type)}
                          </td>

                          {/* Manual modifiers */}
                          <td
                            className="px-4 py-3.5 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {!isVirtualRoot && (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenEditModal(row.rowObject)}
                                  className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition"
                                  title="Edit parameters"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                {!row.isSystemAccount && (
                                  <button
                                    onClick={() => setConfirmDeleteAccount(row.rowObject || null)}
                                    className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-red-500 transition"
                                    title="Delete ledger"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
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
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          </Card>

          {/* Sticky Checkbox multi actions bar */}
          {getActiveSelectedList().length > 0 && (
            <div className="sticky bottom-4 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-800 p-4.5 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-xs">
                <CheckSquare className="h-5 w-5 text-blue-400 animate-pulse" />
                <span className="font-extrabold text-sm">
                  {getActiveSelectedList().length} Accounts selected for bulk modifications
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds({})}
                  className="bg-transparent text-gray-300 border-gray-700 hover:bg-gray-800 text-xs font-bold"
                >
                  Clear Selection
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDeactivate}
                  className="bg-transparent text-rose-400 border-rose-900/60 hover:bg-rose-900/20 text-xs font-bold"
                >
                  Deactivate Selected
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleBulkActivate}
                  className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 hover:border-emerald-700 text-xs font-bold"
                >
                  Activate Selected
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 4. Right side account detail display card panel */}
        {selectedNode && selectedNode.level !== "root" && (
          <div className="w-full lg:w-80 shrink-0 sticky top-6">
            <Card
              title="Ledger Summary Portfolio"
              subtitle="Analytical insights of accounting head"
              border
              action={
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-slate-800 text-[11px] font-bold border rounded px-1.5 py-0.5 leading-none"
                >
                  Close Panel
                </button>
              }
            >
              <div className="flex flex-col gap-5 text-xs select-none">
                <div className="pb-3 border-b border-gray-100 flex flex-col gap-1.5">
                  <span className="text-[10px] text-gray-405 font-bold uppercase tracking-wider block">
                    Ledger Particulars
                  </span>
                  <p className="text-sm font-bold text-slate-800 leading-tight">
                    {selectedNode.name}
                  </p>
                  {selectedNode.nameNepali && (
                    <p className="text-xs text-slate-400 font-bold mt-0.5">
                      {selectedNode.nameNepali}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-mono font-bold text-[10.5px] bg-slate-100 text-slate-650 px-1.5 py-0.5 rounded border border-gray-200">
                      CODE: {selectedNode.code}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-gray-500 bg-slate-50 border px-2 py-0.5 rounded leading-none">
                      {selectedNode.level}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 border border-gray-200 rounded-lg flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block leading-none">
                      Account Type
                    </span>
                    <span className="text-xs text-slate-700 font-extrabold mt-1 block uppercase">
                      {selectedNode.type}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-gray-200 rounded-lg flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block leading-none">
                      Record Status
                    </span>
                    <span
                      className={`text-[10.5px] font-bold mt-1.5 leading-none inline-flex items-center gap-1 ${selectedNode.isActive ? "text-emerald-600" : "text-rose-500"}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full inline-block ${selectedNode.isActive ? "bg-emerald-500" : "bg-rose-500"}`}
                      ></span>
                      {selectedNode.isActive ? "ACTIVE" : "DEACTIVATED"}
                    </span>
                  </div>
                </div>

                {/* Rolled Book Balance */}
                <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 font-mono">
                  <span className="text-[10px] text-slate-405 uppercase font-sans tracking-widest font-bold block leading-none mb-2">
                    Aggregate ledger balance
                  </span>
                  <span className="text-base font-bold tracking-tight leading-none text-blue-400">
                    {formatDrCrBalance(selectedNode.balance, selectedNode.type)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans block mt-2 font-bold uppercase tracking-wider leading-none">
                    Calculated from double-entry posted ledgers
                  </span>
                </div>

                {/* Summary Metrics */}
                {detailPanelData && (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 font-bold">
                      <span className="text-gray-500">Voucher Journal postings:</span>
                      <span className="text-slate-800 font-mono shrink-0">
                        {detailPanelData.transactionsCount} lines
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-gray-100 font-bold">
                      <span className="text-gray-500">Last transactional date:</span>
                      <span className="text-slate-800 shrink-0">{detailPanelData.lastTxDate}</span>
                    </div>
                  </div>
                )}

                {/* Operations links shortcuts */}
                <div className="flex flex-col gap-2 mt-3 border-t border-gray-105 pt-4">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                    Analytical Navigations
                  </span>

                  <button
                    onClick={() => {
                      setCurrentPage("reports");
                      setReportFilters({ selectedReport: "trial-balance" });
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-gray-200 rounded-lg hover:bg-slate-100 font-bold text-left flex items-center justify-between text-slate-700 transition"
                  >
                    <span>View Trial Balance Ledger</span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </button>

                  <button
                    onClick={() => {
                      setCurrentPage("vouchers");
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-gray-200 rounded-lg hover:bg-slate-100 font-bold text-left flex items-center justify-between text-slate-700 transition"
                  >
                    <span>Analyze Registered Vouchers</span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* 5. ADD ACCOUNT MODAL */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Generate New Ledger Head master"
        size="md"
        footer={
          <div className="flex justify-end gap-2 text-xs">
            <Button variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddSubmit}>
              Generate master head
            </Button>
          </div>
        }
      >
        <form onSubmit={handleAddSubmit} className="flex flex-col gap-4 text-xs select-none">
          {/* Level selection */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Account Hierarchy Level"
              options={Object.values(AccountLevel).map((v) => ({
                value: v,
                label: v.toUpperCase(),
              }))}
              value={level}
              onChange={(val) => {
                const nextLevel = val as AccountLevel;
                setLevel(nextLevel);
                setIsGroup(["group", "subgroup"].includes(nextLevel));
              }}
              required
            />

            <Select
              label="Accounting Nature"
              options={[
                { value: AccountType.ASSET, label: "🔵 Asset" },
                { value: AccountType.LIABILITY, label: "🔴 Liability" },
                { value: AccountType.EQUITY, label: "🟣 Equity" },
                { value: AccountType.INCOME, label: "🟢 Income" },
                { value: AccountType.EXPENSE, label: "🟡 Expense" },
              ]}
              value={type}
              onChange={(val) => setType(val as AccountType)}
              required
              disabled={!!parentId} // Parent dominates nature
            />
          </div>

          {/* Parent selection */}
          <div className="p-3 bg-slate-100 rounded-lg border border-slate-150 flex flex-col gap-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Parent Account Master Mapping
            </span>
            <Select
              label="Select Parent Group / Sub-group Link"
              options={accounts
                .filter((a) => a.isGroup)
                .map((a) => ({
                  value: a.id,
                  label: `${a.code} - ${a.name} [${a.level.toUpperCase()}]`,
                }))}
              value={parentId}
              onChange={handleParentIdChange}
              placeholder="Root Level Account Category"
              searchable={true}
            />
            {parentId && (
              <p className="text-[10.5px] leading-relaxed text-gray-400 font-bold">
                Level auto adjusted to match hierarchy chain constraints. Nature matches Parent
                dynamically.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Unique Head Code"
              placeholder="e.g. 1151 or 5208"
              value={code}
              onChange={setCode}
              required
            />

            <div className="flex flex-col gap-1 w-full justify-end pb-1.5 font-bold">
              <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mb-2">
                Ledger Status
              </span>
              <label className="inline-flex items-center gap-2 cursor-pointer border border-gray-200 bg-slate-50 rounded-lg p-2 shrink-0">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-700">Account Active & In Use</span>
              </label>
            </div>
          </div>

          <Input
            label="Particluars Title (English Name)"
            placeholder="e.g. Nepal Investment Bank Ltd."
            value={name}
            onChange={setName}
            required
          />

          <Input
            label="वैकल्पिक नेपाली नाम (Particulars Devanagari Translation)"
            placeholder="जस्तै: नेपाल इन्भेष्टमेन्ट बैंक लि."
            value={nameNepali}
            onChange={setNameNepali}
          />

          {/* Opening balance fields (Only for ledgers or subledgers) */}
          {!["group", "subgroup"].includes(level) && (
            <div className="p-3 bg-blue-50/20 border border-blue-100 rounded-lg flex flex-col gap-3.5">
              <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider block">
                Initial Book Balances
              </span>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Opening Balance Sum"
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
                  label="Balance Type"
                  options={[
                    { value: "Dr", label: "Debit (Dr)" },
                    { value: "Cr", label: "Credit (Cr)" },
                  ]}
                  value={openingType}
                  onChange={(v) => {
                    setOpeningType(v as "Dr" | "Cr");
                  }}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Opening Balance Entry Date"
                  type="date"
                  value={openingBalanceDate}
                  onChange={setOpeningBalanceDate}
                />

                {/* Cost Center integration */}
                {companySettings?.enableCostCenter && (
                  <Select
                    label="Mapped Cost Center Division"
                    options={costCenters.map((cc) => ({
                      value: cc.id,
                      label: cc.name,
                    }))}
                    value={costCenterId}
                    onChange={setCostCenterId}
                    placeholder="Non Mapped Cost Center"
                  />
                )}
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* 6. EDIT ACCOUNT MODAL */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Modify Ledger Master head schema"
        size="md"
        footer={
          <div className="flex justify-between items-center w-full text-xs">
            {/* Delete button inside edit modal */}
            {selectedNode && selectedNode.rowObject && !selectedNode.rowObject.isSystemAccount ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setConfirmDeleteAccount(selectedNode.rowObject || null);
                  setEditModalOpen(false);
                }}
                className="text-red-650 hover:bg-red-50 border-red-200"
                icon={<Trash2 className="h-3.8 w-3.8" />}
              >
                Delete Account
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleEditSubmit}>
                Save master head changes
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4 text-xs select-none">
          {/* Level selection */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Account Hierarchy Level"
              options={Object.values(AccountLevel).map((v) => ({
                value: v,
                label: v.toUpperCase(),
              }))}
              value={level}
              onChange={(val) => {
                const nextLevel = val as AccountLevel;
                setLevel(nextLevel);
                setIsGroup(["group", "subgroup"].includes(nextLevel));
              }}
              required
            />

            <Select
              label="Accounting Nature"
              options={[
                { value: AccountType.ASSET, label: "🔵 Asset" },
                { value: AccountType.LIABILITY, label: "🔴 Liability" },
                { value: AccountType.EQUITY, label: "🟣 Equity" },
                { value: AccountType.INCOME, label: "🟢 Income" },
                { value: AccountType.EXPENSE, label: "🟡 Expense" },
              ]}
              value={type}
              onChange={(val) => setType(val as AccountType)}
              required
              disabled={!!parentId} // Parent dominates nature
            />
          </div>

          {/* Parent selection */}
          <div className="p-3 bg-slate-100 rounded-lg border border-slate-150 flex flex-col gap-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Parent Account Master Mapping
            </span>
            <Select
              label="Select Parent Group / Sub-group Link"
              options={accounts
                .filter((a) => a.isGroup && (!selectedNode || a.id !== selectedNode.id))
                .map((a) => ({
                  value: a.id,
                  label: `${a.code} - ${a.name} [${a.level.toUpperCase()}]`,
                }))}
              value={parentId}
              onChange={handleParentIdChange}
              placeholder="Root Level Account Category"
              searchable={true}
            />
            {parentId && (
              <p className="text-[10.5px] leading-relaxed text-gray-400 font-bold">
                Level auto adjusted to match parent criteria. Nature matches Parent dynamically.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Unique Head Code"
              placeholder="e.g. 1151 or 5208"
              value={code}
              onChange={setCode}
              required
            />

            <div className="flex flex-col gap-1 w-full justify-end pb-1.5 font-bold">
              <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mb-2">
                Ledger Status
              </span>
              <label className="inline-flex items-center gap-2 cursor-pointer border border-gray-200 bg-slate-50 rounded-lg p-2 shrink-0">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-700">Account Active & In Use</span>
              </label>
            </div>
          </div>

          <Input
            label="Particulars Title (English Name)"
            placeholder="e.g. Nepal Investment Bank Ltd."
            value={name}
            onChange={setName}
            required
          />

          <Input
            label="वैकल्पिक नेपाली नाम (Particulars Devanagari Translation)"
            placeholder="जस्तै: नेपाल इन्भेष्टमेन्ट बैंक लि."
            value={nameNepali}
            onChange={setNameNepali}
          />

          {/* Opening balance fields (Only for ledgers or subledgers) */}
          {!["group", "subgroup"].includes(level) && (
            <div className="p-3 bg-blue-50/20 border border-blue-100 rounded-lg flex flex-col gap-3.5">
              <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider block">
                Initial Book Balances
              </span>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Opening Balance Sum"
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
                  label="Balance Type"
                  options={[
                    { value: "Dr", label: "Debit (Dr)" },
                    { value: "Cr", label: "Credit (Cr)" },
                  ]}
                  value={openingType}
                  onChange={(v) => {
                    setOpeningType(v as "Dr" | "Cr");
                  }}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Opening Balance Entry Date"
                  type="date"
                  value={openingBalanceDate}
                  onChange={setOpeningBalanceDate}
                />

                {/* Cost Center integration */}
                {companySettings?.enableCostCenter && (
                  <Select
                    label="Mapped Cost Center Division"
                    options={costCenters.map((cc) => ({
                      value: cc.id,
                      label: cc.name,
                    }))}
                    value={costCenterId}
                    onChange={setCostCenterId}
                    placeholder="Non Mapped Cost Center"
                  />
                )}
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* 7. IMPORT Master Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Master Chart Accounts"
        size={importPreviewRows.length > 0 ? "lg" : "md"}
        footer={
          <div className="flex justify-end gap-2 text-xs">
            <Button variant="outline" size="sm" onClick={() => setImportModalOpen(false)}>
              Close
            </Button>
            {importPreviewRows.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={confirmCSVImport}
                disabled={importPreviewRows.some((r) => r.errors.length > 0)}
              >
                Confirm Import ({importPreviewRows.filter((r) => r.errors.length === 0).length}{" "}
                valid accounts)
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-5 text-xs select-none">
          {importPreviewRows.length === 0 ? (
            <>
              <p className="leading-relaxed text-gray-500 font-bold">
                We support CSV and direct Spreadsheet column mappings. Please construct your
                Excel/CSV spreadsheet according to our audited structure layout below.
              </p>

              <div className="p-4 bg-slate-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-extrabold text-slate-805">
                    Ready-to-use Import layout template
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Standard columns map correctly formatted format
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  icon={<Download className="h-3.5 w-3.5" />}
                  className="text-xs font-bold"
                >
                  CSV Template
                </Button>
              </div>

              <div className="p-6 border-2 border-dashed border-gray-300 rounded-xl text-center flex flex-col items-center justify-center gap-3 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                  <Upload className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-slate-800 text-sm">
                    Upload spreadsheet documents
                  </span>
                  <span className="text-[10px] text-gray-400 mt-1">
                    Accepts CSV or XLS formatted files
                  </span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs uppercase shadow transition"
                >
                  Select CSV Document
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportCSVData}
                  accept=".csv"
                  className="hidden"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                <span className="font-bold">Total CSV Rows: {importPreviewRows.length}</span>
                <span className="text-red-650 font-bold">
                  Errors Found: {importPreviewRows.filter((r) => r.errors.length > 0).length}
                </span>
                <button
                  onClick={() => setImportPreviewRows([])}
                  className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] font-semibold rounded-md hover:bg-gray-50"
                >
                  Upload Different File
                </button>
              </div>

              {importPreviewRows.filter((r) => r.errors.length > 0).length > 0 && (
                <div className="p-3 bg-rose-50 text-rose-700 rounded-lg border border-rose-200">
                  <strong>Validation Blocked:</strong> Please fix the red highlighted rows in your
                  CSV. You must resolve all issues before you can confirm the import.
                </div>
              )}

              <div className="max-h-96 overflow-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-[#f5f6fa] sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">
                        Code
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">
                        Group
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase">
                        Opening Bal
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">
                        Errors
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 bg-white">
                    {importPreviewRows.map((row, idx) => {
                      const hasErr = row.errors.length > 0;
                      return (
                        <tr
                          key={idx}
                          className={hasErr ? "bg-red-50/50 text-red-900" : "hover:bg-slate-50"}
                        >
                          <td
                            className={`px-3 py-2 font-mono ${hasErr && !row.code ? "bg-red-100 text-red-800" : ""}`}
                          >
                            {row.code || "[Blank]"}
                          </td>
                          <td
                            className={`px-3 py-2 ${hasErr && !row.name ? "bg-red-100 text-red-800" : ""}`}
                          >
                            {row.name || "[Blank]"}
                          </td>
                          <td className="px-3 py-2 uppercase">{row.type}</td>
                          <td className="px-3 py-2">{row.group || "-"}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {formatNumber(row.openingBalance)} {row.openingBalanceType}
                          </td>
                          <td className="px-3 py-2 text-red-600 font-medium">
                            {row.errors.map((err, errIdx) => (
                              <div key={errIdx} className="flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                <span>{err}</span>
                              </div>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Merge Accounts Modal */}
      <Modal
        isOpen={mergeModalOpen}
        onClose={() => setMergeModalOpen(false)}
        title="Merge Ledger Accounts"
        size="md"
        footer={
          <div className="flex justify-end gap-2 text-xs">
            <Button variant="outline" size="sm" onClick={() => setMergeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleMergeAccounts}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Merge Accounts
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 text-xs select-none">
          <p className="leading-relaxed text-gray-550 font-bold">
            Merging transfers all double-entry transaction lines from the Source Account to the
            Target Account. Once the merge finishes, the Source Account is permanently deactivated.
            Both must be level 3 ledger accounts of the same nature type.
          </p>

          <div className="flex flex-col gap-3">
            <label className="text-[11px] font-semibold text-gray-700">
              Select Source Account (To deactivate)
            </label>
            <select
              value={mergeSourceId}
              onChange={(e) => setMergeSourceId(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            >
              <option value="">-- Choose Source Ledger --</option>
              {accounts
                .filter((a) => a.level === AccountLevel.LEDGER && a.isActive)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.code}) - {a.type.toUpperCase()}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-[11px] font-semibold text-gray-700">
              Select Target Account (To merge into)
            </label>
            <select
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            >
              <option value="">-- Choose Target Ledger --</option>
              {accounts
                .filter(
                  (a) =>
                    a.level === AccountLevel.LEDGER &&
                    a.id !== mergeSourceId &&
                    (!mergeSourceId ||
                      a.type === accounts.find((sa) => sa.id === mergeSourceId)?.type),
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.code}) - {a.type.toUpperCase()}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* 8. CONFIRM ACCOUNT DELETION PROMPT */}
      <ConfirmDialog
        isOpen={confirmDeleteAccount !== null}
        onClose={() => setConfirmDeleteAccount(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Account head Master"
        message={`Warning: You are going to completely delete account ledger head '${confirmDeleteAccount?.name}' (${confirmDeleteAccount?.code}). This action is permanent and cannot be undone.`}
        confirmText="Yes, delete master"
        cancelText="No, preserve"
        danger={true}
      />

      {/* Print-only View Layout */}
      <div className="print-only hidden">
        <div className="mb-6 flex justify-between items-end border-b pb-4">
          <div>
            <h1 className="text-[18px] font-bold text-gray-800">SUTRA ERP</h1>
            <p className="text-[11px] text-gray-500">CHART OF ACCOUNTS SUMMARY Hierarchy</p>
          </div>
          <div className="text-right text-[10px] text-gray-400">
            Report Date: {new Date().toISOString().split("T")[0]}
          </div>
        </div>

        <table className="w-full border-collapse border border-gray-300 text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold uppercase">
                Code
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold uppercase">
                Particular Name
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold uppercase">
                Parent Group
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left font-semibold uppercase">
                Classification
              </th>
              <th className="border border-gray-300 px-3 py-2 text-right font-semibold uppercase">
                Current Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts
              .sort((a, b) => a.code.localeCompare(b.code))
              .map((acc) => {
                const parentGroup = accounts.find((p) => p.id === acc.parentId);
                return (
                  <tr key={acc.id} className="even:bg-gray-50/50">
                    <td className="border border-gray-300 px-3 py-2 font-mono">{acc.code}</td>
                    <td className="border border-gray-300 px-3 py-2 font-semibold">{acc.name}</td>
                    <td className="border border-gray-300 px-3 py-2">{parentGroup?.name || "-"}</td>
                    <td className="border border-gray-300 px-3 py-2 uppercase text-[10px]">
                      {acc.type}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-mono">
                      {formatDrCrBalance(acc.balance || 0, acc.type)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ChartOfAccounts;
