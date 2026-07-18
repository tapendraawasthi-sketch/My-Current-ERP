// @ts-nocheck
import React, { useState, useMemo, useCallback } from "react";
import { useStore } from "../store/useStore";
import {
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Eye,
  X,
  Search,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import NepaliDatePicker from "../components/ui/NepaliDatePicker";
import { ReportEmptyState } from "../components/ReportEmptyState";
import toast from "@/lib/appToast";
import * as XLSX from "xlsx";
import { computeVatForLine } from "../lib/taxUtils";
import {
  calculateNepalTds,
  getApplicableNepalTdsRates,
  getNepalTdsRate,
  type NepalTdsCalculationResult,
} from "../lib/tdsNepal";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurchaseLine {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  qty: number;
  unit: string;
  rate: number;
  discountPercent: number;
  discountAmount: number;
  netAmount: number;
  isTaxable: boolean;
  vatRate: number;
  vatClassificationId?: string;
  taxability?: string;
  vatLabel?: string;
  vatBadgeVariant?: "success" | "warning" | "info" | "default";
  vatAmount: number;
  totalAmount: number;
  warehouseId?: string;
  batchNo?: string;
  expiryDate?: string;
  costPrice?: number;
}

interface TdsResult extends NepalTdsCalculationResult {
  sectionCode?: string;
  description?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function money(n: number): string {
  return Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function emptyLine(): PurchaseLine {
  return {
    id: uuid(),
    itemId: "",
    itemName: "",
    itemCode: "",
    qty: 1,
    unit: "PCS",
    rate: 0,
    discountPercent: 0,
    discountAmount: 0,
    netAmount: 0,
    isTaxable: true,
    vatRate: 13,
    vatAmount: 0,
    totalAmount: 0,
  };
}

function computeLine(
  line: PurchaseLine,
  vatClassifications: Array<{ id: string; name?: string; taxability: string; vatRate: number }>,
): PurchaseLine {
  const vat = computeVatForLine(
    {
      qty: line.qty,
      rate: line.rate,
      discountPercent: line.discountPercent,
      isTaxable: line.isTaxable,
      vatRate: line.vatRate,
      vatClassificationId: line.vatClassificationId,
    },
    vatClassifications.map((c) => ({
      id: c.id,
      name: c.name,
      taxability: c.taxability as "taxable" | "exempt" | "zero_rated" | "non_vat",
      vatRate: c.vatRate ?? 0,
    })),
  );

  return {
    ...line,
    discountAmount: vat.discountAmount,
    netAmount: vat.netAmount,
    isTaxable: vat.isTaxable,
    vatRate: vat.vatRate,
    vatAmount: vat.vatAmount,
    totalAmount: vat.totalAmount,
    taxability: vat.taxability,
    vatLabel: vat.vatLabel,
    vatBadgeVariant: vat.vatBadgeVariant,
    vatClassificationId: vat.vatClassificationId || line.vatClassificationId,
  };
}

const statusBadgeCls = (status: string) => {
  switch (status) {
    case "posted":
      return "bg-green-100 text-green-700";
    case "draft":
      return "bg-amber-100 text-amber-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "submitted":
    case "under_review":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const vatBadgeCls = (variant?: string) => {
  if (variant === "success") return "bg-green-100 text-green-700";
  if (variant === "warning") return "bg-amber-100 text-amber-700";
  if (variant === "info") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-700";
};

// ─── TDS helpers ──────────────────────────────────────────────────────────────

function computeTds(
  grossAmount: number,
  sectionId: string,
  party?: { personType?: string; residency?: string },
): TdsResult {
  if (!sectionId || grossAmount <= 0) {
    return {
      applicable: false,
      sectionId: sectionId || "",
      sectionCode: "",
      description: "",
      descriptionNepali: "",
      grossAmount,
      thresholdAmount: 0,
      rate: 0,
      tdsAmount: 0,
      netPayable: grossAmount,
    };
  }

  try {
    return calculateNepalTds({
      sectionId,
      grossAmount,
      personType: (party?.personType as "individual" | "entity") || "entity",
      residency: (party?.residency as "resident" | "non-resident") || "resident",
    });
  } catch {
    return {
      applicable: false,
      sectionId,
      sectionCode: "",
      description: "",
      descriptionNepali: "",
      grossAmount,
      thresholdAmount: 0,
      rate: 0,
      tdsAmount: 0,
      netPayable: grossAmount,
      reason: "Invalid TDS section",
    };
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

const PurchaseVoucher: React.FC = () => {
  const {
    accounts,
    parties,
    items,
    warehouses,
    invoices,
    updateInvoice,
    addTdsEntry,
    companySettings,
    currentFiscalYear,
    currentUser,
    vatClassifications,
  } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  // ── Form State ───────────────────────────────────────────────────────────
  const [voucherDate, setVoucherDate] = useState(today());
  const [voucherDateNepali, setVoucherDateNepali] = useState("");
  const [partyId, setPartyId] = useState("");
  const [warehouseId, setWarehouseId] = useState(() => warehouses[0]?.id ?? "");
  const [paymentMode, setPaymentMode] = useState<"credit" | "cash" | "bank">("credit");
  const [narration, setNarration] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([emptyLine()]);
  const [billDiscountPercent, setBillDiscountPercent] = useState(0);
  const [billDiscountAmount, setBillDiscountAmount] = useState(0);

  const [enableTds, setEnableTds] = useState(false);
  const [tdsSection, setTdsSection] = useState("");
  const [tdsRate, setTdsRate] = useState(0);
  const [tdsResult, setTdsResult] = useState<TdsResult | null>(null);

  const selectedParty = useMemo(() => parties.find((p) => p.id === partyId), [parties, partyId]);

  const tdsSectionOptions = useMemo(() => {
    return getApplicableNepalTdsRates({
      personType: selectedParty?.personType || "entity",
      residency: selectedParty?.residency || "resident",
    }).filter((r) => r.rate !== null);
  }, [selectedParty]);

  const [saving, setSaving] = useState(false);

  // ── List view state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"new" | "list">("new");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // ── Lookups ──────────────────────────────────────────────────────────────
  const suppliers = useMemo(
    () => parties.filter((p) => p.type === "supplier" || p.type === "both"),
    [parties],
  );

  const purchaseItems = useMemo(() => items.filter((i) => i.isActive !== false), [items]);

  // ── Totals ───────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const subTotal = lines.reduce((s, l) => s + l.qty * l.rate, 0);
    const lineDiscount = lines.reduce((s, l) => s + l.discountAmount, 0);
    const taxable = lines.filter((l) => l.isTaxable).reduce((s, l) => s + l.netAmount, 0);
    const exempt = lines.filter((l) => !l.isTaxable).reduce((s, l) => s + l.netAmount, 0);
    const vat = lines.reduce((s, l) => s + l.vatAmount, 0);
    const billDisc =
      billDiscountAmount > 0
        ? billDiscountAmount
        : (taxable + exempt) * (billDiscountPercent / 100);
    const grandRaw = taxable + exempt + vat - billDisc;
    const grandTotal = Math.round(grandRaw);
    const autoRoundOff = parseFloat((grandTotal - grandRaw).toFixed(2));

    // TDS
    let tdsAmount = 0;
    if (enableTds && tdsSection) {
      const result = computeTds(grandTotal, tdsSection, selectedParty);
      tdsAmount = result.tdsAmount;
    }

    return {
      subTotal,
      lineDiscount,
      taxable,
      exempt,
      vat,
      billDisc,
      grandTotal,
      roundOff: autoRoundOff,
      tdsAmount,
      netPayable: grandTotal - tdsAmount,
    };
  }, [lines, billDiscountPercent, billDiscountAmount, enableTds, tdsSection, selectedParty]);

  // Auto-apply TDS when supplier has default nature of payment
  React.useEffect(() => {
    if (!partyId || !selectedParty) return;
    const defaultSection =
      selectedParty.defaultTdsNatureId ||
      (selectedParty.subjectToTds ? "sec87_contract_resident_1_5" : "");
    if (defaultSection) {
      setEnableTds(true);
      setTdsSection(defaultSection);
      const rateDef = getNepalTdsRate(defaultSection);
      if (rateDef?.rate != null) setTdsRate(rateDef.rate);
    }
  }, [partyId, selectedParty]);

  // Recompute TDS result whenever relevant state changes
  const currentTdsResult = useMemo<TdsResult | null>(() => {
    if (!enableTds || !tdsSection || totals.grandTotal <= 0) return null;
    return computeTds(totals.grandTotal, tdsSection, selectedParty);
  }, [enableTds, tdsSection, totals.grandTotal, selectedParty]);

  // ── Line handlers ────────────────────────────────────────────────────────
  const updateLine = (id: string, field: keyof PurchaseLine, value: any) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        let updated = { ...l, [field]: value };
        if (field === "itemId") {
          const item = items.find((i) => i.id === value);
          if (item) {
            updated = {
              ...updated,
              itemName: item.name,
              itemCode: item.code ?? item.sku ?? "",
              unit: item.unit ?? "PCS",
              rate: item.purchaseRate ?? item.costPrice ?? item.rate ?? 0,
              isTaxable: item.isTaxable !== false,
              vatRate: item.vatRate ?? 13,
              vatClassificationId: item.vatClassificationId,
              costPrice: item.costPrice ?? 0,
            };
          }
        }
        if (field === "vatClassificationId") {
          updated = { ...updated, vatClassificationId: value || undefined };
        }
        return computeLine(updated, vatClassifications || []);
      }),
    );
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (id: string) => {
    if (lines.length === 1) {
      toast.error("At least one line is required.");
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const resetForm = () => {
    setVoucherDate(today());
    setVoucherDateNepali("");
    setPartyId("");
    setPaymentMode("credit");
    setNarration("");
    setReferenceNo("");
    setReferenceDate("");
    setLines([emptyLine()]);
    setBillDiscountPercent(0);
    setBillDiscountAmount(0);
    setEnableTds(false);
    setTdsSection("");
    setTdsRate(0);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!partyId) {
      toast.error("Please select a supplier.");
      return;
    }
    const invalidLine = lines.some((l) => !l.itemId || l.qty <= 0 || l.rate <= 0);
    if (invalidLine) {
      toast.error("All lines must have a valid item, quantity, and rate.");
      return;
    }

    setSaving(true);
    try {
      const party = parties.find((p) => p.id === partyId);
      const { postManualPurchaseInvoice } = await import("@/lib/invoice/postManualPurchase");
      const paymentMethod =
        paymentMode === "cash" || paymentMode === "bank" ? paymentMode : "credit";
      const purchaseResult = await postManualPurchaseInvoice({
        companyId: String(
          (companySettings as { companyId?: string } | null)?.companyId ||
            companySettings?.id ||
            "main",
        ),
        financialYearId: currentFiscalYear?.id ?? null,
        userId: currentUser?.id || "manual-user",
        userRole: currentUser?.role || "accountant",
        transactionDate: voucherDate,
        supplierId: partyId || null,
        supplierName: party?.name ?? null,
        paymentMethod,
        paymentAccountId:
          paymentMethod === "cash"
            ? "acc-cash"
            : paymentMethod === "bank"
              ? "acc-bank"
              : null,
        items: lines
          .filter((l) => l.itemId)
          .map((l) => ({
            itemId: l.itemId,
            quantity: String(l.qty),
            unit: l.unit || "pcs",
            rate: String(l.rate),
            amount: String(l.totalAmount ?? l.netAmount ?? 0),
          })),
        subtotal: String(totals.subTotal),
        discount: String(totals.lineDiscount + totals.billDisc),
        tax: String(totals.vat),
        grandTotal: String(totals.grandTotal),
        currency: "NPR",
        narration: narration.trim() || `Purchase from ${party?.name ?? "supplier"}`,
      });

      if (purchaseResult.type !== "posting_completed") {
        throw new Error(purchaseResult.payload.safe_message || "Purchase posting failed");
      }

      if (enableTds && currentTdsResult?.applicable && totals.tdsAmount > 0) {
        await addTdsEntry({
          date: voucherDate,
          dateBS: voucherDateNepali,
          partyId,
          partyName: party?.name ?? "",
          partyPAN: party?.pan ?? "",
          section: currentTdsResult.sectionCode,
          paymentNature: currentTdsResult.description,
          grossAmount: totals.grandTotal,
          tdsRate: currentTdsResult.rate,
          tdsAmount: totals.tdsAmount,
          netAmount: totals.netPayable,
          status: "pending",
          fiscalYearBS: currentFiscalYear?.fiscalYearBS || currentFiscalYear?.name || "",
          tdsSectionId: currentTdsResult.sectionId,
          referenceInvoiceId: purchaseResult.payload.invoice_id,
          branchId: readActiveBranchId() || undefined,
        } as any);
      }

      toast.success(
        `Purchase posted locally · ${purchaseResult.payload.invoice_number}` +
          (purchaseResult.payload.sync_status === "synced"
            ? " · Synced"
            : " · Waiting to sync"),
      );
      resetForm();
      setActiveTab("list");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save purchase invoice.");
    } finally {
      setSaving(false);
    }
  };

  // ── Filter invoices ───────────────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    return invoices
      .filter(
        (inv) =>
          inv.type === "purchase-invoice" &&
          matchBranch((inv as { branchId?: string }).branchId) &&
          (statusFilter === "all" || inv.status === statusFilter) &&
          (searchTerm === "" ||
            (inv.invoiceNo ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (inv.partyName ?? "").toLowerCase().includes(searchTerm.toLowerCase())),
      )
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [invoices, statusFilter, searchTerm, matchBranch, branchFilter]);

  // ── TDS section change handler ────────────────────────────────────────────
  const handleTdsSectionChange = (sectionId: string) => {
    setTdsSection(sectionId);
    const section = getNepalTdsRate(sectionId);
    if (section?.rate != null) {
      setTdsRate(section.rate);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--ds-surface-muted)] overflow-y-auto p-4 md:p-6">
      {/* Page Header — direct div, NOT ActionToolbar with children */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Purchase invoice</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Create and manage purchase invoices with TDS
          </p>
        </div>
        <div className="flex items-center gap-2">
          {branchOptions.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
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
          <span className="rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-gray-100 text-gray-700">
            {companySettings?.name ?? "Company"}
          </span>
          {currentFiscalYear && (
            <span className="rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-blue-100 text-blue-700">
              FY {currentFiscalYear.name}
            </span>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${
              activeTab === "new"
                ? "bg-[var(--ds-action-primary)] text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            New Invoice
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${
              activeTab === "list"
                ? "bg-[var(--ds-action-primary)] text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Invoice List
          </button>
        </div>
      </div>

      {/* ── NEW INVOICE TAB ────────────────────────────────────────────────── */}
      {activeTab === "new" && (
        <div className="space-y-4">
          {/* Header fields */}
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Date AD */}
              <div>
                <label className="text-[12px] font-medium text-gray-600 mb-1 block">
                  Date (AD)
                </label>
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                />
              </div>

              {/* Date BS — wrap NepaliDatePicker in div; no className on component */}
              <div>
                <label className="text-[12px] font-medium text-gray-600 mb-1 block">
                  Date (BS)
                </label>
                <div className="w-full">
                  <NepaliDatePicker
                    value={voucherDateNepali}
                    onChange={(val: string) => setVoucherDateNepali(val)}
                  />
                </div>
              </div>

              {/* Supplier */}
              <div>
                <label className="text-[12px] font-medium text-gray-600 mb-1 block">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                >
                  <option value="">— Select Supplier —</option>
                  {suppliers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.pan ? `(PAN: ${p.pan})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouse */}
              <div>
                <label className="text-[12px] font-medium text-gray-600 mb-1 block">
                  Warehouse
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                >
                  <option value="">— Select Warehouse —</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="text-[12px] font-medium text-gray-600 mb-1 block">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as "credit" | "cash" | "bank")}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                >
                  <option value="credit">Credit</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              {/* Reference No */}
              <div>
                <label className="text-[12px] font-medium text-gray-600 mb-1 block">
                  Supplier Invoice No.
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="Supplier's invoice number"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                />
              </div>

              {/* Reference Date */}
              <div>
                <label className="text-[12px] font-medium text-gray-600 mb-1 block">
                  Supplier Invoice Date
                </label>
                <input
                  type="date"
                  value={referenceDate}
                  onChange={(e) => setReferenceDate(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                />
              </div>

              {/* Narration */}
              <div>
                <label className="text-[12px] font-medium text-gray-600 mb-1 block">
                  Narration
                </label>
                <input
                  type="text"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="Purchase remarks…"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-[var(--ds-surface-muted)]">
              <h3 className="text-[12px] font-semibold text-gray-700">Line Items</h3>
              <button
                type="button"
                onClick={addLine}
                className="h-7 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Line
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px]">
                <thead>
                  <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                      Item
                    </th>
                    <th className="px-3 py-2.5 text-center text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-20">
                      Qty
                    </th>
                    <th className="px-3 py-2.5 text-center text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-16">
                      Unit
                    </th>
                    <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                      Rate
                    </th>
                    <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-20">
                      Disc %
                    </th>
                    <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                      Net Amt
                    </th>
                    <th className="px-3 py-2.5 text-center text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-16">
                      VAT
                    </th>
                    <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                      Total
                    </th>
                    <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                      Batch
                    </th>
                    <th className="px-3 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line) => (
                    <tr key={line.id} className="hover:bg-gray-50">
                      {/* Item */}
                      <td className="px-2 py-1.5">
                        <select
                          value={line.itemId}
                          onChange={(e) => updateLine(line.id, "itemId", e.target.value)}
                          className="h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                        >
                          <option value="">— Select Item —</option>
                          {purchaseItems.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} {i.code ? `(${i.code})` : ""}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Qty — plain input instead of AmountInput; no className on component */}
                      <td className="px-2 py-1.5">
                        <div className="w-full">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={line.qty}
                            onChange={(e) =>
                              updateLine(line.id, "qty", parseFloat(e.target.value) || 0)
                            }
                            className="h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full text-right"
                          />
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={line.unit}
                          onChange={(e) => updateLine(line.id, "unit", e.target.value)}
                          className="h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full text-center"
                        />
                      </td>

                      {/* Rate — plain input; no className on AmountInput component */}
                      <td className="px-2 py-1.5">
                        <div className="w-full">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.rate}
                            onChange={(e) =>
                              updateLine(line.id, "rate", parseFloat(e.target.value) || 0)
                            }
                            className="h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full text-right"
                          />
                        </div>
                      </td>

                      {/* Discount % — plain input; no className on AmountInput component */}
                      <td className="px-2 py-1.5">
                        <div className="w-full">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={line.discountPercent}
                            onChange={(e) =>
                              updateLine(
                                line.id,
                                "discountPercent",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full text-right"
                          />
                        </div>
                      </td>

                      {/* Net Amount */}
                      <td className="px-3 py-1.5 text-right font-mono text-[12px] text-gray-700">
                        {money(line.netAmount)}
                      </td>

                      {/* VAT classification badge */}
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <select
                            value={line.vatClassificationId || ""}
                            onChange={(e) =>
                              updateLine(line.id, "vatClassificationId", e.target.value)
                            }
                            className="h-7 px-1.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full max-w-[110px]"
                          >
                            <option value="">Default</option>
                            {(vatClassifications || []).map((vc) => (
                              <option key={vc.id} value={vc.id}>
                                {vc.name}
                              </option>
                            ))}
                          </select>
                          {line.vatLabel && (
                            <span
                              className={`rounded px-2 py-0.5 text-[12px] font-semibold uppercase ${vatBadgeCls(line.vatBadgeVariant)}`}
                            >
                              {line.vatLabel}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-3 py-1.5 text-right font-mono text-[12px] font-semibold text-gray-800">
                        {money(line.totalAmount)}
                      </td>

                      {/* Batch No */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={line.batchNo ?? ""}
                          onChange={(e) => updateLine(line.id, "batchNo", e.target.value)}
                          placeholder="Batch #"
                          className="h-8 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                        />
                      </td>

                      {/* Remove */}
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals + TDS */}
            <div className="border-t border-gray-200 px-4 py-4">
              <div className="flex flex-col lg:flex-row gap-6 justify-between">
                {/* TDS Section */}
                <div className="flex-1 max-w-md">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[12px] font-semibold text-amber-800 uppercase tracking-wide">
                        TDS (Tax Deducted at Source)
                      </h4>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableTds}
                          onChange={(e) => {
                            setEnableTds(e.target.checked);
                            if (!e.target.checked) setTdsSection("");
                          }}
                          className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500/20"
                        />
                        <span className="text-[12px] font-medium text-amber-800">Enable TDS</span>
                      </label>
                    </div>

                    {enableTds && (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[12px] font-semibold text-amber-700 mb-0.5 block">
                            TDS Section
                          </label>
                          <select
                            value={tdsSection}
                            onChange={(e) => handleTdsSectionChange(e.target.value)}
                            className="h-8 px-2.5 text-[12px] border border-amber-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 w-full"
                          >
                            <option value="">— Select Section —</option>
                            {tdsSectionOptions.map((s) => (
                              <option key={s.id} value={s.id}>
                                Sec {s.sectionCode} — {s.description} ({s.rate ?? "Slab"}%)
                              </option>
                            ))}
                          </select>
                        </div>

                        {tdsSection && (
                          <div>
                            <label className="text-[12px] font-semibold text-amber-700 mb-0.5 block">
                              TDS Rate (%)
                            </label>
                            <div className="w-full">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={currentTdsResult?.rate ?? tdsRate}
                                readOnly
                                className="h-8 px-2.5 text-[12px] border border-amber-300 rounded-md bg-gray-50 w-full text-right"
                              />
                            </div>
                          </div>
                        )}

                        {currentTdsResult &&
                          !currentTdsResult.applicable &&
                          currentTdsResult.reason && (
                            <p className="text-[12px] text-amber-700">{currentTdsResult.reason}</p>
                          )}

                        {currentTdsResult && currentTdsResult.applicable && (
                          <div className="mt-2 bg-white border border-amber-200 rounded p-2 space-y-1 text-[12px]">
                            <div className="flex justify-between text-amber-700">
                              <span>
                                Section: {/* Access sectionCode not sectionId */}
                                {currentTdsResult.sectionCode ?? "—"}
                              </span>
                              <span>{currentTdsResult.rate}%</span>
                            </div>
                            {currentTdsResult.description && (
                              <p className="text-amber-600 text-[12px]">
                                {currentTdsResult.description}
                              </p>
                            )}
                            {/* For 'reason' — use optional chaining / type guard to avoid TS error */}
                            {(currentTdsResult as any).reason && (
                              <p className="text-amber-600 text-[12px] italic">
                                {(currentTdsResult as any).reason}
                              </p>
                            )}
                            <div className="flex justify-between font-semibold text-amber-800 border-t border-amber-100 pt-1">
                              <span>TDS Amount</span>
                              <span className="font-mono">{money(currentTdsResult.tdsAmount)}</span>
                            </div>
                            <div className="flex justify-between text-amber-700">
                              <span>Net Payable</span>
                              <span className="font-mono">
                                {money(currentTdsResult.netPayable)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div className="w-full max-w-xs space-y-1.5 text-[12px]">
                  <div className="flex justify-between text-gray-600">
                    <span>Sub Total</span>
                    <span className="font-mono">{money(totals.subTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Line Discount</span>
                    <span className="font-mono">({money(totals.lineDiscount)})</span>
                  </div>

                  {/* Bill Discount — plain input; no className on AmountInput component */}
                  <div className="flex items-center justify-between text-gray-600 gap-2">
                    <span className="shrink-0">Bill Disc %</span>
                    <div className="w-24">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={billDiscountPercent}
                        onChange={(e) => {
                          setBillDiscountPercent(parseFloat(e.target.value) || 0);
                          setBillDiscountAmount(0);
                        }}
                        className="h-7 px-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full text-right"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-gray-600">
                    <span>Taxable Amount</span>
                    <span className="font-mono">{money(totals.taxable)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Exempt Amount</span>
                    <span className="font-mono">{money(totals.exempt)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>VAT (13%)</span>
                    <span className="font-mono">{money(totals.vat)}</span>
                  </div>

                  {enableTds && totals.tdsAmount > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>TDS Deduction</span>
                      <span className="font-mono">({money(totals.tdsAmount)})</span>
                    </div>
                  )}

                  {totals.roundOff !== 0 && (
                    <div className="flex justify-between text-gray-500 text-[12px]">
                      <span>Round Off</span>
                      <span className="font-mono">{money(totals.roundOff)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-gray-800 border-t border-gray-200 pt-2 text-[13px]">
                    <span>Grand Total</span>
                    <span className="font-mono text-[var(--ds-action-primary)]">{money(totals.grandTotal)}</span>
                  </div>

                  {enableTds && totals.tdsAmount > 0 && (
                    <div className="flex justify-between font-semibold text-amber-700 border-t border-amber-100 pt-1.5">
                      <span>Net Payable (after TDS)</span>
                      <span className="font-mono">{money(totals.netPayable)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={resetForm}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {/* "danger" variant NOT "destructive" */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-8 px-4 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIST TAB ──────────────────────────────────────────────────────────── */}
      {activeTab === "list" && (
        <div className="space-y-4">
          <div className="no-print bg-white border border-gray-200 rounded-md p-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by invoice no. or supplier…"
                className="h-8 pl-8 pr-3 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
            >
              <option value="all">All statuses</option>
              <option value="posted">Posted</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <span className="text-[12px] text-gray-500">
              {filteredInvoices.length} invoice{filteredInvoices.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New invoice
            </button>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message="No purchase invoices found"
                hint='Adjust filters or switch to "New invoice" to create one.'
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse">
                  <thead>
                    <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
                      <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                        Invoice no.
                      </th>
                      <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                        Date
                      </th>
                      <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                        Supplier
                      </th>
                      <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                        Amount
                      </th>
                      <th className="px-3 py-2.5 text-center text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                        TDS
                      </th>
                      <th className="px-3 py-2.5 text-center text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-500 uppercase tracking-wide w-16">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[var(--ds-action-primary)]"
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        <td className="px-3 py-2.5 text-[12px] font-mono font-medium text-gray-800 border-b border-gray-100">
                          {inv.invoiceNo}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100">
                          {inv.dateNepali || inv.date}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100">
                          {inv.partyName || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[12px] font-medium text-gray-800 border-b border-gray-100">
                          {money(inv.grandTotal ?? 0)}
                        </td>
                        <td className="px-3 py-2.5 text-center border-b border-gray-100">
                          {inv.tdsAmount && inv.tdsAmount > 0 ? (
                            <span className="inline-block rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-amber-100 text-amber-700">
                              {money(inv.tdsAmount)}
                            </span>
                          ) : (
                            <span className="text-[12px] text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center border-b border-gray-100">
                          <span
                            className={`rounded px-2 py-0.5 text-[12px] font-semibold uppercase ${statusBadgeCls(inv.status)}`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right border-b border-gray-100">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInvoice(inv);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 border-t border-gray-200 bg-[var(--ds-surface-muted)] text-[12px] text-gray-500">
                {filteredInvoices.length} purchase invoice{filteredInvoices.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Invoice Detail Modal ──────────────────────────────────────────────── */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedInvoice(null);
          }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-[var(--ds-surface-muted)]">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-gray-800">
                  Invoice: {selectedInvoice.invoiceNo}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[12px] font-semibold uppercase ${statusBadgeCls(selectedInvoice.status)}`}
                >
                  {selectedInvoice.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Date
                  </p>
                  <p className="text-gray-800">
                    {selectedInvoice.dateNepali || selectedInvoice.date}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Supplier
                  </p>
                  <p className="text-gray-800">{selectedInvoice.partyName || "—"}</p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Payment Mode
                  </p>
                  <p className="text-gray-800 capitalize">{selectedInvoice.paymentMode || "—"}</p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Grand Total
                  </p>
                  <p className="text-gray-800 font-mono font-semibold">
                    {money(selectedInvoice.grandTotal ?? 0)}
                  </p>
                </div>
              </div>

              {/* Lines */}
              {selectedInvoice.lines && selectedInvoice.lines.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Line Items
                  </p>
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
                          <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">
                            Item
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase">
                            Qty
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase">
                            Rate
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedInvoice.lines.map((line: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-gray-700">{line.itemName}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-700">
                              {line.qty} {line.unit}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-700">
                              {money(line.rate)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-gray-800">
                              {money(line.totalAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedInvoice.narration && (
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Narration
                  </p>
                  <p className="text-[12px] text-gray-700 bg-[var(--ds-surface-muted)] rounded px-3 py-2 border border-gray-200">
                    {selectedInvoice.narration}
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-[var(--ds-surface-muted)] flex justify-end gap-2">
              {selectedInvoice.status === "posted" && (
                <button
                  type="button"
                  onClick={async () => {
                    const reason = window.prompt("Enter cancellation reason:");
                    if (!reason) return;
                    try {
                      await updateInvoice(selectedInvoice.id, {
                        status: "cancelled",
                        cancellationReason: reason,
                      });
                      toast.success("Invoice cancelled.");
                      setSelectedInvoice(null);
                    } catch {
                      toast.error("Failed to cancel invoice.");
                    }
                  }}
                  className="h-8 px-3 bg-white border border-red-300 text-red-600 text-[12px] font-medium rounded-md hover:bg-red-50 transition-colors"
                >
                  Cancel Invoice
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseVoucher;
