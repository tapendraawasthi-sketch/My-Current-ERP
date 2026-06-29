// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Banknote,
  Barcode,
  Calculator,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  History,
  Minus,
  Package,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  User,
  WalletCards,
  XCircle,
  Clock,
  LogOut,
  X,
  CreditCard as CardIcon,
} from "lucide-react";

const money = (v: any) =>
  `Rs. ${Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const btn =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-[#1557b0] text-white text-[12px] font-medium hover:bg-[#0f4a96] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btn2 =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-white border border-gray-300 text-gray-700 text-[12px] font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnDanger =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-red-600 text-white text-[12px] font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const input =
  "w-full h-8 px-2.5 rounded-md border border-gray-300 bg-white text-[12px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const card = "bg-white border border-gray-200 rounded-lg shadow-sm p-4 text-gray-800";
const th =
  "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-[#f5f6fa] border-b border-gray-200";
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

const itemName = (items: any[], id: string) =>
  items.find((i) => i.id === id)?.name || items.find((i) => i.itemId === id)?.name || id || "-";

const partyName = (parties: any[], id: string) =>
  parties.find((p) => p.id === id)?.name ||
  parties.find((p) => p.partyId === id)?.name ||
  "Walk-in Customer";

const warehouseName = (warehouses: any[], id: string) =>
  warehouses.find((w) => w.id === id)?.name ||
  warehouses.find((w) => w.warehouseId === id)?.name ||
  "Main Warehouse";

const findAccount = (accounts: any[], keywords: string[]) => {
  const words = keywords.map((x) => String(x).toLowerCase());
  return (
    accounts.find((a) =>
      words.some((w) =>
        [a.name, a.group, a.groupName, a.type, a.nature].join(" ").toLowerCase().includes(w),
      ),
    ) || {}
  );
};

const normalizePAN = (v: any) =>
  String(v || "")
    .replace(/\D/g, "")
    .slice(0, 9);

const stockForItem = (stockMovements: any[], itemId: string, warehouseId = "") => {
  return (stockMovements || [])
    .filter((m) => m.itemId === itemId && (!warehouseId || m.warehouseId === warehouseId))
    .reduce(
      (sum, m) => sum + Number(m.qtyIn || m.inQty || 0) - Number(m.qtyOut || m.outQty || 0),
      0,
    );
};

const lineNet = (l: any) => {
  const gross = Number(l.qty || 0) * Number(l.rate || 0);
  const disc = gross * (Number(l.discountPercent || 0) / 100) + Number(l.discountAmount || 0);
  const taxable = Math.max(0, gross - disc);
  const vat = l.taxable ? taxable * 0.13 : 0;

  return {
    gross,
    disc,
    taxable,
    vat,
    total: taxable + vat,
  };
};

const defaultPayment = () => ({
  cash: 0,
  card: 0,
  wallet: 0,
  bank: 0,
  credit: 0,
  referenceNo: "",
});

const paymentTotal = (p: any) =>
  Number(p.cash || 0) +
  Number(p.card || 0) +
  Number(p.wallet || 0) +
  Number(p.bank || 0) +
  Number(p.credit || 0);

const defaultSession = (currentUser: any) => ({
  id: generateId(),
  date: todayISO(),
  openedAt: nowISO(),
  closedAt: "",
  userId: currentUser?.id || "",
  userName: currentUser?.name || currentUser?.username || "Cashier",
  openingCash: 0,
  closingCash: 0,
  expectedCash: 0,
  variance: 0,
  status: "Open",
});

const makeAuditRow = (currentUser: any, action: string, narration: string, risk = "Low") => ({
  id: generateId(),
  timestamp: nowISO(),
  date: todayISO(),
  userId: currentUser?.id || "",
  userName: currentUser?.name || currentUser?.username || "System",
  role: currentUser?.role || "",
  module: "POS Mode",
  action,
  narration,
  status: "Success",
  risk,
  createdAt: nowISO(),
});

const receiptCss = `
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color:#000; }
    .receipt { width: 310px; margin: 0 auto; font-size: 12px; }
    .center { text-align:center; }
    .bold { font-weight: 800; }
    .row { display:flex; justify-content:space-between; gap:8px; }
    .line { border-top:1px dashed #000; margin:8px 0; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th, td { padding:2px 0; text-align:left; }
    .right { text-align:right; }
    @media print { button { display:none; } }
  </style>
`;

const Modal = ({ open, title, children, onClose, max = "max-w-5xl" }: any) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        className={`bg-white rounded-lg shadow-xl w-full ${max} max-h-[90vh] overflow-hidden flex flex-col`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[#f5f6fa] border-b border-gray-200">
          <h3 className="text-[15px] font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-200 text-gray-500">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 overflow-auto">{children}</div>
      </div>
    </div>
  );
};

export default function POSBilling() {
  const store = useStore();
  const currentUser = store.currentUser || store.user || {};
  const storeItems = store.items || [];
  const storeParties = store.parties || [];
  const storeAccounts = store.accounts || [];
  const storeWarehouses = store.warehouses || [];
  const storeStockMovements = store.stockMovements || [];
  const companySettings = store.companySettings || store.company || {};
  const fiscalYear = store.currentFiscalYear || store.fiscalYear || {};

  const barcodeRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("Billing");
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [holds, setHolds] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSession, setCurrentSession] = useState<any>(null);

  const [warehouseId, setWarehouseId] = useState("");
  const [partyId, setPartyId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [cart, setCart] = useState<any[]>([]);
  const [billDiscountPercent, setBillDiscountPercent] = useState(0);
  const [billDiscountAmount, setBillDiscountAmount] = useState(0);
  const [payment, setPayment] = useState<any>(defaultPayment());
  const [modalType, setModalType] = useState("");
  const [receiptData, setReceiptData] = useState<any>(null);
  const [openingCash, setOpeningCash] = useState(0);
  const [closingCash, setClosingCash] = useState(0);
  const [holdName, setHoldName] = useState("");
  const [saleDate, setSaleDate] = useState(todayISO());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!warehouseId && warehouses[0]?.id) setWarehouseId(warehouses[0].id);
  }, [warehouses, warehouseId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const db = getDB();
      const [
        dbItems,
        dbParties,
        dbAccounts,
        dbWarehouses,
        dbStock,
        dbInvoices,
        dbHolds,
        dbSessions,
      ] = await Promise.all([
        tableAll(db, "items"),
        tableAll(db, "parties"),
        tableAll(db, "accounts"),
        tableAll(db, "warehouses"),
        tableAll(db, "stockMovements"),
        tableAll(db, "invoices"),
        tableAll(db, "posHolds"),
        tableAll(db, "posSessions"),
      ]);

      const itemRows = dbItems?.length ? dbItems : storeItems;
      const partyRows = dbParties?.length ? dbParties : storeParties;
      const accountRows = dbAccounts?.length ? dbAccounts : storeAccounts;
      const warehouseRows = dbWarehouses?.length ? dbWarehouses : storeWarehouses;
      const stockRows = dbStock?.length ? dbStock : storeStockMovements;

      setItems(itemRows || []);
      setParties(partyRows || []);
      setAccounts(accountRows || []);
      setWarehouses(warehouseRows || []);
      setStockMovements(stockRows || []);
      setInvoices(dbInvoices || []);
      setHolds(dbHolds || []);
      setSessions(
        (dbSessions || []).sort((a, b) =>
          String(b.openedAt || "").localeCompare(String(a.openedAt || "")),
        ),
      );

      const open = (dbSessions || []).find(
        (s) => s.status === "Open" && s.userId === currentUser?.id && s.date === todayISO(),
      );

      setCurrentSession(open || null);
      if (!warehouseId && warehouseRows?.[0]?.id) setWarehouseId(warehouseRows[0].id);
    } catch (err) {
      console.error(err);
      toast.error("Could not load POS data");
    } finally {
      setLoading(false);
      setTimeout(() => barcodeRef.current?.focus(), 100);
    }
  };

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          items.map((i) => i.category || i.group || i.groupName || i.itemGroup).filter(Boolean),
        ),
      ).sort(),
    ],
    [items],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => {
        const cat = i.category || i.group || i.groupName || i.itemGroup || "";
        if (categoryFilter !== "All" && cat !== categoryFilter) return false;
        if (!q) return true;

        return [i.name, i.code, i.barcode, i.sku, i.hsnCode, cat, i.description]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 80);
  }, [items, search, categoryFilter]);

  const cartSummary = useMemo(() => {
    const gross = cart.reduce((sum, l) => sum + lineNet(l).gross, 0);
    const lineDiscount = cart.reduce((sum, l) => sum + lineNet(l).disc, 0);
    const taxableBeforeBillDiscount = cart.reduce((sum, l) => sum + lineNet(l).taxable, 0);

    const billPercentDiscount =
      taxableBeforeBillDiscount * (Number(billDiscountPercent || 0) / 100);
    const billDiscount =
      Number(billDiscountPercent || 0) > 0 ? billPercentDiscount : Number(billDiscountAmount || 0);

    const taxableBase = Math.max(0, taxableBeforeBillDiscount - billDiscount);

    const taxableRatio =
      taxableBeforeBillDiscount > 0 ? taxableBase / taxableBeforeBillDiscount : 1;

    const vat = cart.reduce((sum, l) => {
      const x = lineNet(l);
      const reducedTaxable = l.taxable ? x.taxable * taxableRatio : 0;
      return sum + reducedTaxable * 0.13;
    }, 0);

    const subTotal = taxableBase;
    const grandTotal = subTotal + vat;
    const paid = paymentTotal(payment);
    const balance = grandTotal - paid;
    const change = paid > grandTotal && Number(payment.credit || 0) <= 0 ? paid - grandTotal : 0;

    return {
      gross,
      lineDiscount,
      billPercentDiscount,
      billDiscountAmount: Number(billDiscountAmount || 0),
      billDiscount,
      totalDiscount: lineDiscount + billDiscount,
      taxable: subTotal,
      vat,
      grandTotal,
      paid,
      balance,
      change,
      itemCount: cart.reduce((sum, l) => sum + Number(l.qty || 0), 0),
      lineCount: cart.length,
    };
  }, [cart, billDiscountPercent, billDiscountAmount, payment]);

  const todaySales = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          String(inv.date || inv.invoiceDate || "").slice(0, 10) === todayISO() &&
          String(inv.sourceType || inv.channel || "")
            .toLowerCase()
            .includes("pos"),
      ),
    [invoices],
  );

  const dayStats = useMemo(() => {
    const totalSales = todaySales.reduce(
      (sum, inv) => sum + Number(inv.grandTotal || inv.total || 0),
      0,
    );
    const cash = todaySales.reduce(
      (sum, inv) => sum + Number(inv.payments?.cash || inv.cash || 0),
      0,
    );
    const card = todaySales.reduce(
      (sum, inv) => sum + Number(inv.payments?.card || inv.card || 0),
      0,
    );
    const wallet = todaySales.reduce(
      (sum, inv) => sum + Number(inv.payments?.wallet || inv.wallet || 0),
      0,
    );
    const bank = todaySales.reduce(
      (sum, inv) => sum + Number(inv.payments?.bank || inv.bank || 0),
      0,
    );
    const credit = todaySales.reduce(
      (sum, inv) => sum + Number(inv.payments?.credit || inv.credit || 0),
      0,
    );

    return {
      bills: todaySales.length,
      totalSales,
      cash,
      card,
      wallet,
      bank,
      credit,
      expectedCash: Number(currentSession?.openingCash || 0) + cash,
    };
  }, [todaySales, currentSession]);

  const addToCart = (item: any, qty = 1) => {
    if (!item?.id) return;
    const available = stockForItem(stockMovements, item.id, warehouseId);
    const allowNegative = companySettings?.allowNegativeStock === true;

    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      const nextQty = Number(existing?.qty || 0) + Number(qty || 1);

      if (!allowNegative && available < nextQty) {
        toast.error(`Insufficient stock. Available: ${available}`);
        return prev;
      }

      const rate =
        Number(item.sellingPrice || item.salePrice || item.mrp || item.rate || item.price || 0) ||
        0;

      const row = {
        id: existing?.id || generateId(),
        itemId: item.id,
        name: item.name,
        code: item.code || item.sku || "",
        barcode: item.barcode || "",
        unit: item.unit || item.uom || "PCS",
        qty: nextQty,
        rate: existing?.rate ?? rate,
        discountPercent: existing?.discountPercent || 0,
        discountAmount: existing?.discountAmount || 0,
        taxable:
          existing?.taxable ??
          (item.taxable !== false && item.vatExempt !== true && item.taxRate !== 0),
        warehouseId,
        available,
      };

      if (existing) {
        return prev.map((l) => (l.itemId === item.id ? row : l));
      }
      return [row, ...prev];
    });

    setBarcode("");
    setSearch("");
    setTimeout(() => barcodeRef.current?.focus(), 50);
  };

  const scanBarcode = () => {
    const q = barcode.trim().toLowerCase();
    if (!q) return;

    const item = items.find(
      (i) =>
        String(i.barcode || "").toLowerCase() === q ||
        String(i.code || "").toLowerCase() === q ||
        String(i.sku || "").toLowerCase() === q ||
        String(i.name || "").toLowerCase() === q,
    );

    if (!item) {
      toast.error("Item not found for barcode/code");
      return;
    }

    addToCart(item, 1);
  };

  const updateCartLine = (id: string, key: string, value: any) => {
    setCart((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;

        const next = {
          ...l,
          [key]:
            key === "qty" || key === "rate" || key === "discountPercent" || key === "discountAmount"
              ? Number(value || 0)
              : value,
        };

        if (key === "qty") {
          const available = stockForItem(stockMovements, l.itemId, warehouseId);
          const allowNegative = companySettings?.allowNegativeStock === true;
          if (!allowNegative && Number(value || 0) > available) {
            toast.error(`Insufficient stock. Available: ${available}`);
            return l;
          }
        }
        return next;
      }),
    );
  };

  const removeCartLine = (id: string) => {
    setCart((prev) => prev.filter((l) => l.id !== id));
  };

  const clearCart = () => {
    if (!cart.length) return;
    if (!confirm("Clear current cart?")) return;
    setCart([]);
    setBillDiscountPercent(0);
    setBillDiscountAmount(0);
    setPayment(defaultPayment());
    setPartyId("");
    toast.success("Cart cleared");
  };

  const quickSetPayment = (mode: string) => {
    const total = Number(cartSummary.grandTotal || 0);

    if (mode === "cash") setPayment({ ...defaultPayment(), cash: total });
    if (mode === "card") setPayment({ ...defaultPayment(), card: total });
    if (mode === "wallet") setPayment({ ...defaultPayment(), wallet: total });
    if (mode === "bank") setPayment({ ...defaultPayment(), bank: total });
    if (mode === "credit") {
      if (!partyId) {
        toast.error("Select customer for credit sale");
        return;
      }
      setPayment({ ...defaultPayment(), credit: total });
    }
  };

  const validateSale = () => {
    if (!currentSession) {
      toast.error("Open POS session first");
      return false;
    }
    if (!cart.length) {
      toast.error("Cart is empty");
      return false;
    }
    if (!warehouseId) {
      toast.error("Select warehouse");
      return false;
    }

    const bad = cart.find((l) => !l.itemId || Number(l.qty || 0) <= 0 || Number(l.rate || 0) < 0);
    if (bad) {
      toast.error("Cart contains invalid item/qty/rate");
      return false;
    }

    const paid = paymentTotal(payment);
    if (paid + 0.01 < cartSummary.grandTotal) {
      toast.error("Payment is less than bill total");
      return false;
    }
    if (Number(payment.credit || 0) > 0 && !partyId) {
      toast.error("Select customer for credit amount");
      return false;
    }

    return true;
  };

  const buildInvoice = () => {
    const party = parties.find((p) => p.id === partyId) || {};
    const invoiceNo = `POS-${saleDate.split("-").join("")}-${String(Date.now()).slice(-8)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const lines = cart.map((l) => {
      const x = lineNet(l);
      return {
        id: generateId(),
        itemId: l.itemId,
        itemName: l.name,
        qty: Number(l.qty || 0),
        unit: l.unit || "PCS",
        rate: Number(l.rate || 0),
        discountPercent: Number(l.discountPercent || 0),
        discountAmount: Number(l.discountAmount || 0),
        taxable: !!l.taxable,
        taxableAmount: x.taxable,
        vatAmount: x.vat,
        lineTotal: x.total,
        warehouseId: l.warehouseId || warehouseId,
      };
    });

    return {
      id: generateId(),
      invoiceNo,
      number: invoiceNo,
      type: "sales",
      voucherType: "sales_invoice",
      sourceType: "POS",
      channel: "POS",
      date: saleDate,
      invoiceDate: saleDate,
      partyId: partyId || "",
      partyName: party.name || "Walk-in Customer",
      partyPan: normalizePAN(party.pan || party.vatNo || party.taxNo),
      warehouseId,
      lines,
      items: lines,
      grossAmount: cartSummary.gross,
      discountAmount: cartSummary.totalDiscount,
      taxableAmount: cartSummary.taxable,
      vatAmount: cartSummary.vat,
      grandTotal: cartSummary.grandTotal,
      total: cartSummary.grandTotal,
      payments: { ...payment },
      paymentMode:
        Number(payment.cash || 0) > 0
          ? "Cash"
          : Number(payment.card || 0) > 0
            ? "Card"
            : Number(payment.wallet || 0) > 0
              ? "Wallet"
              : Number(payment.bank || 0) > 0
                ? "Bank"
                : "Credit",
      status: "paid",
      fiscalYearId: fiscalYear?.id || "",
      posSessionId: currentSession?.id || "",
      createdBy: currentUser?.id || "",
      createdByName: currentUser?.name || currentUser?.username || "Cashier",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
  };

  const buildVoucher = (invoice: any) => {
    const salesAcc = findAccount(accounts, ["sales"]);
    const vatAcc = findAccount(accounts, ["vat", "tax payable"]);
    const cashAcc = findAccount(accounts, ["cash"]);
    const bankAcc = findAccount(accounts, ["bank"]);
    const cardAcc = findAccount(accounts, ["card", "pos receivable"]);
    const walletAcc = findAccount(accounts, ["wallet", "digital"]);
    const debtorAcc = findAccount(accounts, ["debtor", "receivable", "customer"]);

    const lines: any[] = [];

    if (Number(invoice.payments.cash || 0) > 0) {
      lines.push({
        id: generateId(),
        accountId: cashAcc.id || "cash",
        debit: Number(invoice.payments.cash || 0),
        credit: 0,
        narration: `POS cash sale ${invoice.invoiceNo}`,
      });
    }
    if (Number(invoice.payments.bank || 0) > 0) {
      lines.push({
        id: generateId(),
        accountId: bankAcc.id || "bank",
        debit: Number(invoice.payments.bank || 0),
        credit: 0,
        narration: `POS bank sale ${invoice.invoiceNo}`,
      });
    }
    if (Number(invoice.payments.card || 0) > 0) {
      lines.push({
        id: generateId(),
        accountId: cardAcc.id || bankAcc.id || "card",
        debit: Number(invoice.payments.card || 0),
        credit: 0,
        narration: `POS card sale ${invoice.invoiceNo}`,
      });
    }
    if (Number(invoice.payments.wallet || 0) > 0) {
      lines.push({
        id: generateId(),
        accountId: walletAcc.id || bankAcc.id || "wallet",
        debit: Number(invoice.payments.wallet || 0),
        credit: 0,
        narration: `POS wallet sale ${invoice.invoiceNo}`,
      });
    }
    if (Number(invoice.payments.credit || 0) > 0) {
      lines.push({
        id: generateId(),
        accountId: debtorAcc.id || partyId || "debtors",
        partyId,
        debit: Number(invoice.payments.credit || 0),
        credit: 0,
        narration: `POS credit sale ${invoice.invoiceNo}`,
      });
    }

    lines.push({
      id: generateId(),
      accountId: salesAcc.id || "sales",
      debit: 0,
      credit: Number(invoice.taxableAmount || 0),
      narration: `POS sales ${invoice.invoiceNo}`,
    });

    if (Number(invoice.vatAmount || 0) > 0) {
      lines.push({
        id: generateId(),
        accountId: vatAcc.id || "vat-payable",
        debit: 0,
        credit: Number(invoice.vatAmount || 0),
        narration: `VAT on POS sales ${invoice.invoiceNo}`,
      });
    }

    return {
      id: generateId(),
      voucherNo: invoice.invoiceNo,
      type: "sales",
      date: invoice.date,
      narration: `POS sale ${invoice.invoiceNo}`,
      partyId: invoice.partyId,
      lines,
      totalDebit: lines.reduce((sum, l) => sum + Number(l.debit || 0), 0),
      totalCredit: lines.reduce((sum, l) => sum + Number(l.credit || 0), 0),
      status: "posted",
      sourceType: "POS",
      sourceId: invoice.id,
      fiscalYearId: fiscalYear?.id || "",
      createdBy: currentUser?.id || "",
      createdAt: nowISO(),
    };
  };

  const saveSale = async () => {
    if (!validateSale()) return;
    setLoading(true);

    try {
      const db = getDB();
      const invoice = buildInvoice();
      const voucher = buildVoucher(invoice);

      const stockRows = invoice.lines.map((l) => ({
        id: generateId(),
        date: invoice.date,
        type: "sales",
        itemId: l.itemId,
        warehouseId: l.warehouseId || warehouseId,
        qtyIn: 0,
        qtyOut: Number(l.qty || 0),
        rate: Number(l.rate || 0),
        value: Number(l.taxableAmount || 0),
        sourceType: "POS",
        sourceId: invoice.id,
        invoiceId: invoice.id,
        narration: `POS sale ${invoice.invoiceNo}`,
        createdAt: nowISO(),
      }));

      await tablePut(db, "invoices", [invoice]);
      await tablePut(db, "vouchers", [voucher]);
      await tablePut(db, "stockMovements", stockRows);
      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "POS Sale Saved",
          `${invoice.invoiceNo} ${money(invoice.grandTotal)} ${invoice.paymentMode}`,
          "Medium",
        ),
      ]);

      if (store.addInvoice) {
        try {
          store.addInvoice(invoice);
        } catch {}
      }
      if (store.addVoucher) {
        try {
          store.addVoucher(voucher);
        } catch {}
      }

      setInvoices((prev) => [invoice, ...prev]);
      setStockMovements((prev) => [...stockRows, ...prev]);
      setReceiptData(invoice);
      setCart([]);
      setBillDiscountPercent(0);
      setBillDiscountAmount(0);
      setPayment(defaultPayment());
      setPartyId("");
      setModalType("receipt");

      toast.success(`POS invoice ${invoice.invoiceNo} saved`);
    } catch (err) {
      console.error(err);
      toast.error("Could not save POS sale");
    } finally {
      setLoading(false);
      setTimeout(() => barcodeRef.current?.focus(), 100);
    }
  };

  const openSession = async () => {
    if (currentSession) {
      toast.error("POS session is already open");
      return;
    }
    try {
      const db = getDB();
      const row = {
        ...defaultSession(currentUser),
        openingCash: Number(openingCash || 0),
        expectedCash: Number(openingCash || 0),
      };

      await tablePut(db, "posSessions", [row]);
      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "POS Session Opened",
          `Opening cash ${money(row.openingCash)}`,
          "Medium",
        ),
      ]);

      setCurrentSession(row);
      setSessions((prev) => [row, ...prev]);
      setModalType("");
      toast.success("POS session opened");
    } catch (err) {
      console.error(err);
      toast.error("Could not open POS session");
    }
  };

  const closeSession = async () => {
    if (!currentSession) {
      toast.error("No open POS session");
      return;
    }
    const variance = Number(closingCash || 0) - Number(dayStats.expectedCash || 0);

    try {
      const db = getDB();
      const row = {
        ...currentSession,
        closingCash: Number(closingCash || 0),
        expectedCash: Number(dayStats.expectedCash || 0),
        variance,
        closedAt: nowISO(),
        status: "Closed",
      };

      await tablePut(db, "posSessions", [row]);
      await tablePut(db, "auditLogs", [
        makeAuditRow(
          currentUser,
          "POS Session Closed",
          `Closing cash ${money(row.closingCash)}, variance ${money(row.variance)}`,
          Math.abs(variance) > 1 ? "High" : "Medium",
        ),
      ]);

      setCurrentSession(null);
      setSessions((prev) => [row, ...prev.filter((s) => s.id !== row.id)]);
      setModalType("");
      toast.success("POS session closed");
    } catch (err) {
      console.error(err);
      toast.error("Could not close POS session");
    }
  };

  const holdBill = async () => {
    if (!cart.length) {
      toast.error("Cart is empty");
      return;
    }
    try {
      const db = getDB();
      const row = {
        id: generateId(),
        name: holdName || `Hold ${new Date().toLocaleTimeString()}`,
        date: todayISO(),
        heldAt: nowISO(),
        partyId,
        warehouseId,
        cart,
        billDiscountPercent,
        billDiscountAmount,
        payment,
        total: cartSummary.grandTotal,
        userId: currentUser?.id || "",
      };

      await tablePut(db, "posHolds", [row]);
      await tablePut(db, "auditLogs", [
        makeAuditRow(currentUser, "POS Bill Held", `${row.name} ${money(row.total)}`, "Low"),
      ]);

      setHolds((prev) => [row, ...prev]);
      setCart([]);
      setBillDiscountPercent(0);
      setBillDiscountAmount(0);
      setPayment(defaultPayment());
      setHoldName("");
      setModalType("");
      toast.success("Bill held");
    } catch (err) {
      console.error(err);
      toast.error("Could not hold bill");
    }
  };

  const recallHold = async (h: any) => {
    if (cart.length && !confirm("Current cart will be replaced. Continue?")) return;
    setPartyId(h.partyId || "");
    setWarehouseId(h.warehouseId || warehouseId);
    setCart(h.cart || []);
    setBillDiscountPercent(Number(h.billDiscountPercent || 0));
    setBillDiscountAmount(Number(h.billDiscountAmount || 0));
    setPayment(h.payment || defaultPayment());

    try {
      const db = getDB();
      await tableDelete(db, "posHolds", h.id);
      setHolds((prev) => prev.filter((x) => x.id !== h.id));
    } catch {}

    setModalType("");
    setActiveTab("Billing");
    toast.success("Held bill recalled");
  };

  const deleteHold = async (h: any) => {
    if (!confirm(`Delete held bill "${h.name}"?`)) return;
    try {
      const db = getDB();
      await tableDelete(db, "posHolds", h.id);
      setHolds((prev) => prev.filter((x) => x.id !== h.id));
      toast.success("Held bill deleted");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete held bill");
    }
  };

  const exportDayReport = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        todaySales.map((inv) => ({
          Date: inv.date,
          InvoiceNo: inv.invoiceNo || inv.number,
          Customer: inv.partyName || partyName(parties, inv.partyId),
          Gross: inv.grossAmount,
          Discount: inv.discountAmount,
          Taxable: inv.taxableAmount,
          VAT: inv.vatAmount,
          Total: inv.grandTotal,
          Cash: inv.payments?.cash || 0,
          Card: inv.payments?.card || 0,
          Wallet: inv.payments?.wallet || 0,
          Bank: inv.payments?.bank || 0,
          Credit: inv.payments?.credit || 0,
          Cashier: inv.createdByName,
        })),
      ),
      "POS Sales",
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Metric: "Bills", Value: dayStats.bills },
        { Metric: "Total Sales", Value: dayStats.totalSales },
        { Metric: "Cash", Value: dayStats.cash },
        { Metric: "Card", Value: dayStats.card },
        { Metric: "Wallet", Value: dayStats.wallet },
        { Metric: "Bank", Value: dayStats.bank },
        { Metric: "Credit", Value: dayStats.credit },
        { Metric: "Expected Cash", Value: dayStats.expectedCash },
      ]),
      "Summary",
    );

    XLSX.writeFile(wb, `POS_Day_Report_${todayISO()}.xlsx`);
    toast.success("POS day report exported");
  };

  const printReceipt = (invoice = receiptData) => {
    if (!invoice) {
      toast.error("No receipt data");
      return;
    }

    const companyName =
      companySettings?.name ||
      companySettings?.companyName ||
      companySettings?.legalName ||
      "Company";

    const html = `
      <html>
        <head>
          <title>${invoice.invoiceNo}</title>
          ${receiptCss}
        </head>
        <body>
          <div class="receipt">
            <div class="center bold">${companyName}</div>
            <div class="center">${companySettings?.address || ""}</div>
            <div class="center">PAN: ${normalizePAN(companySettings?.pan || companySettings?.vatNo || "") || "-"}</div>
            <div class="line"></div>

            <div class="row"><span>Bill No:</span><span>${invoice.invoiceNo}</span></div>
            <div class="row"><span>Date:</span><span>${invoice.date}</span></div>
            <div class="row"><span>Cashier:</span><span>${invoice.createdByName || "-"}</span></div>
            <div class="row"><span>Customer:</span><span>${invoice.partyName || "Walk-in Customer"}</span></div>

            <div class="line"></div>

            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th class="right">Qty</th>
                  <th class="right">Rate</th>
                  <th class="right">Amt</th>
                </tr>
              </thead>
              <tbody>
                ${(invoice.lines || [])
                  .map(
                    (l) => `
                      <tr>
                        <td>${l.itemName || itemName(items, l.itemId)}</td>
                        <td class="right">${Number(l.qty || 0).toFixed(2)}</td>
                        <td class="right">${Number(l.rate || 0).toFixed(2)}</td>
                        <td class="right">${Number(l.lineTotal || 0).toFixed(2)}</td>
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
            </table>

            <div class="line"></div>

            <div class="row"><span>Gross:</span><span>${Number(invoice.grossAmount || 0).toFixed(2)}</span></div>
            <div class="row"><span>Discount:</span><span>${Number(invoice.discountAmount || 0).toFixed(2)}</span></div>
            <div class="row"><span>Taxable:</span><span>${Number(invoice.taxableAmount || 0).toFixed(2)}</span></div>
            <div class="row"><span>VAT 13%:</span><span>${Number(invoice.vatAmount || 0).toFixed(2)}</span></div>
            <div class="line"></div>
            <div class="row bold"><span>Grand Total:</span><span>${Number(invoice.grandTotal || 0).toFixed(2)}</span></div>

            <div class="line"></div>

            <div class="row"><span>Cash:</span><span>${Number(invoice.payments?.cash || 0).toFixed(2)}</span></div>
            <div class="row"><span>Card:</span><span>${Number(invoice.payments?.card || 0).toFixed(2)}</span></div>
            <div class="row"><span>Wallet:</span><span>${Number(invoice.payments?.wallet || 0).toFixed(2)}</span></div>
            <div class="row"><span>Bank:</span><span>${Number(invoice.payments?.bank || 0).toFixed(2)}</span></div>
            <div class="row"><span>Credit:</span><span>${Number(invoice.payments?.credit || 0).toFixed(2)}</span></div>

            <div class="line"></div>
            <div class="center">Thank you for shopping!</div>
          </div>

          <script>
            window.print();
          </script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "width=420,height=720");
    if (!w) {
      toast.error("Popup blocked");
      return;
    }

    w.document.write(html);
    w.document.close();
  };

  const renderSessionBanner = () => (
    <div
      className={`rounded-lg border p-3 mb-4 ${
        currentSession
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          {currentSession ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}

          <div>
            <p className="font-semibold text-[13px]">
              {currentSession ? "POS Session Open" : "POS Session Not Open"}
            </p>
            <p className="text-[11px] font-medium text-gray-600">
              {currentSession
                ? `Opened by ${currentSession.userName} at ${String(currentSession.openedAt).slice(11, 19)} • Opening Cash ${money(currentSession.openingCash)}`
                : "Open a POS session before creating sales."}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {!currentSession ? (
            <button className={btn} onClick={() => setModalType("openSession")}>
              <PlayCircle className="h-4 w-4" />
              Open Session
            </button>
          ) : (
            <button className={btnDanger} onClick={() => setModalType("closeSession")}>
              <PauseCircle className="h-4 w-4" />
              Close Session
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderBilling = () => (
    <div className="space-y-4">
      {renderSessionBanner()}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className={card}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Sale Date
                </label>
                <input
                  type="date"
                  className={input}
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Warehouse
                </label>
                <select
                  className={input}
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Customer
                </label>
                <select
                  className={input}
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                >
                  <option value="">Walk-in Customer</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.pan ? `PAN: ${p.pan}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Held Bills
                </label>
                <button className={`${btn2} w-full`} onClick={() => setActiveTab("Held Bills")}>
                  <PauseCircle className="h-4 w-4" />
                  {holds.length} Held
                </button>
              </div>
            </div>
          </div>

          <div className={card}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Barcode / Item Code
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="h-4 w-4 absolute left-2.5 top-2 text-gray-500" />
                    <input
                      ref={barcodeRef}
                      className={`${input} pl-8`}
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") scanBarcode();
                      }}
                      placeholder="Scan barcode or enter item code"
                    />
                  </div>

                  <button className={btn} onClick={scanBarcode}>
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Search Item
                </label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2.5 top-2 text-gray-500" />
                  <input
                    className={`${input} pl-8`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, SKU, category..."
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Category
                </label>
                <select
                  className={input}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredItems.map((i) => {
              const stock = stockForItem(stockMovements, i.id, warehouseId);
              const price = Number(
                i.sellingPrice || i.salePrice || i.mrp || i.rate || i.price || 0,
              );

              return (
                <button
                  key={i.id}
                  onClick={() => addToCart(i, 1)}
                  className="bg-white border border-gray-200 rounded-lg p-3 text-left hover:border-[#1557b0] hover:shadow-sm transition-colors"
                >
                  <div className="font-semibold text-[13px] text-gray-800 line-clamp-2 min-h-[40px] leading-tight">
                    {i.name}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    {i.code || i.sku || i.barcode || "-"}
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <span className="text-[14px] font-bold text-[#1557b0]">{money(price)}</span>
                    <span
                      className={`text-[10px] font-bold ${
                        stock <= 0 ? "text-red-600" : stock < 5 ? "text-amber-600" : "text-gray-600"
                      }`}
                    >
                      Stk {stock}
                    </span>
                  </div>
                </button>
              );
            })}

            {!filteredItems.length && (
              <div className="col-span-full bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-[12px] font-semibold text-gray-500">
                No items found.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className={card}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[14px] font-bold flex items-center gap-2 text-gray-800">
                <ShoppingCart className="h-5 w-5 text-[#1557b0]" />
                Cart
              </h3>

              <button
                className="text-gray-400 hover:text-red-600 p-1.5 rounded"
                onClick={clearCart}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-[42vh] overflow-auto pr-1 hide-scrollbar">
              {cart.map((l) => {
                const x = lineNet(l);

                return (
                  <div key={l.id} className="border border-gray-200 rounded-md p-2 bg-gray-50">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[12px] leading-tight text-gray-800">
                          {l.name}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {l.code || "-"} • {l.unit || "PCS"}
                        </p>
                      </div>

                      <button
                        className="text-gray-400 hover:text-red-600 p-1 rounded"
                        onClick={() => removeCartLine(l.id)}
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <label className="text-[10px] font-medium text-gray-600 mb-0.5 block">
                          Qty
                        </label>
                        <div className="flex h-7 bg-white rounded border border-gray-300 overflow-hidden">
                          <button
                            className="px-1.5 hover:bg-gray-100 text-gray-600"
                            onClick={() =>
                              updateCartLine(l.id, "qty", Math.max(1, Number(l.qty || 0) - 1))
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            className="w-full text-center text-[11px] font-medium border-x border-gray-300 focus:outline-none"
                            value={l.qty}
                            onChange={(e) => updateCartLine(l.id, "qty", e.target.value)}
                          />
                          <button
                            className="px-1.5 hover:bg-gray-100 text-gray-600"
                            onClick={() => updateCartLine(l.id, "qty", Number(l.qty || 0) + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-medium text-gray-600 mb-0.5 block">
                          Rate
                        </label>
                        <input
                          type="number"
                          className={`${input} h-7 px-1.5`}
                          value={l.rate}
                          onChange={(e) => updateCartLine(l.id, "rate", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-medium text-gray-600 mb-0.5 block">
                          Disc %
                        </label>
                        <input
                          type="number"
                          className={`${input} h-7 px-1.5`}
                          value={l.discountPercent}
                          onChange={(e) => updateCartLine(l.id, "discountPercent", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-2">
                      <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={l.taxable}
                          onChange={(e) => updateCartLine(l.id, "taxable", e.target.checked)}
                          className="h-3 w-3 accent-[#1557b0]"
                        />
                        VAT
                      </label>

                      <span className="font-bold text-[13px] text-gray-800">{money(x.total)}</span>
                    </div>
                  </div>
                );
              })}

              {!cart.length && (
                <div className="border border-dashed border-gray-300 rounded-md p-8 text-center text-[12px] font-semibold text-gray-500">
                  Cart is empty.
                </div>
              )}
            </div>
          </div>

          <div className={card}>
            <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2 text-gray-800">
              <Calculator className="h-4 w-4 text-[#1557b0]" />
              Bill Summary
            </h3>

            <div className="space-y-1.5 text-[12px]">
              <div className="flex justify-between text-gray-600">
                <span className="font-medium">Gross</span>
                <span className="font-semibold text-gray-800">{money(cartSummary.gross)}</span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span className="font-medium">Line Discount</span>
                <span className="font-semibold text-gray-800">
                  {money(cartSummary.lineDiscount)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 my-2">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">
                    Bill Disc %
                  </label>
                  <input
                    type="number"
                    className={`${input} h-7`}
                    value={billDiscountPercent}
                    onChange={(e) => setBillDiscountPercent(Number(e.target.value || 0))}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">
                    Bill Disc Amt
                  </label>
                  <input
                    type="number"
                    className={`${input} h-7`}
                    value={billDiscountAmount}
                    onChange={(e) => setBillDiscountAmount(Number(e.target.value || 0))}
                  />
                </div>
              </div>

              <div className="flex justify-between text-gray-600">
                <span className="font-medium">Taxable</span>
                <span className="font-semibold text-gray-800">{money(cartSummary.taxable)}</span>
              </div>

              <div className="flex justify-between text-gray-600 pb-2">
                <span className="font-medium">VAT 13%</span>
                <span className="font-semibold text-gray-800">{money(cartSummary.vat)}</span>
              </div>

              <div className="border-t border-gray-200 pt-2 flex justify-between text-[15px]">
                <span className="font-bold text-gray-800">Grand Total</span>
                <span className="font-bold text-[#1557b0]">{money(cartSummary.grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className={card}>
            <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2 text-gray-800">
              <WalletCards className="h-4 w-4 text-[#1557b0]" />
              Payment
            </h3>

            <div className="grid grid-cols-5 gap-2 mb-3">
              <button
                className={`${btn2} p-0 flex items-center justify-center`}
                onClick={() => quickSetPayment("cash")}
              >
                <Banknote className="h-4 w-4" />
              </button>
              <button
                className={`${btn2} p-0 flex items-center justify-center`}
                onClick={() => quickSetPayment("card")}
              >
                <CreditCard className="h-4 w-4" />
              </button>
              <button
                className={`${btn2} p-0 flex items-center justify-center`}
                onClick={() => quickSetPayment("wallet")}
              >
                <QrCode className="h-4 w-4" />
              </button>
              <button
                className={`${btn2} p-0 flex items-center justify-center`}
                onClick={() => quickSetPayment("bank")}
              >
                <WalletCards className="h-4 w-4" />
              </button>
              <button
                className={`${btn2} p-0 flex items-center justify-center`}
                onClick={() => quickSetPayment("credit")}
              >
                <User className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">
                  Cash
                </label>
                <input
                  type="number"
                  className={`${input} h-7`}
                  value={payment.cash}
                  onChange={(e) => setPayment((p) => ({ ...p, cash: Number(e.target.value || 0) }))}
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">
                  Card
                </label>
                <input
                  type="number"
                  className={`${input} h-7`}
                  value={payment.card}
                  onChange={(e) => setPayment((p) => ({ ...p, card: Number(e.target.value || 0) }))}
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">
                  Wallet
                </label>
                <input
                  type="number"
                  className={`${input} h-7`}
                  value={payment.wallet}
                  onChange={(e) =>
                    setPayment((p) => ({ ...p, wallet: Number(e.target.value || 0) }))
                  }
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">
                  Bank
                </label>
                <input
                  type="number"
                  className={`${input} h-7`}
                  value={payment.bank}
                  onChange={(e) => setPayment((p) => ({ ...p, bank: Number(e.target.value || 0) }))}
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">
                  Credit
                </label>
                <input
                  type="number"
                  className={`${input} h-7`}
                  value={payment.credit}
                  onChange={(e) =>
                    setPayment((p) => ({ ...p, credit: Number(e.target.value || 0) }))
                  }
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">
                  Ref No
                </label>
                <input
                  className={`${input} h-7`}
                  value={payment.referenceNo}
                  onChange={(e) => setPayment((p) => ({ ...p, referenceNo: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-3 space-y-1 text-[12px] bg-gray-50 p-2 rounded border border-gray-100">
              <div className="flex justify-between text-gray-600">
                <span className="font-medium">Paid</span>
                <span className="font-bold text-gray-800">{money(cartSummary.paid)}</span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span className="font-medium">Balance</span>
                <span
                  className={`font-bold ${cartSummary.balance > 0 ? "text-red-600" : "text-emerald-600"}`}
                >
                  {money(cartSummary.balance)}
                </span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span className="font-medium">Change</span>
                <span className="font-bold text-gray-800">{money(cartSummary.change)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button className={btn2} onClick={() => setModalType("hold")}>
                <PauseCircle className="h-4 w-4" />
                Hold
              </button>

              <button
                className={`${btn} bg-[#059669] hover:bg-[#047857]`}
                onClick={saveSale}
                disabled={loading}
              >
                <Receipt className="h-4 w-4" />
                Save Bill
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHeldBills = () => (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="text-[14px] font-bold flex items-center gap-2 text-gray-800">
          <PauseCircle className="h-5 w-5 text-[#1557b0]" />
          Held Bills
        </h3>
        <p className="text-[11px] font-medium text-gray-500 mt-1">
          Recall suspended carts or delete old held bills.
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr>
              <th className={th}>Held At</th>
              <th className={th}>Name</th>
              <th className={th}>Customer</th>
              <th className={`${th} text-right`}>Lines</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={`${th} text-center`}>Action</th>
            </tr>
          </thead>

          <tbody>
            {holds.map((h) => (
              <tr key={h.id} className="hover:bg-gray-50">
                <td className={td}>
                  <div className="font-semibold">{String(h.heldAt).slice(0, 10)}</div>
                  <div className="text-[10px] text-gray-500">{String(h.heldAt).slice(11, 19)}</div>
                </td>

                <td className={`${td} font-bold text-gray-800`}>{h.name}</td>
                <td className={td}>{partyName(parties, h.partyId)}</td>
                <td className={`${td} text-right font-semibold`}>{(h.cart || []).length}</td>
                <td className={`${td} text-right font-bold text-gray-800`}>{money(h.total)}</td>

                <td className={`${td} text-center`}>
                  <div className="inline-flex gap-2">
                    <button className={btn2} onClick={() => recallHold(h)}>
                      <RotateCcw className="h-4 w-4" />
                      Recall
                    </button>

                    <button className={btnDanger} onClick={() => deleteHold(h)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!holds.length && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[12px] font-medium text-gray-500">
                  No held bills.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDayClose = () => (
    <div className="space-y-4">
      {renderSessionBanner()}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className={card}>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Bills</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{dayStats.bills}</p>
        </div>

        <div className={card}>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Sales</p>
          <p className="text-xl font-bold text-[#1557b0] mt-1">{money(dayStats.totalSales)}</p>
        </div>

        <div className={card}>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Cash</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{money(dayStats.cash)}</p>
        </div>

        <div className={card}>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            Card/Wallet/Bank
          </p>
          <p className="text-xl font-bold text-gray-800 mt-1">
            {money(dayStats.card + dayStats.wallet + dayStats.bank)}
          </p>
        </div>

        <div className={card}>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Credit</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{money(dayStats.credit)}</p>
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap justify-between gap-3 items-start">
          <div>
            <h3 className="text-[14px] font-bold flex items-center gap-2 text-gray-800">
              <CalendarClock className="h-5 w-5 text-[#1557b0]" />
              Day Close Summary
            </h3>
            <p className="text-[11px] text-gray-500 font-medium mt-1">
              Expected cash includes opening cash plus cash sales for today.
            </p>
          </div>

          <div className="flex gap-2">
            <button className={btn2} onClick={exportDayReport}>
              <Download className="h-4 w-4" />
              Day Report
            </button>

            {currentSession && (
              <button className={btnDanger} onClick={() => setModalType("closeSession")}>
                <PauseCircle className="h-4 w-4" />
                Close Session
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <div className="border border-gray-200 bg-gray-50 rounded-md p-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Opening Cash
            </p>
            <p className="text-lg font-bold text-gray-800 mt-1">
              {money(currentSession?.openingCash || 0)}
            </p>
          </div>

          <div className="border border-gray-200 bg-gray-50 rounded-md p-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Cash Sales
            </p>
            <p className="text-lg font-bold text-emerald-600 mt-1">{money(dayStats.cash)}</p>
          </div>

          <div className="border border-gray-200 bg-gray-50 rounded-md p-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Expected Cash
            </p>
            <p className="text-lg font-bold text-gray-800 mt-1">{money(dayStats.expectedCash)}</p>
          </div>

          <div className="border border-gray-200 bg-gray-50 rounded-md p-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Open Session
            </p>
            <p className="text-lg font-bold text-gray-800 mt-1">{currentSession ? "Yes" : "No"}</p>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full min-w-[950px]">
          <thead>
            <tr>
              <th className={th}>Invoice</th>
              <th className={th}>Customer</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={`${th} text-right`}>Cash</th>
              <th className={`${th} text-right`}>Card</th>
              <th className={`${th} text-right`}>Wallet</th>
              <th className={`${th} text-right`}>Bank</th>
              <th className={`${th} text-right`}>Credit</th>
              <th className={`${th} text-center`}>Print</th>
            </tr>
          </thead>

          <tbody>
            {todaySales.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className={`${td} font-bold text-gray-800`}>{inv.invoiceNo || inv.number}</td>
                <td className={td}>{inv.partyName || partyName(parties, inv.partyId)}</td>
                <td className={`${td} text-right font-bold text-gray-800`}>
                  {money(inv.grandTotal || inv.total)}
                </td>
                <td className={`${td} text-right text-gray-600`}>
                  {money(inv.payments?.cash || 0)}
                </td>
                <td className={`${td} text-right text-gray-600`}>
                  {money(inv.payments?.card || 0)}
                </td>
                <td className={`${td} text-right text-gray-600`}>
                  {money(inv.payments?.wallet || 0)}
                </td>
                <td className={`${td} text-right text-gray-600`}>
                  {money(inv.payments?.bank || 0)}
                </td>
                <td className={`${td} text-right text-gray-600`}>
                  {money(inv.payments?.credit || 0)}
                </td>
                <td className={`${td} text-center`}>
                  <button
                    className="p-1.5 rounded-md hover:bg-blue-50 text-[#1557b0]"
                    onClick={() => printReceipt(inv)}
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}

            {!todaySales.length && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-[12px] font-medium text-gray-500">
                  No POS sales today.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSessionHistory = () => (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="text-[14px] font-bold flex items-center gap-2 text-gray-800">
          <History className="h-5 w-5 text-[#1557b0]" />
          Session History
        </h3>
        <p className="text-[11px] font-medium text-gray-500 mt-1">
          POS opening cash, closing cash and cash variance log.
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full min-w-[950px]">
          <thead>
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Cashier</th>
              <th className={th}>Opened</th>
              <th className={th}>Closed</th>
              <th className={`${th} text-right`}>Opening Cash</th>
              <th className={`${th} text-right`}>Expected Cash</th>
              <th className={`${th} text-right`}>Closing Cash</th>
              <th className={`${th} text-right`}>Variance</th>
              <th className={th}>Status</th>
            </tr>
          </thead>

          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className={`${td} font-semibold text-gray-800`}>{s.date}</td>
                <td className={`${td} font-bold text-gray-800`}>{s.userName}</td>
                <td className={td}>{String(s.openedAt || "").slice(11, 19)}</td>
                <td className={td}>{s.closedAt ? String(s.closedAt).slice(11, 19) : "-"}</td>
                <td className={`${td} text-right text-gray-600`}>{money(s.openingCash)}</td>
                <td className={`${td} text-right text-gray-600`}>{money(s.expectedCash)}</td>
                <td className={`${td} text-right text-gray-600`}>
                  {s.closedAt ? money(s.closingCash) : "-"}
                </td>
                <td
                  className={`${td} text-right font-bold ${Math.abs(Number(s.variance || 0)) > 1 ? "text-red-600" : "text-emerald-600"}`}
                >
                  {s.closedAt ? money(s.variance) : "-"}
                </td>
                <td className={td}>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      s.status === "Open"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}

            {!sessions.length && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-[12px] font-medium text-gray-500">
                  No POS sessions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReceiptModal = () => (
    <Modal
      open={modalType === "receipt"}
      title="POS Receipt"
      onClose={() => setModalType("")}
      max="max-w-md"
    >
      {receiptData && (
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="text-center">
              <h3 className="font-bold text-[15px] text-gray-800">
                {companySettings?.name || companySettings?.companyName || "Company"}
              </h3>
              <p className="text-[11px] font-medium text-gray-500">
                {companySettings?.address || ""}
              </p>
              <p className="text-[11px] font-medium text-gray-500">
                PAN: {normalizePAN(companySettings?.pan || companySettings?.vatNo || "") || "-"}
              </p>
            </div>

            <div className="border-t border-dashed border-gray-300 my-3" />

            <div className="text-[11px] font-medium text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Bill No:</span>
                <span className="font-semibold text-gray-800">{receiptData.invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-semibold text-gray-800">{receiptData.date}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-semibold text-gray-800">{receiptData.partyName}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span className="font-semibold text-gray-800">{receiptData.createdByName}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-300 my-3" />

            <div className="space-y-2">
              {(receiptData.lines || []).map((l: any) => (
                <div key={l.id} className="text-[11px] text-gray-600">
                  <div className="font-semibold text-gray-800">{l.itemName}</div>
                  <div className="flex justify-between mt-0.5">
                    <span>
                      {Number(l.qty || 0).toFixed(2)} × {Number(l.rate || 0).toFixed(2)}
                    </span>
                    <span className="font-semibold text-gray-800">
                      {Number(l.lineTotal || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-300 my-3" />

            <div className="text-[11px] font-medium text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Gross</span>
                <span>{Number(receiptData.grossAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>{Number(receiptData.discountAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxable</span>
                <span>{Number(receiptData.taxableAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT</span>
                <span>{Number(receiptData.vatAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-[14px] text-gray-800 border-t border-gray-200 pt-2 mt-2">
                <span>Total</span>
                <span>{Number(receiptData.grandTotal || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 mt-4">
            <button className={btn2} onClick={() => setModalType("")}>
              Close
            </button>

            <button className={btn} onClick={() => printReceipt(receiptData)}>
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>
      )}
    </Modal>
  );

  return (
    <div className="p-4 md:p-6 bg-[#f5f6fa] min-h-screen text-gray-800">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div>
          <h1 className="text-[18px] font-semibold flex items-center gap-2 text-gray-800 tracking-tight">
            <Receipt className="h-5 w-5 text-[#1557b0]" />
            POS Mode
          </h1>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Fast retail billing with barcode scan, VAT receipt, split payments, hold bills and day
            close.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className={btn2} onClick={loadData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button className={btn2} onClick={exportDayReport}>
            <FileSpreadsheet className="h-4 w-4" />
            Day Report
          </button>

          {!currentSession ? (
            <button className={btn} onClick={() => setModalType("openSession")}>
              <PlayCircle className="h-4 w-4" />
              Open Session
            </button>
          ) : (
            <button className={btnDanger} onClick={() => setModalType("closeSession")}>
              <PauseCircle className="h-4 w-4" />
              Close Session
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {[
          ["Billing", ShoppingCart],
          ["Held Bills", PauseCircle],
          ["Day Close", CalendarClock],
          ["Session History", History],
        ].map(([name, Icon]: any) => (
          <button
            key={name}
            onClick={() => setActiveTab(name)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              activeTab === name
                ? "bg-[#1557b0] text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {name}
          </button>
        ))}
      </div>

      {loading && (
        <div className={`${card} mb-4`}>
          <div className="flex items-center gap-2 text-[12px] font-medium text-gray-600">
            <RefreshCcw className="h-4 w-4 animate-spin text-[#1557b0]" />
            Processing POS operation...
          </div>
        </div>
      )}

      {activeTab === "Billing" && renderBilling()}
      {activeTab === "Held Bills" && renderHeldBills()}
      {activeTab === "Day Close" && renderDayClose()}
      {activeTab === "Session History" && renderSessionHistory()}

      <Modal
        open={modalType === "openSession"}
        title="Open POS Session"
        onClose={() => setModalType("")}
        max="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-md border border-blue-200 bg-blue-50 text-blue-800">
            <p className="text-[13px] font-bold">Opening Cash</p>
            <p className="text-[11px] font-medium mt-1 text-blue-700">
              Enter the cash float available in drawer at start of POS session.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide block mb-1">
              Opening Cash
            </label>
            <input
              type="number"
              className={input}
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value || 0))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 mt-4">
            <button className={btn2} onClick={() => setModalType("")}>
              Cancel
            </button>

            <button className={btn} onClick={openSession}>
              <PlayCircle className="h-4 w-4" />
              Open Session
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={modalType === "closeSession"}
        title="Close POS Session"
        onClose={() => setModalType("")}
        max="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-md border border-amber-200 bg-amber-50 text-amber-800">
            <p className="text-[13px] font-bold">Cash Reconciliation</p>
            <p className="text-[11px] font-medium mt-1 text-amber-700">
              Expected cash = opening cash + cash sales. Variance is recorded in session log.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border border-gray-200 bg-gray-50 rounded-md p-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Opening Cash
              </p>
              <p className="text-[14px] font-bold text-gray-800 mt-0.5">
                {money(currentSession?.openingCash || 0)}
              </p>
            </div>

            <div className="border border-gray-200 bg-gray-50 rounded-md p-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Cash Sales
              </p>
              <p className="text-[14px] font-bold text-emerald-600 mt-0.5">
                {money(dayStats.cash)}
              </p>
            </div>

            <div className="border border-gray-200 bg-gray-50 rounded-md p-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Expected Cash
              </p>
              <p className="text-[14px] font-bold text-gray-800 mt-0.5">
                {money(dayStats.expectedCash)}
              </p>
            </div>

            <div className="border border-gray-200 bg-gray-50 rounded-md p-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Variance
              </p>
              <p
                className={`text-[14px] font-bold mt-0.5 ${
                  Math.abs(Number(closingCash || 0) - Number(dayStats.expectedCash || 0)) > 1
                    ? "text-red-600"
                    : "text-emerald-600"
                }`}
              >
                {money(Number(closingCash || 0) - Number(dayStats.expectedCash || 0))}
              </p>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide block mb-1">
              Actual Closing Cash
            </label>
            <input
              type="number"
              className={input}
              value={closingCash}
              onChange={(e) => setClosingCash(Number(e.target.value || 0))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 mt-4">
            <button className={btn2} onClick={() => setModalType("")}>
              Cancel
            </button>

            <button className={btnDanger} onClick={closeSession}>
              <PauseCircle className="h-4 w-4" />
              Close Session
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={modalType === "hold"}
        title="Hold Current Bill"
        onClose={() => setModalType("")}
        max="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide block mb-1">
              Hold Name
            </label>
            <input
              className={input}
              value={holdName}
              onChange={(e) => setHoldName(e.target.value)}
              placeholder="e.g. Table 4 / Customer waiting"
            />
          </div>

          <div className="border border-gray-200 bg-gray-50 rounded-md p-3 text-[12px]">
            <div className="flex justify-between text-gray-600 mb-1">
              <span className="font-medium">Lines</span>
              <span className="font-semibold text-gray-800">{cart.length}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span className="font-medium">Total</span>
              <span className="font-bold text-gray-800">{money(cartSummary.grandTotal)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 mt-4">
            <button className={btn2} onClick={() => setModalType("")}>
              Cancel
            </button>

            <button className={btn} onClick={holdBill}>
              <PauseCircle className="h-4 w-4" />
              Hold Bill
            </button>
          </div>
        </div>
      </Modal>

      {renderReceiptModal()}
    </div>
  );
}
