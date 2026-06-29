// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sales / Purchase Order entry form.
 *
 * Orders are pre-invoice commitments. They do NOT post to ledgers and they
 * do NOT move stock. Their lifecycle is:
 *
 *     DRAFT → APPROVED → FULFILLED / PARTIAL / CANCELLED
 *
 * APPROVE       : requires admin / manager role.
 * FULFILL       : "Create Invoice from Order" stages the draft into
 *                 sessionStorage under "sutra:order-draft" and navigates the
 *                 user to the Billing page. The Sales/Purchase Invoice form
 *                 then picks it up and prefills the new invoice.
 * CANCEL        : prompts for a reason and freezes the order.
 *
 * Persistence: localStorage key "sutra:orders". This keeps Step 24 self-
 * contained without modifying the global Zustand store.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  PartySelect,
  NepaliDatePicker,
  AmountInput,
  ItemSelect,
  ConfirmDialog,
} from "../ui";
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  CheckCircle2,
  XCircle,
  FileText,
  ClipboardList,
  Send,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { computeVAT } from "@/lib/taxUtils";
import { PartyType } from "@/lib/types";
import toast from "react-hot-toast";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const uid = () => Math.random().toString(36).slice(2, 10);

export type OrderStatus = "draft" | "approved" | "fulfilled" | "partial" | "cancelled";

export interface OrderLine {
  id: string;
  itemId: string;
  itemName: string;
  itemCode?: string;
  hsnCode?: string;
  description?: string;
  qty: number;
  unit?: string;
  rate: number;
  discountPercent: number;
  isTaxable: boolean;
  vatRate: number;
}

export interface OrderRecord {
  id: string;
  type: "sales" | "purchase";
  orderNo: string;
  date: string;
  expectedDate?: string;
  reference?: string;
  partyId: string;
  partyName: string;
  lines: OrderLine[];
  subTotal: number;
  taxableAmount: number;
  exemptAmount: number;
  vatAmount: number;
  grandTotal: number;
  narration?: string;
  status: OrderStatus;
  cancelReason?: string;
  fulfilledInvoiceIds: string[];
  fulfilledPercent: number;
  createdAt: string;
  approvedAt?: string;
}

const STORAGE_KEY = "sutra:orders";

