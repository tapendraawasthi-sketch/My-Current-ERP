// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpDown,
  BookOpen,
  Calculator,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Info,
  Package,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  Upload,
  XCircle,
  X,
} from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId, stampMovementBranch } from "../lib/activeBranch";

const money = (v: any) =>
  `Rs. ${Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const btn =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-[var(--ds-action-primary)] text-white text-[12px] font-medium hover:bg-[var(--ds-action-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btn2 =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-white border border-gray-300 text-gray-700 text-[12px] font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnDanger =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-red-600 text-white text-[12px] font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const input =
  "w-full h-8 px-2.5 rounded-md border border-gray-300 bg-white text-[12px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const card = "bg-white border border-gray-200 rounded-lg shadow-sm p-4 text-gray-700";
const th =
  "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-200 align-top";

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();

const tableAll = (db: any, name: string) => {
  try {
    const t = db?.table ? db.table(name) : db?.[name];
    if (t?.toArray) return t.toArray().catch(() => []);
    return Promise.resolve([]);
  } catch {
    return Promise.resolve([]);
  }
};

const tablePut = async (db: any, name: string, rows: any[]) => {
  if (!rows?.length) return;
  const t = db?.table ? db.table(name) : db?.[name];
  if (!t?.bulkPut) throw new Error(`Table ${name} not found`);
  await t.bulkPut(rows);
};

const tableDelete = async (db: any, name: string, id: any) => {
  try {
    const t = db?.table ? db.table(name) : db?.[name];
    if (t?.delete) await t.delete(id);
  } catch (err) {
    console.warn("delete failed", name, err);
  }
};

const accountName = (accounts: any[], id: string) =>
  accounts.find((a) => a.id === id)?.name ||
  accounts.find((a) => a.accountId === id)?.name ||
  id ||
  "-";

const itemName = (items: any[], id: string) =>
  items.find((i) => i.id === id)?.name || items.find((i) => i.itemId === id)?.name || id || "-";

const warehouseName = (warehouses: any[], id: string) =>
  warehouses.find((w) => w.id === id)?.name ||
  warehouses.find((w) => w.warehouseId === id)?.name ||
  id ||
  "-";

const isAssetGroup = (a: any) => {
  const g = String(a.group || a.groupName || a.type || a.nature || "").toLowerCase();
  return (
    g.includes("asset") ||
    g.includes("cash") ||
    g.includes("bank") ||
    g.includes("debtor") ||
    g.includes("receivable")
  );
};

const isLiabilityGroup = (a: any) => {
  const g = String(a.group || a.groupName || a.type || a.nature || "").toLowerCase();
  return (
    g.includes("liability") ||
    g.includes("capital") ||
    g.includes("loan") ||
    g.includes("creditor") ||
    g.includes("payable")
  );
};

const defaultDrCrForAccount = (a: any) => {
  if (isLiabilityGroup(a)) return "Cr";
  return "Dr";
};

const normalizeOpeningRow = (row: any, type = "ledger") => ({
  id: row.id || generateId(),
  type,
  accountId: row.accountId || row.ledgerId || "",
  itemId: row.itemId || "",
  warehouseId: row.warehouseId || row.godownId || "",
  batchNo: row.batchNo || row.batch || "",
  qty: Number(row.qty || row.quantity || 0),
  rate: Number(row.rate || 0),
  value: Number(row.value || row.amount || 0),
  drCr: row.drCr || row.side || "Dr",
  billNo: row.billNo || row.referenceNo || row.refNo || "",
  billDate: row.billDate || row.date || "",
  dueDate: row.dueDate || "",
  narration: row.narration || row.note || "",
  fiscalYearId: row.fiscalYearId || "",
  createdAt: row.createdAt || nowISO(),
  updatedAt: nowISO(),
});

const readFileArrayBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

const makeAuditRow = (currentUser: any, action: string, narration: string, risk = "Medium") => ({
  id: generateId(),
  timestamp: nowISO(),
  date: todayISO(),
  userId: currentUser?.id || "",
  userName: currentUser?.name || currentUser?.username || "System",
  role: currentUser?.role || "",
  module: "Opening Balance",
  action,
  narration,
  status: "Success",
  risk,
  createdAt: nowISO(),
});

const Modal = ({ open, title, children, onClose }: any) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-[15px] font-semibold text-gray-700">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-200 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default function OpeningBalance() {
  const store = useStore();
  const { branchFilter, setBranchFilter, matchBranch, matchMovement, branchOptions } =
    useBranchFilter();
  const currentUser = store.currentUser || store.user || {};
  const storeAccounts = store.accounts || [];
  const storeItems = store.items || [];
  const storeWarehouses = store.warehouses || [];
  const storeFiscalYear = store.currentFiscalYear || store.fiscalYear || {};

  const [activeTab, setActiveTab] = useState("Ledger Opening");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [ledgerRows, setLedgerRows] = useState<any[]>([]);
  const [stockRows, setStockRows] = useState<any[]>([]);
  const [billRows, setBillRows] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("All");
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [modalType, setModalType] = useState("");
  const [importPreview, setImportPreview] = useState<any[]>([]);

  const [ledgerForm, setLedgerForm] = useState({
    accountId: "",
    value: 0,
    drCr: "Dr",
    narration: "",
  });

  const [stockForm, setStockForm] = useState({
    itemId: "",
    warehouseId: "",
    batchNo: "",
    qty: 0,
    rate: 0,
    value: 0,
    narration: "",
  });

  const [billForm, setBillForm] = useState({
    accountId: "",
    billNo: "",
    billDate: todayISO(),
    dueDate: "",
    value: 0,
    drCr: "Dr",
    narration: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    try {
      const db = getDB();

      const [
        dbAccounts,
        dbItems,
        dbWarehouses,
        dbOpeningBalances,
        dbOpeningStock,
        dbBillWiseOpening,
      ] = await Promise.all([
        tableAll(db, "accounts"),
        tableAll(db, "items"),
        tableAll(db, "warehouses"),
        tableAll(db, "openingBalances"),
        tableAll(db, "openingStock"),
        tableAll(db, "billWiseOpening"),
      ]);

      const acc = dbAccounts?.length ? dbAccounts : storeAccounts;
      const itm = dbItems?.length ? dbItems : storeItems;
      const wh = dbWarehouses?.length ? dbWarehouses : storeWarehouses;

      setAccounts(acc || []);
      setItems(itm || []);
      setWarehouses(wh || []);

      const allOpenings = dbOpeningBalances || [];
      setLedgerRows(
        allOpenings
          .filter((r) => !r.type || r.type === "ledger")
          .map((r) => normalizeOpeningRow(r, "ledger")),
      );

      setStockRows(
        (dbOpeningStock?.length
          ? dbOpeningStock
          : allOpenings.filter((r) => r.type === "stock")
        ).map((r) => normalizeOpeningRow(r, "stock")),
      );

      setBillRows(
        (dbBillWiseOpening?.length
          ? dbBillWiseOpening
          : allOpenings.filter((r) => r.type === "bill")
        ).map((r) => normalizeOpeningRow(r, "bill")),
      );
    } catch (err) {
      console.error(err);
      toast.error("Could not load opening balances");
    } finally {
      setLoading(false);
    }
  };

  const accountGroups = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(accounts.map((a) => a.group || a.groupName || a.type || a.nature).filter(Boolean)),
      ).sort(),
    ],
    [accounts],
  );

  const scopedLedgerRows = useMemo(
    () => ledgerRows.filter((r) => matchBranch(r.branchId)),
    [ledgerRows, matchBranch, branchFilter],
  );
  const scopedStockRows = useMemo(
    () =>
      stockRows.filter((r) =>
        matchMovement({ branchId: r.branchId, warehouseId: r.warehouseId }),
      ),
    [stockRows, matchMovement, branchFilter],
  );
  const scopedBillRows = useMemo(
    () => billRows.filter((r) => matchBranch(r.branchId)),
    [billRows, matchBranch, branchFilter],
  );

  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return accounts.filter((a) => {
      const group = a.group || a.groupName || a.type || a.nature || "";
      if (groupFilter !== "All" && group !== groupFilter) return false;
      if (!q) return true;
      return [a.name, a.code, a.alias, group].join(" ").toLowerCase().includes(q);
    });
  }, [accounts, query, groupFilter]);

  const ledgerGridRows = useMemo(() => {
    const map = Object.fromEntries(scopedLedgerRows.map((r) => [r.accountId, r]));

    return filteredAccounts.map((a) => {
      const r = map[a.id] || {};
      const side = r.drCr || defaultDrCrForAccount(a);
      const amount = Number(r.value || 0);

      return {
        id: r.id || "",
        accountId: a.id,
        accountName: a.name,
        group: a.group || a.groupName || a.type || a.nature || "",
        dr: side === "Dr" ? amount : 0,
        cr: side === "Cr" ? amount : 0,
        drCr: side,
        value: amount,
        narration: r.narration || "",
        source: r.id ? "Entered" : "Blank",
      };
    });
  }, [filteredAccounts, scopedLedgerRows]);

  const summary = useMemo(() => {
    const ledgerDr = scopedLedgerRows
      .filter((r) => r.drCr === "Dr")
      .reduce((sum, r) => sum + Number(r.value || 0), 0);
    const ledgerCr = scopedLedgerRows
      .filter((r) => r.drCr === "Cr")
      .reduce((sum, r) => sum + Number(r.value || 0), 0);
    const stockValue = scopedStockRows.reduce((sum, r) => sum + Number(r.value || 0), 0);
    const billDr = scopedBillRows
      .filter((r) => r.drCr === "Dr")
      .reduce((sum, r) => sum + Number(r.value || 0), 0);
    const billCr = scopedBillRows
      .filter((r) => r.drCr === "Cr")
      .reduce((sum, r) => sum + Number(r.value || 0), 0);

    return {
      ledgerDr,
      ledgerCr,
      diff: ledgerDr - ledgerCr,
      stockValue,
      billDr,
      billCr,
      billDiff: billDr - billCr,
      ledgerCount: scopedLedgerRows.length,
      stockCount: scopedStockRows.length,
      billCount: scopedBillRows.length,
    };
  }, [scopedLedgerRows, scopedStockRows, scopedBillRows]);

  const validationIssues = useMemo(() => {
    const issues: any[] = [];

    if (Math.abs(summary.diff) > 0.01) {
      issues.push({
        severity: "High",
        area: "Ledger Opening",
        message: `Opening trial balance difference is ${money(summary.diff)}`,
      });
    }

    ledgerRows.forEach((r) => {
      if (!r.accountId) {
        issues.push({
          severity: "High",
          area: "Ledger Opening",
          message: "Ledger opening row missing account",
        });
      }
      if (!["Dr", "Cr"].includes(r.drCr)) {
        issues.push({
          severity: "Warning",
          area: "Ledger Opening",
          message: `${accountName(accounts, r.accountId)} has invalid Dr/Cr`,
        });
      }
    });

    stockRows.forEach((r) => {
      if (!r.itemId) {
        issues.push({
          severity: "High",
          area: "Stock Opening",
          message: "Stock opening row missing item",
        });
      }
      if (Number(r.qty || 0) < 0) {
        issues.push({
          severity: "Warning",
          area: "Stock Opening",
          message: `${itemName(items, r.itemId)} has negative quantity`,
        });
      }
      if (Number(r.value || 0) !== Number(r.qty || 0) * Number(r.rate || 0)) {
        issues.push({
          severity: "Info",
          area: "Stock Opening",
          message: `${itemName(items, r.itemId)} value does not equal qty × rate`,
        });
      }
    });

    billRows.forEach((r) => {
      if (!r.accountId || !r.billNo) {
        issues.push({
          severity: "Warning",
          area: "Bill-wise Opening",
          message: "Bill-wise row missing party/account or bill no",
        });
      }
    });

    return issues;
  }, [summary, ledgerRows, stockRows, billRows, accounts, items]);

  const openLedgerModal = (row: any = null) => {
    if (row) {
      setLedgerForm({
        accountId: row.accountId || "",
        value: Number(row.value || row.dr || row.cr || 0),
        drCr: row.drCr || (Number(row.cr || 0) > 0 ? "Cr" : "Dr"),
        narration: row.narration || "",
      });
      setSelectedRow(row);
    } else {
      setLedgerForm({
        accountId: "",
        value: 0,
        drCr: "Dr",
        narration: "",
      });
      setSelectedRow(null);
    }
    setModalType("ledger");
  };

  const openStockModal = (row: any = null) => {
    if (row) {
      setStockForm({
        itemId: row.itemId || "",
        warehouseId: row.warehouseId || "",
        batchNo: row.batchNo || "",
        qty: Number(row.qty || 0),
        rate: Number(row.rate || 0),
        value: Number(row.value || 0),
        narration: row.narration || "",
      });
      setSelectedRow(row);
    } else {
      setStockForm({
        itemId: "",
        warehouseId: warehouses[0]?.id || "",
        batchNo: "",
        qty: 0,
        rate: 0,
        value: 0,
        narration: "",
      });
      setSelectedRow(null);
    }
    setModalType("stock");
  };

  const openBillModal = (row: any = null) => {
    if (row) {
      setBillForm({
        accountId: row.accountId || "",
        billNo: row.billNo || "",
        billDate: row.billDate || todayISO(),
        dueDate: row.dueDate || "",
        value: Number(row.value || 0),
        drCr: row.drCr || "Dr",
        narration: row.narration || "",
      });
      setSelectedRow(row);
    } else {
      setBillForm({
        accountId: "",
        billNo: "",
        billDate: todayISO(),
        dueDate: "",
        value: 0,
        drCr: "Dr",
        narration: "",
      });
      setSelectedRow(null);
    }
    setModalType("bill");
  };

  const saveLedgerOpening = async () => {
    if (!ledgerForm.accountId) {
      toast.error("Select account");
      return;
    }

    const row = normalizeOpeningRow(
      {
        id:
          selectedRow?.id ||
          ledgerRows.find((r) => r.accountId === ledgerForm.accountId)?.id ||
          generateId(),
        type: "ledger",
        accountId: ledgerForm.accountId,
        value: Number(ledgerForm.value || 0),
        drCr: ledgerForm.drCr,
        narration: ledgerForm.narration,
        fiscalYearId: storeFiscalYear?.id || "",
        createdAt: selectedRow?.createdAt || nowISO(),
        branchId: selectedRow?.branchId || readActiveBranchId() || undefined,
      },
      "ledger",
    );

    try {
      const db = getDB();
      await tablePut(db, "openingBalances", [row]);
      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "Ledger Opening Saved",
          `${accountName(accounts, row.accountId)} ${row.drCr} ${money(row.value)}`,
          "Medium",
        ),
      ]);

      setLedgerRows((prev) => [
        row,
        ...prev.filter((r) => r.id !== row.id && r.accountId !== row.accountId),
      ]);
      setModalType("");
      toast.success("Ledger opening saved");
    } catch (err) {
      console.error(err);
      toast.error("Could not save ledger opening");
    }
  };

  const saveStockOpening = async () => {
    if (!stockForm.itemId) {
      toast.error("Select item");
      return;
    }

    const computedValue =
      Number(stockForm.value || 0) || Number(stockForm.qty || 0) * Number(stockForm.rate || 0);

    const row = normalizeOpeningRow(
      {
        id: selectedRow?.id || generateId(),
        type: "stock",
        itemId: stockForm.itemId,
        warehouseId: stockForm.warehouseId,
        batchNo: stockForm.batchNo,
        qty: Number(stockForm.qty || 0),
        rate: Number(stockForm.rate || 0),
        value: computedValue,
        narration: stockForm.narration,
        fiscalYearId: storeFiscalYear?.id || "",
        createdAt: selectedRow?.createdAt || nowISO(),
        branchId: selectedRow?.branchId || readActiveBranchId() || undefined,
      },
      "stock",
    );

    try {
      const db = getDB();
      await tablePut(db, "openingStock", [row]);
      await tablePut(db, "openingBalances", [row]);

      const stockMovement = stampMovementBranch(
        {
          id: `ob-stock-${row.id}`,
          date: storeFiscalYear?.startDate || todayISO(),
          type: "opening",
          itemId: row.itemId,
          warehouseId: row.warehouseId,
          qtyIn: row.qty,
          qtyOut: 0,
          qty: row.qty,
          rate: row.rate,
          value: row.value,
          narration: `Opening stock ${row.batchNo ? `Batch ${row.batchNo}` : ""}`,
          sourceType: "openingBalance",
          sourceId: row.id,
          createdAt: nowISO(),
          branchId: row.branchId,
        },
        warehouses,
      );

      await tablePut(db, "stockMovements", [stockMovement]);
      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "Stock Opening Saved",
          `${itemName(items, row.itemId)} Qty ${row.qty} Value ${money(row.value)}`,
          "Medium",
        ),
      ]);

      setStockRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
      setModalType("");
      toast.success("Stock opening saved");
    } catch (err) {
      console.error(err);
      toast.error("Could not save stock opening");
    }
  };

  const saveBillOpening = async () => {
    if (!billForm.accountId || !billForm.billNo) {
      toast.error("Select party/account and enter bill no");
      return;
    }

    const row = normalizeOpeningRow(
      {
        id: selectedRow?.id || generateId(),
        type: "bill",
        accountId: billForm.accountId,
        billNo: billForm.billNo,
        billDate: billForm.billDate,
        dueDate: billForm.dueDate,
        value: Number(billForm.value || 0),
        drCr: billForm.drCr,
        narration: billForm.narration,
        fiscalYearId: storeFiscalYear?.id || "",
        createdAt: selectedRow?.createdAt || nowISO(),
        branchId: selectedRow?.branchId || readActiveBranchId() || undefined,
      },
      "bill",
    );

    try {
      const db = getDB();
      await tablePut(db, "billWiseOpening", [row]);
      await tablePut(db, "openingBalances", [row]);
      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "Bill-wise Opening Saved",
          `${accountName(accounts, row.accountId)} Bill ${row.billNo} ${row.drCr} ${money(row.value)}`,
          "Medium",
        ),
      ]);

      setBillRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
      setModalType("");
      toast.success("Bill-wise opening saved");
    } catch (err) {
      console.error(err);
      toast.error("Could not save bill-wise opening");
    }
  };

  const deleteRow = async (type: string, row: any) => {
    if (!confirm("Delete this opening balance row?")) return;

    try {
      const db = getDB();

      if (type === "ledger") {
        await tableDelete(db, "openingBalances", row.id);
        setLedgerRows((prev) => prev.filter((r) => r.id !== row.id));
      }

      if (type === "stock") {
        await tableDelete(db, "openingStock", row.id);
        await tableDelete(db, "openingBalances", row.id);
        await tableDelete(db, "stockMovements", `ob-stock-${row.id}`);
        setStockRows((prev) => prev.filter((r) => r.id !== row.id));
      }

      if (type === "bill") {
        await tableDelete(db, "billWiseOpening", row.id);
        await tableDelete(db, "openingBalances", row.id);
        setBillRows((prev) => prev.filter((r) => r.id !== row.id));
      }

      await tablePut(db, "auditLogs", [
        makeAuditRow(currentUser, "Opening Balance Deleted", `${type} row deleted`, "High"),
      ]);

      toast.success("Opening row deleted");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete opening row");
    }
  };

  const postOpeningVoucher = async () => {
    if (Math.abs(summary.diff) > 0.01) {
      toast.error("Opening balance is not balanced");
      return;
    }

    if (!ledgerRows.length) {
      toast.error("No ledger opening rows to post");
      return;
    }

    try {
      const db = getDB();

      // Guard: prevent double-posting. Check if an opening voucher already exists
      // for this fiscal year and delete it before re-posting.
      const fyId = storeFiscalYear?.id || "";
      const existingOBVouchers = await (db as any).vouchers
        .filter((v: any) => v.type === "opening" && v.fiscalYearId === fyId)
        .toArray();
      if (existingOBVouchers.length > 0) {
        // Reverse balance impacts of the old opening voucher before replacing it.
        for (const oldV of existingOBVouchers) {
          for (const line of oldV.lines || []) {
            if (line.accountId) {
              const acc = await db.accounts.get(line.accountId);
              if (acc) {
                const reversed =
                  Math.round(((acc.balance || 0) - (line.debit || 0) + (line.credit || 0)) * 100) /
                  100;
                await db.accounts.update(line.accountId, { balance: reversed });
              }
            }
          }
          await (db as any).vouchers.delete(oldV.id);
        }
        toast("Existing opening balance replaced.", { icon: "ℹ️" });
      }

      const lines = ledgerRows.map((r) => ({
        id: generateId(),
        accountId: r.accountId,
        debit: r.drCr === "Dr" ? Number(r.value || 0) : 0,
        credit: r.drCr === "Cr" ? Number(r.value || 0) : 0,
        narration: r.narration || "Opening balance",
      }));

      const voucher = {
        id: generateId(),
        voucherNo: `OB-${todayISO().split("-").join("")}`,
        type: "opening",
        date: storeFiscalYear?.startDate || todayISO(),
        narration: "Opening balance voucher",
        lines,
        totalDebit: summary.ledgerDr,
        totalCredit: summary.ledgerCr,
        status: "posted",
        fiscalYearId: storeFiscalYear?.id || "",
        createdBy: currentUser?.id || "",
        createdAt: nowISO(),
      };

      await tablePut(db, "vouchers", [voucher]);
      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "Opening Voucher Posted",
          `Opening voucher ${voucher.voucherNo} posted with ${lines.length} lines`,
          "High",
        ),
      ]);

      if (store.addVoucher) {
        try {
          store.addVoucher(voucher);
        } catch {
          // store fallback ignored
        }
      }

      toast.success("Opening voucher posted");
    } catch (err) {
      console.error(err);
      toast.error("Could not post opening voucher");
    }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        ledgerRows.map((r) => ({
          Account: accountName(accounts, r.accountId),
          AccountId: r.accountId,
          DrCr: r.drCr,
          Amount: r.value,
          Narration: r.narration,
        })),
      ),
      "Ledger Opening",
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        stockRows.map((r) => ({
          Item: itemName(items, r.itemId),
          ItemId: r.itemId,
          Warehouse: warehouseName(warehouses, r.warehouseId),
          WarehouseId: r.warehouseId,
          BatchNo: r.batchNo,
          Qty: r.qty,
          Rate: r.rate,
          Value: r.value,
          Narration: r.narration,
        })),
      ),
      "Stock Opening",
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        billRows.map((r) => ({
          Account: accountName(accounts, r.accountId),
          AccountId: r.accountId,
          BillNo: r.billNo,
          BillDate: r.billDate,
          DueDate: r.dueDate,
          DrCr: r.drCr,
          Amount: r.value,
          Narration: r.narration,
        })),
      ),
      "Billwise Opening",
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Metric: "Ledger Debit", Value: summary.ledgerDr },
        { Metric: "Ledger Credit", Value: summary.ledgerCr },
        { Metric: "Difference", Value: summary.diff },
        { Metric: "Stock Value", Value: summary.stockValue },
        { Metric: "Bill Debit", Value: summary.billDr },
        { Metric: "Bill Credit", Value: summary.billCr },
      ]),
      "Summary",
    );

    XLSX.writeFile(wb, `Opening_Balance_${todayISO()}.xlsx`);
    toast.success("Opening balance exported");
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          AccountName: "Cash",
          AccountId: "",
          DrCr: "Dr",
          Amount: 0,
          Narration: "Opening cash balance",
        },
      ]),
      "Ledger Opening",
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          ItemName: "Sample Item",
          ItemId: "",
          WarehouseName: "Main Warehouse",
          WarehouseId: "",
          BatchNo: "",
          Qty: 0,
          Rate: 0,
          Value: 0,
          Narration: "Opening stock",
        },
      ]),
      "Stock Opening",
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          AccountName: "Customer",
          AccountId: "",
          BillNo: "OB-001",
          BillDate: todayISO(),
          DueDate: todayISO(),
          DrCr: "Dr",
          Amount: 0,
          Narration: "Opening bill",
        },
      ]),
      "Billwise Opening",
    );

    XLSX.writeFile(wb, `Opening_Balance_Template_${todayISO()}.xlsx`);
    toast.success("Template downloaded");
  };

  const importExcel = async (file: File) => {
    try {
      setLoading(true);
      const buf = await readFileArrayBuffer(file);
      const wb = XLSX.read(buf, { type: "array" });

      const previews: any[] = [];

      if (wb.Sheets["Ledger Opening"]) {
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets["Ledger Opening"], { defval: "" });
        rows.forEach((r) =>
          previews.push({
            type: "ledger",
            accountId:
              r.AccountId ||
              accounts.find(
                (a) => String(a.name).toLowerCase() === String(r.AccountName).toLowerCase(),
              )?.id ||
              "",
            drCr: r.DrCr || "Dr",
            value: Number(r.Amount || r.Value || 0),
            narration: r.Narration || "",
            raw: r,
          }),
        );
      }

      if (wb.Sheets["Stock Opening"]) {
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets["Stock Opening"], { defval: "" });
        rows.forEach((r) =>
          previews.push({
            type: "stock",
            itemId:
              r.ItemId ||
              items.find((i) => String(i.name).toLowerCase() === String(r.ItemName).toLowerCase())
                ?.id ||
              "",
            warehouseId:
              r.WarehouseId ||
              warehouses.find(
                (w) => String(w.name).toLowerCase() === String(r.WarehouseName).toLowerCase(),
              )?.id ||
              warehouses[0]?.id ||
              "",
            batchNo: r.BatchNo || "",
            qty: Number(r.Qty || 0),
            rate: Number(r.Rate || 0),
            value: Number(r.Value || 0),
            narration: r.Narration || "",
            raw: r,
          }),
        );
      }

      if (wb.Sheets["Billwise Opening"]) {
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets["Billwise Opening"], { defval: "" });
        rows.forEach((r) =>
          previews.push({
            type: "bill",
            accountId:
              r.AccountId ||
              accounts.find(
                (a) => String(a.name).toLowerCase() === String(r.AccountName).toLowerCase(),
              )?.id ||
              "",
            billNo: r.BillNo || "",
            billDate: r.BillDate || todayISO(),
            dueDate: r.DueDate || "",
            drCr: r.DrCr || "Dr",
            value: Number(r.Amount || r.Value || 0),
            narration: r.Narration || "",
            raw: r,
          }),
        );
      }

      setImportPreview(previews);
      setModalType("import");
      toast.success(`${previews.length} rows loaded for import preview`);
    } catch (err) {
      console.error(err);
      toast.error("Could not import Excel file");
    } finally {
      setLoading(false);
    }
  };

  const commitImport = async () => {
    if (!importPreview.length) {
      toast.error("No rows to import");
      return;
    }

    const bad = importPreview.filter((r) => {
      if (r.type === "ledger" || r.type === "bill") return !r.accountId;
      if (r.type === "stock") return !r.itemId;
      return false;
    });

    if (bad.length) {
      toast.error(`${bad.length} rows have missing account/item mapping`);
      return;
    }

    try {
      const db = getDB();

      const l = importPreview
        .filter((r) => r.type === "ledger")
        .map((r) =>
          normalizeOpeningRow(
            {
              ...r,
              id: generateId(),
              fiscalYearId: storeFiscalYear?.id || "",
              createdAt: nowISO(),
            },
            "ledger",
          ),
        );

      const s = importPreview
        .filter((r) => r.type === "stock")
        .map((r) =>
          normalizeOpeningRow(
            {
              ...r,
              id: generateId(),
              fiscalYearId: storeFiscalYear?.id || "",
              createdAt: nowISO(),
              value: Number(r.value || 0) || Number(r.qty || 0) * Number(r.rate || 0),
            },
            "stock",
          ),
        );

      const b = importPreview
        .filter((r) => r.type === "bill")
        .map((r) =>
          normalizeOpeningRow(
            {
              ...r,
              id: generateId(),
              fiscalYearId: storeFiscalYear?.id || "",
              createdAt: nowISO(),
            },
            "bill",
          ),
        );

      await tablePut(db, "openingBalances", [...l, ...s, ...b]);
      await tablePut(db, "openingStock", s);
      await tablePut(db, "billWiseOpening", b);

      await tablePut(
        db,
        "stockMovements",
        s.map((r) => ({
          id: `ob-stock-${r.id}`,
          date: storeFiscalYear?.startDate || todayISO(),
          type: "opening",
          itemId: r.itemId,
          warehouseId: r.warehouseId,
          qtyIn: r.qty,
          qtyOut: 0,
          qty: r.qty,
          rate: r.rate,
          value: r.value,
          narration: "Imported opening stock",
          sourceType: "openingBalance",
          sourceId: r.id,
          createdAt: nowISO(),
        })),
      );

      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "Opening Balance Imported",
          `${importPreview.length} rows imported from Excel`,
          "High",
        ),
      ]);

      setLedgerRows((prev) => [...l, ...prev]);
      setStockRows((prev) => [...s, ...prev]);
      setBillRows((prev) => [...b, ...prev]);

      setImportPreview([]);
      setModalType("");
      toast.success("Opening balances imported");
    } catch (err) {
      console.error(err);
      toast.error("Could not commit import");
    }
  };

  const renderSummary = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
      <div className={card}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Ledger Debit
            </p>
            <p className="text-xl font-semibold mt-1">{money(summary.ledgerDr)}</p>
          </div>
          <ArrowDownToLine className="h-5 w-5 text-[var(--ds-action-primary)]" />
        </div>
      </div>

      <div className={card}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Ledger Credit
            </p>
            <p className="text-xl font-semibold mt-1">{money(summary.ledgerCr)}</p>
          </div>
          <ArrowUpDown className="h-5 w-5 text-[var(--ds-action-primary)]" />
        </div>
      </div>

      <div className={card}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Difference
            </p>
            <p
              className={`text-xl font-semibold mt-1 ${Math.abs(summary.diff) > 0.01 ? "text-red-600" : "text-emerald-600"}`}
            >
              {money(summary.diff)}
            </p>
          </div>
          {Math.abs(summary.diff) > 0.01 ? (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          )}
        </div>
      </div>

      <div className={card}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Stock Value
            </p>
            <p className="text-xl font-semibold mt-1">{money(summary.stockValue)}</p>
          </div>
          <Package className="h-5 w-5 text-[var(--ds-action-primary)]" />
        </div>
      </div>
    </div>
  );

  const renderToolbar = () => (
    <>
      <input
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        id="opening-import-file"
        onChange={(e) => e.target.files?.[0] && importExcel(e.target.files[0])}
      />
      <label htmlFor="opening-import-file" className={`${btn2} cursor-pointer`}>
        <Upload className="h-3 w-3" />
        Import Excel
      </label>
      <button className={btn2} onClick={downloadTemplate}>
        <FileSpreadsheet className="h-3 w-3" />
        Template
      </button>
      <button className={btn2} onClick={exportExcel}>
        <Download className="h-3 w-3" />
        Export
      </button>
      <button className={btn} onClick={postOpeningVoucher}>
        <Save className="h-3 w-3" />
        Post Voucher
      </button>
    </>
  );

  const renderLedger = () => (
    <div className="space-y-4">
      <div className={card}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="text-[11px] font-medium text-gray-600 block mb-1">
              Search Account
            </label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-2 text-gray-400" />
              <input
                className={`${input} pl-8`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search account, group, code..."
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Group</label>
            <select
              className={input}
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              {accountGroups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className={btn} onClick={() => openLedgerModal()}>
              <Plus className="h-3 w-3" /> Add Opening
            </button>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-auto max-h-[58vh]">
          <table className="w-full min-w-[900px] text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
              <tr>
                <th className={th}>Account</th>
                <th className={th}>Group</th>
                <th className={`${th} text-right`}>Debit</th>
                <th className={`${th} text-right`}>Credit</th>
                <th className={th}>Narration</th>
                <th className={th}>Status</th>
                <th className={`${th} text-center`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {ledgerGridRows.map((r) => (
                <tr key={r.accountId} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className={`${td} font-medium text-gray-700`}>{r.accountName}</td>
                  <td className={td}>{r.group || "-"}</td>
                  <td className={`${td} text-right font-medium`}>{r.dr ? money(r.dr) : "-"}</td>
                  <td className={`${td} text-right font-medium`}>{r.cr ? money(r.cr) : "-"}</td>
                  <td className={td}>{r.narration || "-"}</td>
                  <td className={td}>
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                        r.source === "Entered"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                      }`}
                    >
                      {r.source}
                    </span>
                  </td>
                  <td className={`${td} text-center p-1`}>
                    <div className="inline-flex gap-1 items-center justify-center">
                      <button
                        className="p-1 rounded-lg text-gray-400 hover:text-[var(--ds-action-primary)] hover:bg-gray-100 transition-colors"
                        onClick={() => openLedgerModal(r)}
                      >
                        <Calculator className="h-4 w-4" />
                      </button>
                      {r.id && (
                        <button
                          className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          onClick={() => deleteRow("ledger", r)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!ledgerGridRows.length && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[12px] text-gray-500">
                    No accounts found.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className={`${td} font-semibold`} colSpan={2}>
                  Total
                </td>
                <td className={`${td} text-right font-semibold`}>{money(summary.ledgerDr)}</td>
                <td className={`${td} text-right font-semibold`}>{money(summary.ledgerCr)}</td>
                <td className={`${td} font-semibold`} colSpan={3}>
                  Difference: {money(summary.diff)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );

  const renderStock = () => (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" /> Stock Opening
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Enter opening item quantity, warehouse, batch and valuation.
            </p>
          </div>
          <button className={btn} onClick={() => openStockModal()}>
            <Plus className="h-3 w-3" /> Add Stock Opening
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-auto max-h-[58vh]">
          <table className="w-full min-w-[900px] text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 bg-gray-50 shadow-sm">
              <tr>
                <th className={th}>Item</th>
                <th className={th}>Warehouse</th>
                <th className={th}>Batch</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={`${th} text-right`}>Rate</th>
                <th className={`${th} text-right`}>Value</th>
                <th className={th}>Narration</th>
                <th className={`${th} text-center`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {scopedStockRows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className={`${td} font-medium text-gray-700`}>{itemName(items, r.itemId)}</td>
                  <td className={td}>{warehouseName(warehouses, r.warehouseId)}</td>
                  <td className={td}>{r.batchNo || "-"}</td>
                  <td className={`${td} text-right font-medium`}>
                    {Number(r.qty || 0).toFixed(2)}
                  </td>
                  <td className={`${td} text-right`}>{money(r.rate)}</td>
                  <td className={`${td} text-right font-medium`}>{money(r.value)}</td>
                  <td className={td}>{r.narration || "-"}</td>
                  <td className={`${td} text-center p-1`}>
                    <div className="inline-flex gap-1 items-center justify-center">
                      <button
                        className="p-1 rounded-lg text-gray-400 hover:text-[var(--ds-action-primary)] hover:bg-gray-100 transition-colors"
                        onClick={() => openStockModal(r)}
                      >
                        <Calculator className="h-4 w-4" />
                      </button>
                      <button
                        className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        onClick={() => deleteRow("stock", r)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!stockRows.length && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[12px] text-gray-500">
                    No stock opening rows entered.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className={`${td} font-semibold`} colSpan={5}>
                  Total Stock Value
                </td>
                <td className={`${td} text-right font-semibold`}>{money(summary.stockValue)}</td>
                <td colSpan={2} className={td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBillwise = () => (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-gray-500" /> Bill-wise Opening
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Enter pending customer/supplier bills for opening receivables and payables.
            </p>
          </div>
          <button className={btn} onClick={() => openBillModal()}>
            <Plus className="h-3 w-3" /> Add Bill Opening
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-auto max-h-[58vh]">
          <table className="w-full min-w-[950px] text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 bg-gray-50 shadow-sm">
              <tr>
                <th className={th}>Party / Account</th>
                <th className={th}>Bill No</th>
                <th className={th}>Bill Date</th>
                <th className={th}>Due Date</th>
                <th className={th}>Dr/Cr</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={th}>Narration</th>
                <th className={`${th} text-center`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {scopedBillRows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className={`${td} font-medium text-gray-700`}>
                    {accountName(accounts, r.accountId)}
                  </td>
                  <td className={td}>{r.billNo}</td>
                  <td className={td}>{r.billDate || "-"}</td>
                  <td className={td}>{r.dueDate || "-"}</td>
                  <td className={td}>
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                        r.drCr === "Dr"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {r.drCr}
                    </span>
                  </td>
                  <td className={`${td} text-right font-medium`}>{money(r.value)}</td>
                  <td className={td}>{r.narration || "-"}</td>
                  <td className={`${td} text-center p-1`}>
                    <div className="inline-flex gap-1 items-center justify-center">
                      <button
                        className="p-1 rounded-lg text-gray-400 hover:text-[var(--ds-action-primary)] hover:bg-gray-100 transition-colors"
                        onClick={() => openBillModal(r)}
                      >
                        <Calculator className="h-4 w-4" />
                      </button>
                      <button
                        className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        onClick={() => deleteRow("bill", r)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!billRows.length && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[12px] text-gray-500">
                    No bill-wise opening rows entered.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className={`${td} font-semibold`} colSpan={5}>
                  Bill-wise Totals
                </td>
                <td className={`${td} text-right font-semibold`}>
                  Dr {money(summary.billDr)} / Cr {money(summary.billCr)}
                </td>
                <td colSpan={2} className={td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );

  const renderValidation = () => (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-gray-500" /> Validation & Control Summary
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Review balance difference, missing mappings and valuation inconsistencies before
              posting.
            </p>
          </div>
          <button className={btn2} onClick={loadData}>
            <RefreshCcw className="h-3 w-3" /> Recalculate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={card}>
          <h4 className="text-[13px] font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-gray-500" /> Control Totals
          </h4>
          <div className="space-y-1">
            {[
              ["Ledger Opening Rows", summary.ledgerCount],
              ["Stock Opening Rows", summary.stockCount],
              ["Bill-wise Opening Rows", summary.billCount],
              ["Ledger Debit", money(summary.ledgerDr)],
              ["Ledger Credit", money(summary.ledgerCr)],
              ["Ledger Difference", money(summary.diff)],
              ["Stock Value", money(summary.stockValue)],
              ["Bill Debit", money(summary.billDr)],
              ["Bill Credit", money(summary.billCr)],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between border-b border-gray-100 py-2 last:border-0"
              >
                <span className="text-[12px] text-gray-600 font-medium">{k}</span>
                <span className="text-[12px] font-semibold text-gray-700">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={card}>
          <h4 className="text-[13px] font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-gray-500" /> Validation Issues
          </h4>
          <div className="space-y-2 max-h-96 overflow-auto">
            {validationIssues.map((i, idx) => (
              <div
                key={idx}
                className={`border rounded-md p-3 ${
                  i.severity === "High"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : i.severity === "Warning"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-blue-200 bg-blue-50 text-blue-800"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-semibold text-[11px] uppercase tracking-wide">
                    {i.area}
                  </span>
                  <span className="font-semibold text-[11px] uppercase tracking-wide">
                    {i.severity}
                  </span>
                </div>
                <p className="text-[12px] mt-1">{i.message}</p>
              </div>
            ))}
            {!validationIssues.length && (
              <div className="p-8 text-center text-[12px] text-gray-500 font-medium border border-dashed border-gray-300 rounded-lg">
                No validation issues found. Balances look good!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 text-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--ds-action-primary)]" /> Opening Balances
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Manage ledger, stock, and bill-wise opening balances for the fiscal year.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {branchOptions.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              aria-label="Branch"
            >
              <option value="all">All branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.code || b.id}
                </option>
              ))}
            </select>
          )}
          {renderToolbar()}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 pb-2">
        {[
          ["Ledger Opening", BookOpen],
          ["Stock Opening", Package],
          ["Bill-wise Opening", FileSpreadsheet],
          ["Validation", CheckCircle2],
        ].map(([name, Icon]: any) => (
          <button
            key={name}
            onClick={() => setActiveTab(name)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              activeTab === name
                ? "bg-[var(--ds-action-primary)] text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {name}
          </button>
        ))}
      </div>

      {loading && (
        <div className={`${card} mb-4 flex items-center gap-2 text-[12px] text-gray-600`}>
          <RefreshCcw className="h-4 w-4 animate-spin text-[var(--ds-action-primary)]" /> Loading opening balances...
        </div>
      )}

      {renderSummary()}
      <div className="mt-4">
        {activeTab === "Ledger Opening" && renderLedger()}
        {activeTab === "Stock Opening" && renderStock()}
        {activeTab === "Bill-wise Opening" && renderBillwise()}
        {activeTab === "Validation" && renderValidation()}
      </div>

      <Modal
        open={modalType === "ledger"}
        title={selectedRow ? "Edit Ledger Opening" : "Add Ledger Opening"}
        onClose={() => setModalType("")}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Account</label>
            <select
              className={input}
              value={ledgerForm.accountId}
              onChange={(e) => setLedgerForm({ ...ledgerForm, accountId: e.target.value })}
            >
              <option value="">Select Account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Amount</label>
              <input
                type="number"
                className={input}
                value={ledgerForm.value || ""}
                onChange={(e) => setLedgerForm({ ...ledgerForm, value: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Dr / Cr</label>
              <select
                className={input}
                value={ledgerForm.drCr}
                onChange={(e) => setLedgerForm({ ...ledgerForm, drCr: e.target.value })}
              >
                <option value="Dr">Dr</option>
                <option value="Cr">Cr</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Narration</label>
            <input
              className={input}
              value={ledgerForm.narration}
              onChange={(e) => setLedgerForm({ ...ledgerForm, narration: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 mt-2">
            <button className={btn2} onClick={() => setModalType("")}>
              Cancel
            </button>
            <button className={btn} onClick={saveLedgerOpening}>
              <Save className="h-3 w-3" /> Save Opening
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={modalType === "stock"}
        title={selectedRow ? "Edit Stock Opening" : "Add Stock Opening"}
        onClose={() => setModalType("")}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Item</label>
            <select
              className={input}
              value={stockForm.itemId}
              onChange={(e) => setStockForm({ ...stockForm, itemId: e.target.value })}
            >
              <option value="">Select Item...</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Warehouse</label>
              <select
                className={input}
                value={stockForm.warehouseId}
                onChange={(e) => setStockForm({ ...stockForm, warehouseId: e.target.value })}
              >
                <option value="">Select Warehouse...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Batch No</label>
              <input
                className={input}
                value={stockForm.batchNo}
                onChange={(e) => setStockForm({ ...stockForm, batchNo: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Quantity</label>
              <input
                type="number"
                className={input}
                value={stockForm.qty || ""}
                onChange={(e) => setStockForm({ ...stockForm, qty: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Rate</label>
              <input
                type="number"
                className={input}
                value={stockForm.rate || ""}
                onChange={(e) => setStockForm({ ...stockForm, rate: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Value</label>
              <input
                type="number"
                className={input}
                value={stockForm.value || ""}
                onChange={(e) => setStockForm({ ...stockForm, value: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Narration</label>
            <input
              className={input}
              value={stockForm.narration}
              onChange={(e) => setStockForm({ ...stockForm, narration: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 mt-2">
            <button className={btn2} onClick={() => setModalType("")}>
              Cancel
            </button>
            <button className={btn} onClick={saveStockOpening}>
              <Save className="h-3 w-3" /> Save Opening
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={modalType === "bill"}
        title={selectedRow ? "Edit Bill Opening" : "Add Bill Opening"}
        onClose={() => setModalType("")}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Party / Account
            </label>
            <select
              className={input}
              value={billForm.accountId}
              onChange={(e) => setBillForm({ ...billForm, accountId: e.target.value })}
            >
              <option value="">Select Account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Bill No</label>
              <input
                className={input}
                value={billForm.billNo}
                onChange={(e) => setBillForm({ ...billForm, billNo: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Bill Date</label>
              <input
                type="date"
                className={input}
                value={billForm.billDate}
                onChange={(e) => setBillForm({ ...billForm, billDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Due Date</label>
              <input
                type="date"
                className={input}
                value={billForm.dueDate}
                onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Amount</label>
              <input
                type="number"
                className={input}
                value={billForm.value || ""}
                onChange={(e) => setBillForm({ ...billForm, value: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Dr / Cr</label>
              <select
                className={input}
                value={billForm.drCr}
                onChange={(e) => setBillForm({ ...billForm, drCr: e.target.value })}
              >
                <option value="Dr">Dr</option>
                <option value="Cr">Cr</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Narration</label>
            <input
              className={input}
              value={billForm.narration}
              onChange={(e) => setBillForm({ ...billForm, narration: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 mt-2">
            <button className={btn2} onClick={() => setModalType("")}>
              Cancel
            </button>
            <button className={btn} onClick={saveBillOpening}>
              <Save className="h-3 w-3" /> Save Opening
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={modalType === "import"}
        title="Preview Excel Import"
        onClose={() => setModalType("")}
      >
        <div className="space-y-4">
          <div className="p-3 rounded-md border border-blue-200 bg-blue-50 text-blue-800 flex gap-2 items-start">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-semibold">Import validation</p>
              <p className="text-[11px] mt-1 opacity-90">
                Rows with missing account/item mapping must be corrected in Excel or master data
                before import.
              </p>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="overflow-auto max-h-96">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="sticky top-0 bg-gray-50 shadow-sm">
                  <tr>
                    <th className={th}>Type</th>
                    <th className={th}>Master</th>
                    <th className={th}>Reference</th>
                    <th className={th}>Dr/Cr</th>
                    <th className={`${th} text-right`}>Qty</th>
                    <th className={`${th} text-right`}>Amount</th>
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((r, idx) => {
                    const ok = r.type === "stock" ? !!r.itemId : !!r.accountId;

                    return (
                      <tr
                        key={idx}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50"
                      >
                        <td className={td}>
                          <span className="inline-flex px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-medium uppercase text-gray-600">
                            {r.type}
                          </span>
                        </td>
                        <td className={`${td} font-medium text-gray-700`}>
                          {r.type === "stock"
                            ? itemName(items, r.itemId)
                            : accountName(accounts, r.accountId)}
                        </td>
                        <td className={td}>{r.billNo || r.batchNo || "-"}</td>
                        <td className={td}>{r.drCr || "-"}</td>
                        <td className={`${td} text-right font-medium`}>
                          {r.type === "stock" ? Number(r.qty || 0).toFixed(2) : "-"}
                        </td>
                        <td className={`${td} text-right font-semibold`}>{money(r.value || 0)}</td>
                        <td className={td}>
                          {ok ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium bg-red-50 text-red-700 border-red-200">
                              <XCircle className="h-3 w-3" /> Missing Mapping
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!importPreview.length && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[12px] text-gray-500">
                        No import rows loaded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t border-gray-200">
            <div className="text-[12px] text-gray-600">
              Total rows:{" "}
              <span className="font-semibold text-gray-700">{importPreview.length}</span>
              <span className="mx-2 text-gray-300">|</span>
              Invalid rows:{" "}
              <span className="font-semibold text-red-600">
                {
                  importPreview.filter((r) => (r.type === "stock" ? !r.itemId : !r.accountId))
                    .length
                }
              </span>
            </div>
            <div className="flex gap-2">
              <button className={btn2} onClick={() => setModalType("")}>
                Cancel
              </button>
              <button className={btn} onClick={commitImport}>
                <Upload className="h-3 w-3" /> Commit Import
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
