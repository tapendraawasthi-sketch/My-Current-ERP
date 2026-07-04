// src/components/ChartOfAccounts.tsx
// Removed @ts-nocheck
/**
 * BUSY-style Chart of Accounts — Complete Implementation
 * Phases 1-13: All 15 predefined groups, Account Group Master,
 * Account Master (all sections), Features/Options, Master Configuration,
 * Sub-Ledgers, Bill-by-Bill, all modes (Add/Modify/Delete/List/View)
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useStore } from "../store";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folder,
  BookOpen,
  Download,
  Upload,
  Copy,
  Settings,
  Save,
  X,
  AlertTriangle,
  Info,
  RefreshCw,
  FileSpreadsheet,
  Eye,
  Lock,
  CheckSquare,
  Square,
  ArrowRight,
  Filter,
  Printer,
  Building,
  CreditCard,
  Users,
  ShoppingCart,
  Package,
  TrendingUp,
  TrendingDown,
  BarChart2,
  PieChart,
  Wallet,
  Landmark,
  Briefcase,
} from "lucide-react";

// ─── 15 PREDEFINED PRIMARY GROUPS (BUSY-style) ───────────────────────────────
const PREDEFINED_GROUPS = [
  // Capital / Equity
  {
    id: "pg-capital",
    name: "Capital Account",
    nature: "credit",
    category: "Capital/Equity",
    sortOrder: 1,
    icon: "Wallet",
    color: "#7c3aed",
    subGroups: [
      { id: "sg-partners-capital", name: "Partners Capital Account", parentId: "pg-capital" },
      { id: "sg-share-capital", name: "Share Capital", parentId: "pg-capital" },
    ],
  },
  {
    id: "pg-reserves",
    name: "Reserves & Surplus",
    nature: "credit",
    category: "Capital/Equity",
    sortOrder: 2,
    icon: "Wallet",
    color: "#7c3aed",
    subGroups: [
      { id: "sg-general-reserve", name: "General Reserve", parentId: "pg-reserves" },
      { id: "sg-retained-earnings", name: "Retained Earnings", parentId: "pg-reserves" },
    ],
  },
  // Liabilities
  {
    id: "pg-loans-liability",
    name: "Loans (Liability)",
    nature: "credit",
    category: "Liabilities",
    sortOrder: 3,
    icon: "Landmark",
    color: "#dc2626",
    subGroups: [
      { id: "sg-secured-loans", name: "Secured Loans", parentId: "pg-loans-liability" },
      { id: "sg-unsecured-loans", name: "Unsecured Loans", parentId: "pg-loans-liability" },
    ],
  },
  {
    id: "pg-current-liability",
    name: "Current Liabilities",
    nature: "credit",
    category: "Liabilities",
    sortOrder: 4,
    icon: "Briefcase",
    color: "#dc2626",
    subGroups: [
      { id: "sg-sundry-creditors", name: "Sundry Creditors", parentId: "pg-current-liability" },
      { id: "sg-duties-taxes", name: "Duties & Taxes", parentId: "pg-current-liability" },
      {
        id: "sg-advances-customers",
        name: "Advances from Customers",
        parentId: "pg-current-liability",
      },
      {
        id: "sg-outstanding-expenses",
        name: "Outstanding Expenses",
        parentId: "pg-current-liability",
      },
    ],
  },
  {
    id: "pg-provisions",
    name: "Provisions",
    nature: "credit",
    category: "Liabilities",
    sortOrder: 5,
    icon: "Briefcase",
    color: "#dc2626",
    subGroups: [
      { id: "sg-provision-tax", name: "Provision for Tax", parentId: "pg-provisions" },
      {
        id: "sg-provision-doubtful",
        name: "Provision for Doubtful Debts",
        parentId: "pg-provisions",
      },
    ],
  },
  // Assets
  {
    id: "pg-fixed-assets",
    name: "Fixed Assets",
    nature: "debit",
    category: "Assets",
    sortOrder: 6,
    icon: "Building",
    color: "#0284c7",
    subGroups: [],
  },
  {
    id: "pg-current-assets",
    name: "Current Assets",
    nature: "debit",
    category: "Assets",
    sortOrder: 7,
    icon: "Package",
    color: "#0284c7",
    subGroups: [
      { id: "sg-cash-in-hand", name: "Cash-in-Hand", parentId: "pg-current-assets" },
      { id: "sg-bank-accounts", name: "Bank Accounts", parentId: "pg-current-assets" },
      { id: "sg-sundry-debtors", name: "Sundry Debtors", parentId: "pg-current-assets" },
      { id: "sg-deposits-asset", name: "Deposits (Asset)", parentId: "pg-current-assets" },
      { id: "sg-stock-in-hand", name: "Stock-in-Hand", parentId: "pg-current-assets" },
    ],
  },
  {
    id: "pg-investments",
    name: "Investments",
    nature: "debit",
    category: "Assets",
    sortOrder: 8,
    icon: "TrendingUp",
    color: "#0284c7",
    subGroups: [
      { id: "sg-fixed-deposits", name: "Fixed Deposits", parentId: "pg-investments" },
      { id: "sg-shares-bonds", name: "Shares & Bonds", parentId: "pg-investments" },
    ],
  },
  {
    id: "pg-loans-asset",
    name: "Loans & Advances (Asset)",
    nature: "debit",
    category: "Assets",
    sortOrder: 9,
    icon: "Users",
    color: "#0284c7",
    subGroups: [
      { id: "sg-employee-advances", name: "Employee Advances", parentId: "pg-loans-asset" },
      { id: "sg-advances-suppliers", name: "Advances to Suppliers", parentId: "pg-loans-asset" },
    ],
  },
  // Income
  {
    id: "pg-direct-income",
    name: "Direct Income",
    nature: "credit",
    category: "Income/Revenue",
    sortOrder: 10,
    icon: "TrendingUp",
    color: "#059669",
    subGroups: [
      { id: "sg-sales-accounts", name: "Sales Accounts", parentId: "pg-direct-income" },
      { id: "sg-service-income", name: "Service Income", parentId: "pg-direct-income" },
    ],
  },
  {
    id: "pg-indirect-income",
    name: "Indirect Income",
    nature: "credit",
    category: "Income/Revenue",
    sortOrder: 11,
    icon: "TrendingUp",
    color: "#059669",
    subGroups: [
      { id: "sg-interest-received", name: "Interest Received", parentId: "pg-indirect-income" },
      { id: "sg-commission-received", name: "Commission Received", parentId: "pg-indirect-income" },
      { id: "sg-rent-received", name: "Rent Received", parentId: "pg-indirect-income" },
    ],
  },
  // Expenses
  {
    id: "pg-direct-expense",
    name: "Direct Expenses (Mfg.)",
    nature: "debit",
    category: "Expenses",
    sortOrder: 12,
    icon: "TrendingDown",
    color: "#d97706",
    subGroups: [
      { id: "sg-raw-material", name: "Raw Material Purchase", parentId: "pg-direct-expense" },
      { id: "sg-freight-inward", name: "Freight Inward", parentId: "pg-direct-expense" },
      { id: "sg-factory-wages", name: "Factory Wages", parentId: "pg-direct-expense" },
    ],
  },
  {
    id: "pg-indirect-expense",
    name: "Indirect Expenses (Admn.)",
    nature: "debit",
    category: "Expenses",
    sortOrder: 13,
    icon: "TrendingDown",
    color: "#d97706",
    subGroups: [
      { id: "sg-admin-expenses", name: "Administrative Expenses", parentId: "pg-indirect-expense" },
      { id: "sg-selling-expenses", name: "Selling Expenses", parentId: "pg-indirect-expense" },
      { id: "sg-financial-charges", name: "Financial Charges", parentId: "pg-indirect-expense" },
    ],
  },
  {
    id: "pg-purchase",
    name: "Purchase Accounts",
    nature: "debit",
    category: "Expenses",
    sortOrder: 14,
    icon: "ShoppingCart",
    color: "#d97706",
    subGroups: [
      { id: "sg-purchase-local", name: "Purchase (Local)", parentId: "pg-purchase" },
      { id: "sg-purchase-interstate", name: "Purchase (Interstate)", parentId: "pg-purchase" },
      { id: "sg-purchase-import", name: "Purchase (Import)", parentId: "pg-purchase" },
    ],
  },
  // Miscellaneous
  {
    id: "pg-suspense",
    name: "Suspense Account",
    nature: "debit",
    category: "Miscellaneous",
    sortOrder: 15,
    icon: "BarChart2",
    color: "#6b7280",
    subGroups: [],
  },
];

const CATEGORY_ORDER = [
  "Capital/Equity",
  "Liabilities",
  "Assets",
  "Income/Revenue",
  "Expenses",
  "Miscellaneous",
];
const CATEGORY_COLORS: Record<string, string> = {
  "Capital/Equity": "#7c3aed",
  Liabilities: "#dc2626",
  Assets: "#0284c7",
  "Income/Revenue": "#059669",
  Expenses: "#d97706",
  Miscellaneous: "#6b7280",
};

// ─── Account Type Options ─────────────────────────────────────────────────────
const ACCOUNT_TYPES = ["General Ledger", "Party", "Bank", "Cash"];
const PARTY_REG_TYPES = [
  "Regular",
  "Composition",
  "Unregistered",
  "Consumer",
  "SEZ",
  "Deemed Export",
];
const BANK_ACCOUNT_TYPES = ["Savings", "Current", "Overdraft", "Cash Credit", "Fixed Deposit"];
const INDIA_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
  "Chandigarh",
  "Dadra & Nagar Haveli",
  "Daman & Diu",
  "Lakshadweep",
  "Puducherry",
  "Andaman & Nicobar Islands",
];

// ─── localStorage helpers ─────────────────────────────────────────────────────
const LS_KEYS = {
  GROUPS: "busy_account_groups",
  LEDGERS: "busy_ledgers",
  FEATURES: "busy_features",
  MASTER_CONFIG: "busy_master_config",
};

function loadFromLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function saveToLS(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AccountGroup {
  id: string;
  name: string;
  alias?: string;
  isPrimary: boolean;
  parentId?: string;
  narration?: string;
  isSystem: boolean;
  nature: "debit" | "credit";
  category: string;
  sortOrder?: number;
}

interface Ledger {
  id: string;
  name: string;
  alias?: string;
  printName?: string;
  groupId: string;
  accountType: string;
  // Address
  address?: string;
  state?: string;
  pinCode?: string;
  country?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
  // GST
  gstin?: string;
  pan?: string;
  registrationType?: string;
  taxCategory?: string;
  // Bank details
  bankName?: string;
  bankBranch?: string;
  bankAccountNo?: string;
  ifscCode?: string;
  bankAccountType?: string;
  odCcLimit?: number;
  // Opening balance
  openingBalance?: number;
  openingBalanceType?: "Dr" | "Cr";
  // Configuration
  billByBill?: boolean;
  maintainCostCenter?: boolean;
  maintainBranch?: boolean;
  multiCurrency?: boolean;
  tdsApplicable?: boolean;
  tcsApplicable?: boolean;
  gstApplicable?: boolean;
  reverseCharge?: boolean;
  creditLimit?: number;
  creditPeriod?: number;
  // Sub-ledger
  ledgerType?: "General Ledger" | "Sub Ledger";
  parentLedgerId?: string;
  // Optional fields
  optionalFields?: Record<string, any>;
  isActive?: boolean;
  balance?: number;
  createdAt?: string;
}

interface FeatureConfig {
  multiCurrency: boolean;
  subLedgers: boolean;
  billByBill: boolean;
  autoRefSales: boolean;
  autoRefPurchase: boolean;
  bankInstruments: boolean;
  ledgerReconciliation: boolean;
  salesman: boolean;
  costCenter: boolean;
  budgeting: boolean;
  interestCalculation: boolean;
  tds: boolean;
  tcs: boolean;
  branchDivision: boolean;
  multiGodown: boolean;
}

interface MasterConfig {
  dropdownDisplay: "name" | "name_alias" | "name_alias_group" | "name_code";
  additionalDropdownFields: Array<{ field: string; width: number }>;
  showBottomPanel: boolean;
  bottomPanelFields: string[];
  optionalFields: Array<{
    id: string;
    name: string;
    dataType: "text" | "numeric" | "date" | "list" | "yesno";
    listValues?: string;
    mandatory: boolean;
    maintainDB: boolean;
    defaultValue?: string;
    decimalPlaces?: number;
  }>;
  hiddenFields: string[];
  mandatoryFields: string[];
}

// ─── Initial data ─────────────────────────────────────────────────────────────
function buildInitialGroups(): AccountGroup[] {
  const groups: AccountGroup[] = [];
  PREDEFINED_GROUPS.forEach((pg) => {
    groups.push({
      id: pg.id,
      name: pg.name,
      isPrimary: true,
      isSystem: true,
      nature: pg.nature as any,
      category: pg.category,
      sortOrder: pg.sortOrder,
    });
    pg.subGroups.forEach((sg) => {
      groups.push({
        id: sg.id,
        name: sg.name,
        isPrimary: false,
        parentId: pg.id,
        isSystem: true,
        nature: pg.nature as any,
        category: pg.category,
      });
    });
  });
  return groups;
}

const DEFAULT_FEATURES: FeatureConfig = {
  multiCurrency: false,
  subLedgers: false,
  billByBill: true,
  autoRefSales: true,
  autoRefPurchase: true,
  bankInstruments: true,
  ledgerReconciliation: false,
  salesman: false,
  costCenter: false,
  budgeting: false,
  interestCalculation: false,
  tds: false,
  tcs: false,
  branchDivision: false,
  multiGodown: true,
};

const DEFAULT_MASTER_CONFIG: MasterConfig = {
  dropdownDisplay: "name_alias",
  additionalDropdownFields: [
    { field: "group", width: 20 },
    { field: "gstin", width: 16 },
  ],
  showBottomPanel: true,
  bottomPanelFields: ["Name", "Group", "City", "GSTIN", "Phone", "Opening Balance"],
  optionalFields: [],
  hiddenFields: [],
  mandatoryFields: [],
};

// ─── Utility ──────────────────────────────────────────────────────────────────
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-0.5 block";
const sectionHdr =
  "text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 px-3 py-1.5 border-y border-gray-200 -mx-4 mb-3 mt-3";

function fmt(n: number): string {
  return (
    "Rs. " +
    Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const ChartOfAccounts: React.FC = () => {
  const { accounts, addAccount, updateAccount, deleteAccount } = useStore() as any;

  // ── State: Groups & Ledgers ──────────────────────────────────────────────
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

  // ── Persist ──────────────────────────────────────────────────────────────
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

  // ── UI State ─────────────────────────────────────────────────────────────
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
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "group" | "ledger";
    id: string;
    name: string;
  } | null>(null);
  const [clipboardItem, setClipboardItem] = useState<any>(null);

  // ── Group Form State ──────────────────────────────────────────────────────
  const [gForm, setGForm] = useState<Partial<AccountGroup>>({});
  const [gErrors, setGErrors] = useState<Record<string, string>>({});
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // ── Ledger Form State ─────────────────────────────────────────────────────
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
  const [ledgerTab, setLedgerTab] = useState<
    "general" | "address" | "gst" | "bank" | "config" | "optional"
  >("general");

  // ── Build tree ────────────────────────────────────────────────────────────
  const allGroups = useMemo(() => groups, [groups]);
  const allLedgers = useMemo(() => ledgers, [ledgers]);

  // Hierarchy: category → primary group → sub-groups → ledgers
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

  // ── Flattened for search ──────────────────────────────────────────────────
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

  // ── Balance calculations ──────────────────────────────────────────────────
  function getGroupBalance(groupId: string): number {
    const directLedgers = allLedgers.filter((l) => l.groupId === groupId);
    const directBalance = directLedgers.reduce((s, l) => s + (l.balance || 0), 0);
    const childGroups = allGroups.filter((g) => g.parentId === groupId);
    const childBalance = childGroups.reduce((s, g) => s + getGroupBalance(g.id), 0);
    return directBalance + childBalance;
  }

  // ── Toggle expand ─────────────────────────────────────────────────────────
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  // ─── GROUP MASTER ─────────────────────────────────────────────────────────
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

  // ─── LEDGER MASTER ────────────────────────────────────────────────────────
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

  // ─── EXPORT ───────────────────────────────────────────────────────────────
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

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
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

  // ─── GROUP FORM ───────────────────────────────────────────────────────────
  const renderGroupForm = () => {
    const isEdit = activePanel === "editGroup";
    const editGroup =
      isEdit && editingGroupId ? allGroups.find((g) => g.id === editingGroupId) : null;
    const isSystemGroup = editGroup?.isSystem;
    const parentOptions = allGroups
      .filter((g) => !g.isPrimary || true)
      .filter((g) => g.id !== editingGroupId);

    return (
      <div className="p-4 max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-bold text-gray-800">
            {isEdit ? `Modify Group — ${editGroup?.name}` : "Add Account Group"}
          </h2>
          <div className="text-[10px] text-gray-500">F2=Save · Esc=Cancel</div>
        </div>

        {isSystemGroup && (
          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            System group — limited editing allowed
          </div>
        )}

        <div className="flex flex-col gap-3">
          {/* Name */}
          <div>
            <label className={labelCls}>
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              value={gForm.name || ""}
              onChange={(e) => setGForm((p) => ({ ...p, name: e.target.value }))}
              disabled={isSystemGroup}
              className={`${inputCls} ${gErrors.name ? "border-red-400" : ""} ${isSystemGroup ? "bg-gray-50 cursor-not-allowed" : ""}`}
              placeholder="e.g. Office Equipment"
            />
            {gErrors.name && <p className="text-[11px] text-red-600 mt-0.5">{gErrors.name}</p>}
          </div>

          {/* Alias */}
          <div>
            <label className={labelCls}>Alias / Short Name (optional)</label>
            <input
              value={gForm.alias || ""}
              onChange={(e) => setGForm((p) => ({ ...p, alias: e.target.value }))}
              disabled={isSystemGroup}
              className={`${inputCls} ${isSystemGroup ? "bg-gray-50 cursor-not-allowed" : ""}`}
              placeholder="e.g. OffEq"
            />
          </div>

          {/* Primary Group toggle */}
          {!isSystemGroup && (
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <label className="text-[12px] font-medium text-gray-700 mb-2 block">
                Is Primary Group?
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGForm((p) => ({ ...p, isPrimary: true, parentId: undefined }))}
                  className={`flex-1 h-8 text-[11px] font-semibold rounded border transition-colors ${gForm.isPrimary ? "bg-[#1557b0] text-white border-[#1557b0]" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                >
                  Y (Top Level)
                </button>
                <button
                  type="button"
                  onClick={() => setGForm((p) => ({ ...p, isPrimary: false }))}
                  className={`flex-1 h-8 text-[11px] font-semibold rounded border transition-colors ${!gForm.isPrimary ? "bg-[#1557b0] text-white border-[#1557b0]" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                >
                  N (Sub-Group)
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Primary = Top-level. Non-primary = Sub-group under an existing group.
              </p>
            </div>
          )}

          {/* Under Group */}
          {!gForm.isPrimary && !isSystemGroup && (
            <div>
              <label className={labelCls}>
                Under Group <span className="text-red-500">*</span>
              </label>
              <select
                value={gForm.parentId || ""}
                onChange={(e) => {
                  const pg = allGroups.find((g) => g.id === e.target.value);
                  setGForm((p) => ({
                    ...p,
                    parentId: e.target.value,
                    nature: pg?.nature || p.nature,
                    category: pg?.category || p.category,
                  }));
                }}
                className={`${inputCls} ${gErrors.parentId ? "border-red-400" : ""}`}
              >
                <option value="">— Select Parent Group —</option>
                {allGroups
                  .filter((g) => g.id !== editingGroupId)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.isPrimary ? g.name : `  ${g.name}`} {g.isSystem ? "(System)" : ""}
                    </option>
                  ))}
              </select>
              {gErrors.parentId && (
                <p className="text-[11px] text-red-600 mt-0.5">{gErrors.parentId}</p>
              )}
            </div>
          )}

          {/* Nature */}
          {!isSystemGroup && (
            <div>
              <label className={labelCls}>Nature</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGForm((p) => ({ ...p, nature: "debit" }))}
                  className={`flex-1 h-8 text-[11px] font-semibold rounded border ${gForm.nature === "debit" ? "bg-[#1557b0] text-white border-[#1557b0]" : "bg-white text-gray-700 border-gray-300"}`}
                >
                  Debit (Assets/Expenses)
                </button>
                <button
                  type="button"
                  onClick={() => setGForm((p) => ({ ...p, nature: "credit" }))}
                  className={`flex-1 h-8 text-[11px] font-semibold rounded border ${gForm.nature === "credit" ? "bg-[#1557b0] text-white border-[#1557b0]" : "bg-white text-gray-700 border-gray-300"}`}
                >
                  Credit (Liabilities/Income)
                </button>
              </div>
            </div>
          )}

          {/* Narration */}
          <div>
            <label className={labelCls}>Narration / Description (optional)</label>
            <textarea
              value={gForm.narration || ""}
              onChange={(e) => setGForm((p) => ({ ...p, narration: e.target.value }))}
              rows={2}
              className="w-full px-2.5 py-1.5 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] resize-none"
              placeholder="Internal description..."
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div className="flex gap-2">
              {isEdit && !isSystemGroup && (
                <button
                  onClick={() => editGroup && confirmDeleteGroup(editGroup)}
                  className="h-8 px-3 bg-red-600 text-white text-[12px] font-medium rounded hover:bg-red-700 flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete (F8)
                </button>
              )}
              {editGroup && (
                <button
                  onClick={() => copyGroup(editGroup)}
                  className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy (F12)
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActivePanel("list")}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded hover:bg-gray-50"
              >
                Cancel (Esc)
              </button>
              {!isSystemGroup && (
                <>
                  <button
                    onClick={() => saveGroup(true)}
                    className="h-8 px-3 bg-gray-100 border border-gray-300 text-gray-700 text-[12px] rounded hover:bg-gray-200"
                  >
                    Save & New
                  </button>
                  <button
                    onClick={() => saveGroup(false)}
                    className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded hover:bg-[#0f4a96] flex items-center gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" /> Save (F2)
                  </button>
                </>
              )}
              {isSystemGroup && (
                <button
                  onClick={() => setActivePanel("list")}
                  className="h-8 px-3 bg-[#1557b0] text-white text-[12px] rounded"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── LEDGER FORM ──────────────────────────────────────────────────────────
  const LEDGER_TABS = [
    { id: "general", label: "General" },
    { id: "address", label: "Address" },
    { id: "gst", label: "GST & Tax" },
    ...(lForm.accountType === "Bank" ? [{ id: "bank", label: "Bank" }] : []),
    { id: "config", label: "Configuration" },
    ...(masterConfig.optionalFields.length > 0
      ? [{ id: "optional", label: "Optional Fields" }]
      : []),
  ];

  const renderLedgerForm = () => {
    const isEdit = activePanel === "editLedger";
    const editLedger =
      isEdit && editingLedgerId ? allLedgers.find((l) => l.id === editingLedgerId) : null;
    const selectedGroup = lForm.groupId ? allGroups.find((g) => g.id === lForm.groupId) : null;
    const isBankGroup = selectedGroup?.name.toLowerCase().includes("bank");
    const isDebtorCreditor =
      selectedGroup?.id === "sg-sundry-debtors" ||
      selectedGroup?.id === "sg-sundry-creditors" ||
      selectedGroup?.name.toLowerCase().includes("debtor") ||
      selectedGroup?.name.toLowerCase().includes("creditor");

    return (
      <div className="p-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-bold text-gray-800">
            {isEdit ? `Modify Ledger — ${editLedger?.name}` : "Add Ledger Account"}
          </h2>
          <div className="text-[10px] text-gray-500">F2=Save · Esc=Cancel</div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4 gap-0">
          {LEDGER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setLedgerTab(tab.id as any)}
              className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors -mb-px ${ledgerTab === tab.id ? "border-[#1557b0] text-[#1557b0]" : "border-transparent text-gray-600 hover:text-gray-800"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── GENERAL TAB ── */}
        {ledgerTab === "general" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>
                  Account Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={lForm.name || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, name: e.target.value }))}
                  className={`${inputCls} ${lErrors.name ? "border-red-400" : ""}`}
                  placeholder="e.g. HDFC Bank Current A/c 0234"
                  autoFocus
                />
                {lErrors.name && <p className="text-[11px] text-red-600 mt-0.5">{lErrors.name}</p>}
              </div>
              <div>
                <label className={labelCls}>Alias (optional)</label>
                <input
                  value={lForm.alias || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, alias: e.target.value }))}
                  className={inputCls}
                  placeholder="Short name for quick search"
                />
              </div>
              <div>
                <label className={labelCls}>Print Name (optional)</label>
                <input
                  value={lForm.printName || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, printName: e.target.value }))}
                  className={inputCls}
                  placeholder="Name on invoices/statements"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>
                Account Group <span className="text-red-500">*</span>
              </label>
              <select
                value={lForm.groupId || ""}
                onChange={(e) => setLForm((p) => ({ ...p, groupId: e.target.value }))}
                className={`${inputCls} ${lErrors.groupId ? "border-red-400" : ""}`}
              >
                <option value="">— Select Account Group —</option>
                {CATEGORY_ORDER.map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {allGroups
                      .filter((g) => g.category === cat)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.isPrimary ? g.name : `  ${g.name}`}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {lErrors.groupId && (
                <p className="text-[11px] text-red-600 mt-0.5">{lErrors.groupId}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Account Type</label>
              <div className="flex gap-1.5 flex-wrap">
                {ACCOUNT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setLForm((p) => ({ ...p, accountType: t }))}
                    className={`h-7 px-3 text-[11px] font-semibold rounded border transition-colors ${lForm.accountType === t ? "bg-[#1557b0] text-white border-[#1557b0]" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Party = Customers/Suppliers · Bank = Bank Accounts · Cash = Cash Accounts · General
                Ledger = Others
              </p>
            </div>

            {/* Sub Ledger */}
            {features.subLedgers && (
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <label className={labelCls}>Ledger Type</label>
                <div className="flex gap-2 mb-2">
                  {["General Ledger", "Sub Ledger"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLForm((p) => ({ ...p, ledgerType: t as any }))}
                      className={`flex-1 h-7 text-[11px] font-semibold rounded border ${lForm.ledgerType === t ? "bg-[#1557b0] text-white border-[#1557b0]" : "bg-white text-gray-700 border-gray-300"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {lForm.ledgerType === "Sub Ledger" && (
                  <div>
                    <label className={labelCls}>
                      Parent Account <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={lForm.parentLedgerId || ""}
                      onChange={(e) => setLForm((p) => ({ ...p, parentLedgerId: e.target.value }))}
                      className={`${inputCls} ${lErrors.parentLedgerId ? "border-red-400" : ""}`}
                    >
                      <option value="">— Select Parent Ledger —</option>
                      {allLedgers
                        .filter((l) => l.ledgerType !== "Sub Ledger" && l.id !== editingLedgerId)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                    </select>
                    {lErrors.parentLedgerId && (
                      <p className="text-[11px] text-red-600 mt-0.5">{lErrors.parentLedgerId}</p>
                    )}
                    <p className="text-[10px] text-gray-500 mt-1">
                      Sub-ledger balance rolls up to the parent in all reports.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Opening Balance */}
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <div className={sectionHdr + " -mx-3 mb-2"}>Opening Balance</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Amount</label>
                  <input
                    type="number"
                    value={lForm.openingBalance || ""}
                    onChange={(e) =>
                      setLForm((p) => ({ ...p, openingBalance: Number(e.target.value) || 0 }))
                    }
                    className={inputCls}
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                  />
                </div>
                <div>
                  <label className={labelCls}>Dr / Cr</label>
                  <div className="flex h-8 border border-gray-300 rounded overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setLForm((p) => ({ ...p, openingBalanceType: "Dr" }))}
                      className={`flex-1 text-[11px] font-bold transition-colors ${lForm.openingBalanceType === "Dr" ? "bg-[#1557b0] text-white" : "bg-white text-gray-700"}`}
                    >
                      Dr
                    </button>
                    <button
                      type="button"
                      onClick={() => setLForm((p) => ({ ...p, openingBalanceType: "Cr" }))}
                      className={`flex-1 text-[11px] font-bold transition-colors ${lForm.openingBalanceType === "Cr" ? "bg-[#1557b0] text-white" : "bg-white text-gray-700"}`}
                    >
                      Cr
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Credit terms for debtors/creditors */}
            {(isDebtorCreditor || lForm.accountType === "Party") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Credit Limit (Rs.)</label>
                  <input
                    type="number"
                    value={lForm.creditLimit || ""}
                    onChange={(e) =>
                      setLForm((p) => ({ ...p, creditLimit: Number(e.target.value) || 0 }))
                    }
                    className={inputCls}
                    placeholder="0 = unlimited"
                  />
                </div>
                <div>
                  <label className={labelCls}>Credit Period (Days)</label>
                  <input
                    type="number"
                    value={lForm.creditPeriod || ""}
                    onChange={(e) =>
                      setLForm((p) => ({ ...p, creditPeriod: Number(e.target.value) || 0 }))
                    }
                    className={inputCls}
                    placeholder="e.g. 30"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ADDRESS TAB ── */}
        {ledgerTab === "address" && (
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>Address</label>
              <textarea
                value={lForm.address || ""}
                onChange={(e) => setLForm((p) => ({ ...p, address: e.target.value }))}
                rows={2}
                className="w-full px-2.5 py-1.5 text-[12px] border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0] resize-none"
                placeholder="Street address, Area"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>State</label>
                <select
                  value={lForm.state || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, state: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— Select State —</option>
                  {INDIA_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>PIN Code</label>
                <input
                  value={lForm.pinCode || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, pinCode: e.target.value }))}
                  className={inputCls}
                  placeholder="6-digit PIN"
                  maxLength={6}
                />
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <input
                  value={lForm.country || "India"}
                  onChange={(e) => setLForm((p) => ({ ...p, country: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  value={lForm.phone || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, phone: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Mobile</label>
                <input
                  value={lForm.mobile || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, mobile: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={lForm.email || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, email: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input
                  value={lForm.website || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, website: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── GST TAB ── */}
        {ledgerTab === "gst" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>GSTIN / UIN (15 chars)</label>
                <div className="flex gap-1">
                  <input
                    value={lForm.gstin || ""}
                    onChange={(e) =>
                      setLForm((p) => ({ ...p, gstin: e.target.value.toUpperCase().slice(0, 15) }))
                    }
                    className={`${inputCls} flex-1`}
                    placeholder="27AABCT1234Q1Z5"
                    maxLength={15}
                  />
                  <button
                    type="button"
                    className="h-8 px-2 bg-[#1557b0] text-white text-[10px] rounded hover:bg-[#0f4a96]"
                    onClick={() =>
                      toast.success("GSTIN validation requires GST portal integration.")
                    }
                  >
                    Validate
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>PAN (10 chars)</label>
                <input
                  value={lForm.pan || ""}
                  onChange={(e) =>
                    setLForm((p) => ({ ...p, pan: e.target.value.toUpperCase().slice(0, 10) }))
                  }
                  className={inputCls}
                  placeholder="AABCT1234Q"
                  maxLength={10}
                />
              </div>
              <div>
                <label className={labelCls}>Registration Type</label>
                <select
                  value={lForm.registrationType || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, registrationType: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— Select —</option>
                  {PARTY_REG_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tax Category</label>
                <input
                  value={lForm.taxCategory || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, taxCategory: e.target.value }))}
                  className={inputCls}
                  placeholder="Default tax category"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
              {[
                { key: "gstApplicable", label: "GST Applicable" },
                { key: "reverseCharge", label: "Reverse Charge Applicable" },
                { key: "tdsApplicable", label: "TDS Applicable" },
                { key: "tcsApplicable", label: "TCS Applicable" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(lForm as any)[key] || false}
                    onChange={(e) => setLForm((p) => ({ ...p, [key]: e.target.checked }))}
                    className="h-4 w-4 rounded accent-[#1557b0]"
                  />
                  <span className="text-[12px] text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── BANK TAB ── */}
        {ledgerTab === "bank" && lForm.accountType === "Bank" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Bank Name</label>
                <input
                  value={lForm.bankName || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, bankName: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. HDFC Bank"
                />
              </div>
              <div>
                <label className={labelCls}>Branch</label>
                <input
                  value={lForm.bankBranch || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, bankBranch: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. Andheri West"
                />
              </div>
              <div>
                <label className={labelCls}>Account Number</label>
                <input
                  value={lForm.bankAccountNo || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, bankAccountNo: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>IFSC Code</label>
                <input
                  value={lForm.ifscCode || ""}
                  onChange={(e) =>
                    setLForm((p) => ({ ...p, ifscCode: e.target.value.toUpperCase() }))
                  }
                  className={inputCls}
                  maxLength={11}
                  placeholder="HDFC0001234"
                />
              </div>
              <div>
                <label className={labelCls}>Account Type</label>
                <select
                  value={lForm.bankAccountType || ""}
                  onChange={(e) => setLForm((p) => ({ ...p, bankAccountType: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— Select —</option>
                  {BANK_ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>OD/CC Limit (Rs.)</label>
                <input
                  type="number"
                  value={lForm.odCcLimit || ""}
                  onChange={(e) =>
                    setLForm((p) => ({ ...p, odCcLimit: Number(e.target.value) || 0 }))
                  }
                  className={inputCls}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIGURATION TAB ── */}
        {ledgerTab === "config" && (
          <div className="flex flex-col gap-2">
            {[
              {
                key: "billByBill",
                label: "Maintain Bill-by-Bill Balancing",
                desc: "Track outstanding invoices individually. Enables AR/AP aging reports.",
                show: features.billByBill,
              },
              {
                key: "maintainCostCenter",
                label: "Maintain Cost Center",
                desc: "Require cost center allocation for transactions in this account.",
                show: features.costCenter,
              },
              {
                key: "maintainBranch",
                label: "Maintain Branch-wise Details",
                desc: "Track transactions by branch/division.",
                show: features.branchDivision,
              },
              {
                key: "multiCurrency",
                label: "Multi-Currency",
                desc: "Enable foreign currency transactions for this party.",
                show: features.multiCurrency,
              },
              {
                key: "isActive",
                label: "Active",
                desc: "Inactive ledgers are hidden from voucher entry dropdowns.",
                show: true,
              },
            ]
              .filter((f) => f.show)
              .map(({ key, label, desc }) => (
                <div
                  key={key}
                  className={`p-3 rounded border ${(lForm as any)[key] ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(lForm as any)[key] || false}
                      onChange={(e) => setLForm((p) => ({ ...p, [key]: e.target.checked }))}
                      className="h-4 w-4 mt-0.5 rounded accent-[#1557b0] shrink-0"
                    />
                    <div>
                      <span className="text-[12px] font-semibold text-gray-800 block">{label}</span>
                      <span className="text-[11px] text-gray-500">{desc}</span>
                    </div>
                  </label>
                </div>
              ))}
          </div>
        )}

        {/* ── OPTIONAL FIELDS TAB ── */}
        {ledgerTab === "optional" && masterConfig.optionalFields.length > 0 && (
          <div className="flex flex-col gap-3">
            {masterConfig.optionalFields.map((field) => (
              <div key={field.id}>
                <label className={labelCls}>
                  {field.name}
                  {field.mandatory && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.dataType === "text" && (
                  <input
                    value={(lForm.optionalFields || {})[field.id] || field.defaultValue || ""}
                    onChange={(e) =>
                      setLForm((p) => ({
                        ...p,
                        optionalFields: { ...(p.optionalFields || {}), [field.id]: e.target.value },
                      }))
                    }
                    className={inputCls}
                  />
                )}
                {field.dataType === "numeric" && (
                  <input
                    type="number"
                    step={field.decimalPlaces ? `0.${"0".repeat(field.decimalPlaces - 1)}1` : "1"}
                    value={(lForm.optionalFields || {})[field.id] || field.defaultValue || ""}
                    onChange={(e) =>
                      setLForm((p) => ({
                        ...p,
                        optionalFields: { ...(p.optionalFields || {}), [field.id]: e.target.value },
                      }))
                    }
                    className={inputCls}
                  />
                )}
                {field.dataType === "date" && (
                  <input
                    type="date"
                    value={(lForm.optionalFields || {})[field.id] || ""}
                    onChange={(e) =>
                      setLForm((p) => ({
                        ...p,
                        optionalFields: { ...(p.optionalFields || {}), [field.id]: e.target.value },
                      }))
                    }
                    className={inputCls}
                  />
                )}
                {field.dataType === "list" && (
                  <select
                    value={(lForm.optionalFields || {})[field.id] || ""}
                    onChange={(e) =>
                      setLForm((p) => ({
                        ...p,
                        optionalFields: { ...(p.optionalFields || {}), [field.id]: e.target.value },
                      }))
                    }
                    className={inputCls}
                  >
                    <option value="">— Select —</option>
                    {(field.listValues || "")
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean)
                      .map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                  </select>
                )}
                {field.dataType === "yesno" && (
                  <div className="flex gap-2">
                    {["Yes", "No"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          setLForm((p) => ({
                            ...p,
                            optionalFields: { ...(p.optionalFields || {}), [field.id]: v },
                          }))
                        }
                        className={`flex-1 h-8 text-[11px] font-semibold rounded border ${(lForm.optionalFields || {})[field.id] === v ? "bg-[#1557b0] text-white border-[#1557b0]" : "bg-white text-gray-700 border-gray-300"}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-4">
          <div className="flex gap-2">
            {isEdit && (
              <button
                onClick={() => editLedger && confirmDeleteLedger(editLedger)}
                className="h-8 px-3 bg-red-600 text-white text-[12px] font-medium rounded hover:bg-red-700 flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete (F8)
              </button>
            )}
            {editLedger && (
              <button
                onClick={() => copyLedger(editLedger)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded hover:bg-gray-50 flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Copy (F12)
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActivePanel("list")}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded hover:bg-gray-50"
            >
              Cancel (Esc)
            </button>
            <button
              onClick={() => saveLedger(true)}
              className="h-8 px-3 bg-gray-100 border border-gray-300 text-gray-700 text-[12px] rounded hover:bg-gray-200"
            >
              Save & New
            </button>
            <button
              onClick={() => saveLedger(false)}
              className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded hover:bg-[#0f4a96] flex items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Save (F2)
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── FEATURES PANEL ───────────────────────────────────────────────────────
  const renderFeatures = () => (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-bold text-gray-800">Features / Options — Accounts Tab</h2>
        <button
          onClick={() => setActivePanel("list")}
          className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] rounded hover:bg-gray-50"
        >
          ← Back
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {[
          {
            key: "multiCurrency",
            label: "Multi Currency",
            desc: "Enable foreign currency transactions, exchange rates.",
          },
          {
            key: "subLedgers",
            label: "Maintain Sub Ledgers",
            desc: "Create child accounts under a parent General Ledger.",
          },
          {
            key: "billByBill",
            label: "Bill-by-Bill Details",
            desc: "Track outstanding invoices individually. Enables AR/AP aging.",
          },
          {
            key: "autoRefSales",
            label: "↳ Auto Create References in Sales",
            desc: "Auto-create bill reference on saving sales voucher.",
            indent: true,
          },
          {
            key: "autoRefPurchase",
            label: "↳ Auto Create References in Purchase",
            desc: "Auto-create bill reference on saving purchase voucher.",
            indent: true,
          },
          {
            key: "bankInstruments",
            label: "Maintain Bank Instrument Details",
            desc: "Track cheque/DD/NEFT/UPI details in vouchers.",
          },
          {
            key: "ledgerReconciliation",
            label: "Ledger Reconciliation",
            desc: "Enable bank statement reconciliation.",
          },
          {
            key: "salesman",
            label: "Salesman / Broker Wise Reporting",
            desc: "Track sales by salesman. Enables commission calculation.",
          },
          {
            key: "costCenter",
            label: "Cost Center",
            desc: "Enable cost/profit center tracking in vouchers.",
          },
          {
            key: "budgeting",
            label: "Budgeting",
            desc: "Set budgets per account/group. Budget vs Actual reports.",
          },
          {
            key: "interestCalculation",
            label: "Interest Calculation",
            desc: "Auto-calculate interest on overdue party balances.",
          },
          {
            key: "tds",
            label: "TDS (Tax Deducted at Source)",
            desc: "TDS sections, rates, thresholds. Auto-deduct TDS in payments.",
          },
          {
            key: "tcs",
            label: "TCS (Tax Collected at Source)",
            desc: "Tax collection at source on sales.",
          },
          {
            key: "branchDivision",
            label: "Maintain Branch / Division",
            desc: "Multi-branch accounting. Branch-wise P&L and Balance Sheet.",
          },
          {
            key: "multiGodown",
            label: "Maintain Multiple Godowns",
            desc: "Multi-location inventory tracking.",
          },
        ].map(({ key, label, desc, indent }) => (
          <div
            key={key}
            className={`p-3 rounded border transition-colors ${features[key as keyof FeatureConfig] ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"} ${indent ? "ml-6" : ""}`}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={features[key as keyof FeatureConfig] || false}
                onChange={(e) => {
                  const updated = { ...features, [key]: e.target.checked };
                  setFeatures(updated);
                  saveToLS(LS_KEYS.FEATURES, updated);
                  toast.success(`${label} ${e.target.checked ? "enabled" : "disabled"}.`);
                }}
                className="h-4 w-4 mt-0.5 rounded accent-[#1557b0] shrink-0"
              />
              <div>
                <span className="text-[12px] font-semibold text-gray-800 block">{label}</span>
                <span className="text-[11px] text-gray-500">{desc}</span>
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── MASTER CONFIG PANEL ──────────────────────────────────────────────────
  const renderMasterConfig = () => (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-bold text-gray-800">Master Configuration — Account</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              saveToLS(LS_KEYS.MASTER_CONFIG, masterConfig);
              toast.success("Master Configuration saved. Dropdowns updated.");
              setActivePanel("list");
            }}
            className="h-7 px-3 bg-[#1557b0] text-white text-[11px] font-medium rounded hover:bg-[#0f4a96]"
          >
            Save & Apply
          </button>
          <button
            onClick={() => setActivePanel("list")}
            className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] rounded hover:bg-gray-50"
          >
            ← Back
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
                  <option value="">— Select Field —</option>
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
                  className="w-16 h-8 px-2 text-[11px] border border-gray-300 rounded"
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
                className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] rounded hover:bg-gray-50 flex items-center gap-1.5 mt-1"
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
            className="h-4 w-4 rounded accent-[#1557b0]"
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
                    className="h-3.5 w-3.5 rounded accent-[#1557b0]"
                  />
                  <span className="text-[11px] text-gray-700">{f}</span>
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
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={f.mandatory}
                    onChange={(e) => {
                      const upd = [...masterConfig.optionalFields];
                      upd[i] = { ...upd[i], mandatory: e.target.checked };
                      setMasterConfig((p) => ({ ...p, optionalFields: upd }));
                    }}
                    className="h-3.5 w-3.5 rounded accent-[#1557b0]"
                  />{" "}
                  Mandatory
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={f.maintainDB}
                    onChange={(e) => {
                      const upd = [...masterConfig.optionalFields];
                      upd[i] = { ...upd[i], maintainDB: e.target.checked };
                      setMasterConfig((p) => ({ ...p, optionalFields: upd }));
                    }}
                    className="h-3.5 w-3.5 rounded accent-[#1557b0]"
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
                  className="h-7 px-2 bg-red-50 text-red-600 text-[11px] rounded border border-red-200 hover:bg-red-100"
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
            className="h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[11px] rounded hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Plus className="h-3 w-3" /> Add Optional Field
          </button>
        )}
      </div>
    </div>
  );

  // ─── LIST VIEW ────────────────────────────────────────────────────────────
  function renderTreeRow(item: any) {
    const isGroup = item.kind === "group";
    const isExpanded = expandedIds.has(item.id);
    const hasChildren = isGroup && (item.children?.length > 0 || item.ledgers?.length > 0);
    const color = CATEGORY_COLORS[item.category] || "#6b7280";
    const group = !isGroup ? allGroups.find((g) => g.id === item.groupId) : null;
    const nature = item.nature || group?.nature || "debit";
    const balance = isGroup ? getGroupBalance(item.id) : item.balance || 0;
    const isSelected = selectedId === item.id;
    const isSystem = item.isSystem;

    return (
      <React.Fragment key={item.id}>
        <tr
          onClick={() => {
            setSelectedId(item.id);
            if (isGroup && hasChildren) toggleExpand(item.id);
          }}
          onDoubleClick={() => (isGroup ? openEditGroup(item) : openEditLedger(item))}
          className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? "bg-blue-50" : ""}`}
        >
          {/* Expand + Name */}
          <td className="px-2 py-1.5" style={{ paddingLeft: `${8 + (item.depth || 0) * 18}px` }}>
            <div className="flex items-center gap-1.5">
              {isGroup && hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(item.id);
                  }}
                  className="p-0.5 rounded text-gray-400 hover:text-gray-600"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}

              {isGroup ? (
                <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color }} />
              ) : (
                <BookOpen className="h-3 w-3 shrink-0 text-gray-400" />
              )}

              <span
                className={`text-[12px] ${isGroup ? "font-semibold" : "font-medium"} text-gray-800 truncate max-w-[260px]`}
              >
                {item.name}
              </span>
              {item.alias && <span className="text-[10px] text-gray-400 ml-1">({item.alias})</span>}
              {isSystem && <span className="badge badge-info ml-1">SYS</span>}
              {isGroup && item.isPrimary && <span className="badge ml-1">PRIMARY</span>}
            </div>
          </td>

          {/* Group / Parent */}
          <td className="px-3 py-1.5 text-[11px] text-gray-500 max-w-[160px] truncate">
            {isGroup
              ? item.isPrimary
                ? item.category
                : allGroups.find((g) => g.id === item.parentId)?.name || "—"
              : group?.name || "—"}
          </td>

          {/* Account Type */}
          <td className="px-3 py-1.5">
            {!isGroup && (
              <span
                className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                  item.accountType === "Bank"
                    ? "bg-blue-100 text-blue-700"
                    : item.accountType === "Cash"
                      ? "bg-green-100 text-green-700"
                      : item.accountType === "Party"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600"
                }`}
              >
                {item.accountType}
              </span>
            )}
          </td>

          {/* Nature */}
          <td className="px-3 py-1.5">
            <span
              className={`text-[10px] font-bold ${nature === "credit" ? "text-green-600" : "text-blue-600"}`}
            >
              {nature === "credit" ? "Cr" : "Dr"}
            </span>
          </td>

          {/* Balance */}
          <td className={`px-3 py-1.5 ${isGroup ? "number-cell-bold" : "number-cell"}`}>
            {balance !== 0 ? fmt(balance) : "—"}
          </td>

          {/* GSTIN */}
          <td className="px-3 py-1.5 text-[11px] text-gray-500 font-mono">
            {!isGroup && item.gstin ? item.gstin.slice(0, 15) : ""}
          </td>

          {/* Actions */}
          <td className="px-2 py-1.5 text-right">
            <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  isGroup ? openEditGroup(item) : openEditLedger(item);
                }}
                className="p-1 rounded text-gray-400 hover:text-[#1557b0] hover:bg-blue-50"
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  isGroup ? copyGroup(item) : copyLedger(item);
                }}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <Copy className="h-3 w-3" />
              </button>
              {!isSystem && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    isGroup ? confirmDeleteGroup(item) : confirmDeleteLedger(item);
                  }}
                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </td>
        </tr>
      </React.Fragment>
    );
  }

  function categoryHeadingClass(cat: string): string {
    const map: Record<string, string> = {
      Assets: "report-section-heading report-section-heading-assets",
      Liabilities: "report-section-heading report-section-heading-liab",
      "Income/Revenue": "report-section-heading report-section-heading-income",
      Expenses: "report-section-heading report-section-heading-expense",
      "Capital/Equity": "report-section-heading report-section-heading-capital",
    };
    return map[cat] || "report-section-heading";
  }

  function renderCategorySection(cat: string, nodes: any[]) {
    const catBalance = nodes.reduce((s, n) => s + getGroupBalance(n.id), 0);
    return (
      <React.Fragment key={cat}>
        <tr>
          <td colSpan={7} className={categoryHeadingClass(cat)}>
            <div className="flex items-center justify-between">
              <span>{cat}</span>
              {catBalance !== 0 && (
                <span className="number-cell-bold">{fmt(catBalance)}</span>
              )}
            </div>
          </td>
        </tr>
        {nodes.map((n) => renderGroupNode(n))}
      </React.Fragment>
    );
  }

  function renderGroupNode(node: any): React.ReactNode {
    const isExpanded = expandedIds.has(node.id);
    const rows: React.ReactNode[] = [renderTreeRow(node)];
    if (isExpanded) {
      node.ledgers?.forEach((l: any) => {
        rows.push(renderTreeRow({ ...l, kind: "ledger", depth: (node.depth || 0) + 1 }));
      });
      node.children?.forEach((child: any) => {
        rows.push(...(renderGroupNode(child) as any));
      });
    }
    return rows;
  }

  // ─── SELECTED ITEM BOTTOM PANEL ───────────────────────────────────────────
  const selectedItem = selectedId
    ? allLedgers.find((l) => l.id === selectedId) || allGroups.find((g) => g.id === selectedId)
    : null;
  const selectedIsLedger = selectedId ? !!allLedgers.find((l) => l.id === selectedId) : false;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (activePanel === "addGroup" || activePanel === "editGroup") {
    return <div className="h-full overflow-y-auto bg-white">{renderGroupForm()}</div>;
  }
  if (activePanel === "addLedger" || activePanel === "editLedger") {
    return <div className="h-full overflow-y-auto bg-white">{renderLedgerForm()}</div>;
  }
  if (activePanel === "features") {
    return <div className="h-full overflow-y-auto bg-white">{renderFeatures()}</div>;
  }
  if (activePanel === "masterConfig") {
    return <div className="h-full overflow-y-auto bg-white">{renderMasterConfig()}</div>;
  }
  if (activePanel === "deleteConfirm") {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-sm w-full shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-gray-800">Confirm Delete</h3>
              <p className="text-[12px] text-gray-500">This action cannot be undone.</p>
            </div>
          </div>
          <p className="text-[12px] text-gray-700 mb-4">
            Are you sure you want to delete <strong>"{deleteTarget?.name}"</strong>?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setDeleteTarget(null);
                setActivePanel("list");
              }}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded hover:bg-gray-50"
            >
              Cancel (No)
            </button>
            <button
              onClick={executeDelete}
              className="h-8 px-3 bg-red-600 text-white text-[12px] font-medium rounded hover:bg-red-700"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main List View ────────────────────────────────────────────────────────
  const isSearchActive =
    searchTerm.trim().length > 0 || filterGroup !== "ALL" || filterType !== "ALL";
  const displayRows = isSearchActive ? flatList : null;

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Chart of Accounts</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {allGroups.length} groups · {allLedgers.length} ledgers
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {clipboardItem && (
            <button
              onClick={pasteCopied}
              className="h-8 px-3 bg-amber-50 border border-amber-300 text-amber-700 text-[12px] font-medium rounded-md flex items-center gap-1 hover:bg-amber-100"
            >
              <Copy className="h-3 w-3" /> Paste ({clipboardItem.data.name.slice(0, 15)})
            </button>
          )}
          <button
            onClick={() => setActivePanel("features")}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md flex items-center gap-1 hover:bg-gray-50"
          >
            <Settings className="h-3.5 w-3.5" /> Features
          </button>
          <button
            onClick={() => setActivePanel("masterConfig")}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md flex items-center gap-1 hover:bg-gray-50"
          >
            <Settings className="h-3.5 w-3.5" /> Master Config
          </button>
          <button
            onClick={exportToExcel}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md flex items-center gap-1 hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button
            onClick={() => openAddGroup()}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md flex items-center gap-1 hover:bg-gray-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add Group (F3)
          </button>
          <button
            onClick={() => openAddLedger()}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add Ledger
          </button>
        </div>
      </div>

      {/* ── Search & Filter bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
        <div className="relative flex-1 max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, alias, GSTIN..."
            className="h-8 pl-8 pr-3 text-[12px] border border-gray-300 rounded-md bg-white w-full focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
        </div>
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
        >
          <option value="ALL">All Groups</option>
          {allGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.isPrimary ? g.name : `  ${g.name}`}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
        >
          <option value="ALL">All Types</option>
          <option value="group">Groups Only</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {isSearchActive && (
          <button
            onClick={() => {
              setSearchTerm("");
              setFilterGroup("ALL");
              setFilterType("ALL");
            }}
            className="h-7 px-2 text-[11px] text-red-600 border border-red-200 rounded hover:bg-red-50"
          >
            Clear Filters
          </button>
        )}
        <div className="ml-auto flex items-center gap-2 text-[10px] text-gray-400">
          <span>F3=Add Ledger · DblClick=Edit · F8=Delete</span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b-2 border-gray-200">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Account Name / Group
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Under / Category
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Type
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Nature
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Balance
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  GSTIN
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isSearchActive
                ? displayRows!.map((item) => renderTreeRow(item))
                : CATEGORY_ORDER.map((cat) => {
                    const nodes = tree[cat];
                    if (!nodes?.length) return null;
                    return renderCategorySection(cat, nodes);
                  })}
              {isSearchActive && displayRows!.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[12px] text-gray-500">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No accounts match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Bottom Panel (Selected Item Details) ── */}
        {masterConfig.showBottomPanel && selectedItem && selectedIsLedger && (
          <div className="border-t-2 border-gray-200 bg-white px-4 py-2 min-h-[80px]">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              Account Details
            </div>
            <div className="grid grid-cols-4 gap-x-6 gap-y-1">
              {masterConfig.bottomPanelFields.map((f) => {
                const l = selectedItem as Ledger;
                const val = (() => {
                  switch (f) {
                    case "Name":
                      return l.name;
                    case "Alias":
                      return l.alias;
                    case "Group":
                      return allGroups.find((g) => g.id === l.groupId)?.name;
                    case "Address":
                      return l.address;
                    case "City":
                      return l.state;
                    case "State":
                      return l.state;
                    case "PIN Code":
                      return l.pinCode;
                    case "Phone":
                      return l.phone;
                    case "Mobile":
                      return l.mobile;
                    case "Email":
                      return l.email;
                    case "GSTIN":
                      return l.gstin;
                    case "PAN":
                      return l.pan;
                    case "Registration Type":
                      return l.registrationType;
                    case "Opening Balance":
                      return l.openingBalance
                        ? `${fmt(l.openingBalance)} ${l.openingBalanceType}`
                        : "—";
                    case "Account Type":
                      return l.accountType;
                    case "Credit Limit":
                      return l.creditLimit ? `Rs. ${l.creditLimit.toLocaleString()}` : "No limit";
                    case "TDS Applicable":
                      return l.tdsApplicable ? "Yes" : "No";
                    default:
                      return "";
                  }
                })();
                if (!val) return null;
                return (
                  <div key={f}>
                    <span className="text-[10px] text-gray-400">{f}: </span>
                    <span className="text-[11px] text-gray-700 font-medium">{val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Status bar ── */}
        <div className="px-4 py-1 bg-[#f5f6fa] border-t border-gray-200 text-[10px] text-gray-500 flex items-center gap-4">
          <span>
            Total Groups: <strong>{allGroups.length}</strong>
          </span>
          <span>
            Primary: <strong>{allGroups.filter((g) => g.isPrimary).length}</strong>
          </span>
          <span>
            Sub-Groups: <strong>{allGroups.filter((g) => !g.isPrimary).length}</strong>
          </span>
          <span>
            Ledgers: <strong>{allLedgers.length}</strong>
          </span>
          {features.subLedgers && (
            <span>
              Sub-Ledgers:{" "}
              <strong>{allLedgers.filter((l) => l.ledgerType === "Sub Ledger").length}</strong>
            </span>
          )}
          <span className="ml-auto">F3=Add Ledger · Double-click=Edit · Esc=Cancel</span>
        </div>
      </div>
    </div>
  );
};

export default ChartOfAccounts;