export function loadOrders(): OrderRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
export function saveOrders(list: OrderRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
export function nextOrderNo(type: "sales" | "purchase"): string {
  const prefix = type === "sales" ? "SO" : "PO";
  const list = loadOrders().filter((o) => o.type === type);
  let max = 0;
  for (const o of list) {
    const m = String(o.orderNo || "").match(/(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

interface OrderFormProps {
  type: "sales" | "purchase";
  orderId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

const emptyLine = (): OrderLine => ({
  id: uid(),
  itemId: "",
  itemName: "",
  itemCode: "",
  hsnCode: "",
  description: "",
  qty: 1,
  unit: "",
  rate: 0,
  discountPercent: 0,
  isTaxable: true,
  vatRate: 13,
});

const OrderForm: React.FC<OrderFormProps> = ({ type, orderId, onSave, onCancel }) => {
  const { items, currentUser, companySettings, setCurrentPage } = useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";
  const partyTypeFilter = type === "sales" ? PartyType.CUSTOMER : PartyType.SUPPLIER;

  const [orders, setOrdersState] = useState<OrderRecord[]>(() => loadOrders());
  const existing = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);
  const isEdit = !!existing;
  const locked = existing?.status === "cancelled" || existing?.status === "fulfilled";
  const isApproved =
    existing?.status === "approved" ||
    existing?.status === "partial" ||
    existing?.status === "fulfilled";

  const role = (currentUser?.role || "").toLowerCase();
  const canApprove = role === "admin" || role === "manager";

  const [date, setDate] = useState(existing?.date || new Date().toISOString().split("T")[0]);
  const [expectedDate, setExpectedDate] = useState(existing?.expectedDate || "");
  const [reference, setReference] = useState(existing?.reference || "");
  const [partyId, setPartyId] = useState(existing?.partyId || "");
  const [narration, setNarration] = useState(existing?.narration || "");
  const [lines, setLines] = useState<OrderLine[]>(
    existing?.lines?.length ? existing.lines : [emptyLine()],
  );

  const [dirty, setDirty] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmAbort, setConfirmAbort] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [saving, setSaving] = useState(false);

  const markDirty = () => setDirty(true);

  const orderNoPreview = useMemo(
    () => existing?.orderNo || nextOrderNo(type),

    [existing?.orderNo, type],
  );

  const computation = useMemo(() => {
    const filtered = lines
      .filter((l) => l.itemId && Number(l.qty) > 0)
      .map((l) => ({
        itemName: l.itemName,
        qty: Number(l.qty) || 0,
        rate: Number(l.rate) || 0,
        discount: Number(l.discountPercent) || 0,
        isTaxable: !!l.isTaxable,
        vatRate: Number(l.vatRate) || 0,
      }));
    return computeVAT(filtered);
  }, [lines]);

  const updateLine = (id: string, patch: Partial<OrderLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    markDirty();
  };
  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
    markDirty();
  };
  const removeLine = (id: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
    markDirty();
  };

  const validate = (): string | null => {
    if (!partyId) return `Select a ${type === "sales" ? "customer" : "supplier"}.`;
    if (!date) return "Date is required.";
    const valid = lines.filter((l) => l.itemId);
    if (!valid.length) return "At least one line item is required.";
    for (const l of valid) {
      if (!(Number(l.qty) > 0)) return "Quantity must be greater than zero on each line.";
      if (!(Number(l.rate) >= 0)) return "Rate cannot be negative.";
    }
    return null;
  };

  const persist = (next: OrderRecord[]) => {
    saveOrders(next);
    setOrdersState(next);
  };

  const buildRecord = (status: OrderStatus): OrderRecord => {
    const validLines = lines.filter((l) => l.itemId && Number(l.qty) > 0);
    return {
      id: existing?.id || uid(),
      type,
      orderNo: existing?.orderNo || orderNoPreview,
      date,
      expectedDate: expectedDate || undefined,
      reference: reference || undefined,
      partyId,
      partyName: existing?.partyName || "",
      lines: validLines,
      subTotal: computation.subTotal,
      taxableAmount: computation.taxableTotal,
      exemptAmount: computation.exemptTotal,
      vatAmount: computation.vatAmount,
      grandTotal: computation.grandTotal,
      narration: narration.trim(),
      status,
      cancelReason: existing?.cancelReason,
      fulfilledInvoiceIds: existing?.fulfilledInvoiceIds || [],
      fulfilledPercent: existing?.fulfilledPercent || 0,
      createdAt: existing?.createdAt || new Date().toISOString(),
      approvedAt: existing?.approvedAt,
    };
  };

  const handleSave = async (status: OrderStatus) => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const rec = buildRecord(status);
      // pull party name from select (lazy)
      try {
        const partiesRaw = (window as any).__sutraParties || [];
        const p = partiesRaw.find?.((x: any) => x.id === partyId);
        if (p) rec.partyName = p.name;
      } catch {
        /* ignore */
      }
      const next = isEdit ? orders.map((o) => (o.id === rec.id ? rec : o)) : [...orders, rec];
      persist(next);
      toast.success(
        `${type === "sales" ? "Sales" : "Purchase"} order ${rec.orderNo} saved${status === "approved" ? " & approved" : ""}.`,
      );
      setDirty(false);
      onSave?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save order.");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!canApprove) {
      toast.error("Approval requires manager or admin role.");
      return;
    }
    if (!existing) {
      await handleSave("approved");
      return;
    }
    const next = orders.map((o) =>
      o.id === existing.id
        ? ({ ...o, status: "approved", approvedAt: new Date().toISOString() } as OrderRecord)
        : o,
    );
    persist(next);
    toast.success(`Order ${existing.orderNo} approved.`);
    onSave?.();
  };

  const handleCancelOrder = (reasonFromDialog?: string) => {
    if (!existing) return;
    const finalReason = reasonFromDialog?.trim() || cancelReason.trim();
    if (!finalReason) {
      toast.error("Cancellation reason is required.");
      return;
    }
    const next = orders.map((o) =>
      o.id === existing.id
        ? ({ ...o, status: "cancelled", cancelReason: finalReason } as OrderRecord)
        : o,
    );
    persist(next);
    setConfirmCancel(false);
    toast.success(`Order ${existing.orderNo} cancelled.`);
    onSave?.();
  };

  const handleConvertToInvoice = () => {
    if (!existing) {
      toast.error("Save the order first.");
      return;
    }
    if (existing.status === "cancelled") {
      toast.error("Cancelled orders cannot be invoiced.");
      return;
    }
    try {
      sessionStorage.setItem(
        "sutra:order-draft",
        JSON.stringify({
          orderId: existing.id,
          type,
          partyId: existing.partyId,
          lines: existing.lines,
          orderRef: existing.orderNo,
          narration: existing.narration,
        }),
      );
    } catch {
      /* ignore */
    }
    toast.success("Order staged. Opening invoice form…");
    setCurrentPage?.("invoices");
    onSave?.();
  };

  const handleBack = () => {
    if (dirty && !locked) setConfirmAbort(true);
    else onCancel?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleBack();
      } else if (e.key === "F12" && !locked) {
        e.preventDefault();
        handleSave("draft");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, partyId, date, expectedDate, reference, narration, dirty, locked]);

  // ============= RENDER =============
  return (
    <div className="flex flex-col gap-5 animate-fadeIn text-xs">
      <div className="flex items-center justify-between border-b border-[#9DC07A] pb-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 rounded-md hover:bg-[#EBF5E2] text-[#000000]">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-[#000000] tracking-tight flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[#1557b0]" />
              {isEdit ? `EDIT ${type.toUpperCase()} ORDER` : `NEW ${type.toUpperCase()} ORDER`}
            </h2>
            <p className="text-[11px] text-[#000000] mt-0.5 uppercase tracking-wider font-bold">
              {type === "sales"
                ? "Customer commitment — pre-invoice"
                : "Supplier commitment — pre-invoice"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={type === "sales" ? "success" : "info"} size="md">
            {type === "sales" ? "SALES ORDER" : "PURCHASE ORDER"}
          </Badge>
          <Badge
            variant={
              existing?.status === "approved"
                ? "success"
                : existing?.status === "fulfilled"
                  ? "success"
                  : existing?.status === "partial"
                    ? "warning"
                    : existing?.status === "cancelled"
                      ? "danger"
                      : "default"
            }
          >
            {(existing?.status || "NEW").toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Header */}
      <Card border padding="md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[#000000]">Order No</span>
            <span className="inline-flex items-center px-2.5 py-1.5 rounded-md bg-[#EBF5E2] border border-[#9DC07A] font-mono font-bold text-[#000000]">
              {orderNoPreview}
            </span>
          </div>
          <NepaliDatePicker
            label="Order Date"
            value={date}
            onChange={(v) => {
              setDate(v);
              markDirty();
            }}
            required
            disabled={locked}
          />
          <NepaliDatePicker
            label="Expected Delivery"
            value={expectedDate}
            onChange={(v) => {
              setExpectedDate(v);
              markDirty();
            }}
            disabled={locked}
          />
          <Input
            label="Reference"
            value={reference}
            onChange={(v) => {
              setReference(v);
              markDirty();
            }}
            placeholder="Quotation, RFQ, etc."
            disabled={locked}
          />
        </div>
      </Card>

      {/* Party */}
      <Card border padding="md">
        <h3 className="text-[11px] font-bold text-[#000000] uppercase tracking-wider mb-3">
          {type === "sales" ? "Customer" : "Supplier"}
        </h3>
        <PartySelect
          label={type === "sales" ? "Customer" : "Supplier"}
          value={partyId}
          onChange={(v) => {
            setPartyId(v);
            markDirty();
          }}
          partyTypeFilter={partyTypeFilter}
          disabled={locked}
        />
      </Card>

      {/* Lines */}
      <Card border padding="none">
        <div className="flex items-center justify-between p-4 border-b border-[#9DC07A]">
          <h3 className="text-[11px] font-bold text-[#000000] uppercase tracking-wider">
            Line Items
          </h3>
          {!locked && (
            <Button
              variant="outline"
              size="xs"
              icon={<Plus className="h-3 w-3" />}
              onClick={addLine}
            >
              Add Row
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-[#EBF5E2]">
              <tr className="text-left text-[#000000]">
                <th className="p-2 w-10">#</th>
                <th className="p-2 min-w-[220px]">Item</th>
                <th className="p-2 w-24 text-right">Qty</th>
                <th className="p-2 w-24 text-right">Rate</th>
                <th className="p-2 w-20 text-right">Disc %</th>
                <th className="p-2 w-20 text-right">VAT %</th>
                <th className="p-2 w-28 text-right">Amount</th>
                {!locked && <th className="p-2 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const base = round2(
                  (l.qty || 0) * (l.rate || 0) * (1 - (l.discountPercent || 0) / 100),
                );
                const vat = l.isTaxable ? round2((base * (l.vatRate || 0)) / 100) : 0;
                return (
                  <tr key={l.id} className="border-t border-[#9DC07A]">
                    <td className="p-2 font-mono text-[#000000]">{idx + 1}</td>
                    <td className="p-2">
                      <ItemSelect
                        value={l.itemId}
                        onChange={(itemId: string) => {
                          const it = items.find((x: any) => x.id === itemId);
                          updateLine(l.id, {
                            itemId,
                            itemName: it?.name || "",
                            itemCode: it?.code || "",
                            hsnCode: it?.hsnCode || "",
                            unit: it?.unit || "",
                            rate:
                              type === "sales"
                                ? Number(it?.salesRate || 0)
                                : Number(it?.purchaseRate || 0),
                            isTaxable: it?.isTaxable ?? true,
                            vatRate: Number(it?.vatRate ?? 13),
                          });
                        }}
                        disabled={locked}
                      />
                    </td>
                    <td className="p-2">
                      <AmountInput
                        value={l.qty}
                        onChange={(v) => updateLine(l.id, { qty: v })}
                        disabled={locked}
                      />
                    </td>
                    <td className="p-2">
                      <AmountInput
                        value={l.rate}
                        onChange={(v) => updateLine(l.id, { rate: v })}
                        disabled={locked}
                      />
                    </td>
                    <td className="p-2">
                      <AmountInput
                        value={l.discountPercent}
                        onChange={(v) => updateLine(l.id, { discountPercent: v })}
                        disabled={locked}
                      />
                    </td>
                    <td className="p-2">
                      <AmountInput
                        value={l.vatRate}
                        onChange={(v) => updateLine(l.id, { vatRate: v })}
                        disabled={locked}
                      />
                    </td>
                    <td className="p-2 text-right font-mono">{formatNumber(base + vat)}</td>
                    {!locked && (
                      <td className="p-2 text-right">
                        <button
                          onClick={() => removeLine(l.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end p-4 border-t border-[#9DC07A] bg-[#EBF5E2]">
          <div className="w-full md:w-80 flex flex-col gap-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-[#000000]">Sub Total</span>
              <span className="font-mono">
                {symbol} {formatNumber(computation.subTotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#000000]">Taxable</span>
              <span className="font-mono">
                {symbol} {formatNumber(computation.taxableTotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#000000]">Exempt</span>
              <span className="font-mono">
                {symbol} {formatNumber(computation.exemptTotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#000000]">VAT</span>
              <span className="font-mono">
                {symbol} {formatNumber(computation.vatAmount)}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#9DC07A] pt-2 mt-1 font-bold text-[#000000]">
              <span>Grand Total</span>
              <span className="font-mono">
                {symbol} {formatNumber(computation.grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card border padding="md">
        <Input
          label="Narration"
          value={narration}
          onChange={(v) => {
            setNarration(v);
            markDirty();
          }}
          placeholder="Notes / terms (optional)"
          disabled={locked}
        />
      </Card>

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-[#9DC07A] pt-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {isEdit && !locked && (
            <Button
              variant="danger"
              size="sm"
              icon={<XCircle className="h-4 w-4" />}
              onClick={() => setConfirmCancel(true)}
            >
              Cancel Order
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleBack}>
            Back (Esc)
          </Button>
          {!locked && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSave("draft")}
              loading={saving}
              icon={<Save className="h-4 w-4" />}
            >
              Save Draft
            </Button>
          )}
          {!locked && !isApproved && canApprove && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleApprove}
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              Approve Order
            </Button>
          )}
          {isApproved && existing?.status !== "fulfilled" && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleConvertToInvoice}
              icon={<Send className="h-4 w-4" />}
            >
              Create Invoice from Order
            </Button>
          )}
        </div>
      </div>

      {/* Confirm — cancel order */}
      <ConfirmDialog
        isOpen={confirmCancel}
        title={`Cancel ${type === "sales" ? "Sales" : "Purchase"} Order?`}
        message="Cancellation freezes this order. Reason is required."
        requireReason={true}
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Customer withdrew request"
        confirmText="Cancel Order"
        cancelText="Keep Open"
        onConfirm={(reason) => {
          setCancelReason(reason || "");
          handleCancelOrder(reason || "");
          setConfirmCancel(false);
        }}
        onClose={() => setConfirmCancel(false)}
        danger={true}
      />

      {/* Confirm — abandon edits */}
      <ConfirmDialog
        isOpen={confirmAbort}
        title="Discard unsaved changes?"
        message="You have unsaved edits. Leave without saving?"
        confirmText="Discard"
        cancelText="Keep Editing"
        onConfirm={() => {
          setConfirmAbort(false);
          onCancel?.();
        }}
        onClose={() => setConfirmAbort(false)}
      />
    </div>
  );
};

export default OrderForm;
