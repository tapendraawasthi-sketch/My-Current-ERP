// src/pages/OrderVoucherPage.tsx
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import toast from "@/lib/appToast";
import { Plus, Search, X } from "lucide-react";
import { SaleType, PurchaseType } from "../lib/busyTypes";
import { formatNumber } from "../lib/utils";

interface OrderLine {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  deliveryDate?: string;
  pendingQty: number;
  deliveredQty: number;
}

interface Order {
  id: string;
  orderNo: string;
  date: string;
  partyId: string;
  partyName: string;
  orderType: string;
  lines: OrderLine[];
  narration: string;
  totalAmount: number;
  status: "open" | "partial" | "completed" | "cancelled";
  createdAt: string;
}

interface Props {
  type: "sales_order" | "purchase_order";
}

const SALE_TYPES = Object.values(SaleType);
const PURCHASE_TYPES = Object.values(PurchaseType);

export default function OrderVoucherPage({ type }: Props) {
  const { accounts, items, parties } = useStore();
  const isSalesOrder = type === "sales_order";
  const title = isSalesOrder ? "Sales order" : "Purchase order";
  const prefix = isSalesOrder ? "SO-" : "PO-";

  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Order["status"]>("all");
  const [showForm, setShowForm] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [partyId, setPartyId] = useState("");
  const [orderType, setOrderType] = useState<string>(
    isSalesOrder ? SaleType.LOCAL_GST_18 : PurchaseType.LOCAL_GST_18,
  );
  const [narration, setNarration] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<Omit<OrderLine, "id" | "pendingQty" | "deliveredQty">[]>([
    { itemId: "", itemName: "", quantity: 1, unit: "Pcs", rate: 0, amount: 0 },
  ]);

  const filtered = useMemo(
    () =>
      orders.filter((o) => {
        const matchSearch =
          o.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.partyName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === "all" || o.status === statusFilter;
        return matchSearch && matchStatus;
      }),
    [orders, searchTerm, statusFilter],
  );

  const partyList = (parties || []).filter((p: any) => {
    if (isSalesOrder) return p.type === "customer" || p.type === "both";
    return p.type === "supplier" || p.type === "both";
  });

  const openAdd = () => {
    setEditOrder(null);
    setDate(new Date().toISOString().split("T")[0]);
    setPartyId("");
    setOrderType(isSalesOrder ? SaleType.LOCAL_GST_18 : PurchaseType.LOCAL_GST_18);
    setNarration("");
    setDueDate("");
    setLines([{ itemId: "", itemName: "", quantity: 1, unit: "Pcs", rate: 0, amount: 0 }]);
    setShowForm(true);
  };

  const handleLineChange = (idx: number, field: string, value: any) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const updated: any = { ...l, [field]: value };
        if (field === "itemId") {
          const item = (items || []).find((it: any) => it.id === value);
          if (item) {
            updated.itemName = item.name;
            updated.rate = isSalesOrder
              ? (item as any).saleRate || (item as any).sellingPrice || 0
              : (item as any).purchaseRate || 0;
            updated.unit = (item as any).unit || "Pcs";
          }
        }
        if (field === "quantity" || field === "rate") {
          const qty = field === "quantity" ? +value : updated.quantity;
          const rate = field === "rate" ? +value : updated.rate;
          updated.amount = qty * rate;
        }
        return updated;
      }),
    );
  };

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { itemId: "", itemName: "", quantity: 1, unit: "Pcs", rate: 0, amount: 0 },
    ]);
  const removeLine = (idx: number) => {
    if (lines.length > 1) setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalAmount = lines.reduce((sum, l) => sum + l.amount, 0);

  const handleSave = () => {
    if (!partyId) {
      toast.error("Select a party");
      return;
    }
    if (lines.some((l) => !l.itemId)) {
      toast.error("All item rows must have an item selected");
      return;
    }
    const party = partyList.find((p: any) => p.id === partyId);
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNo: `${prefix}${String(orders.length + 1).padStart(4, "0")}`,
      date,
      partyId,
      partyName: (party as any)?.name || "",
      orderType,
      lines: lines.map((l, i) => ({
        ...l,
        id: `ol-${i}`,
        pendingQty: l.quantity,
        deliveredQty: 0,
      })),
      narration,
      totalAmount,
      status: "open",
      createdAt: new Date().toISOString(),
    };
    setOrders((prev) =>
      editOrder
        ? prev.map((o) =>
            o.id === editOrder.id
              ? { ...newOrder, id: editOrder.id, orderNo: editOrder.orderNo }
              : o,
          )
        : [...prev, newOrder],
    );
    toast.success(`${title} ${editOrder ? "updated" : "saved"} — ${newOrder.orderNo}`);
    setShowForm(false);
  };

  const cancelOrder = (id: string) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "cancelled" } : o)));
    toast.success("Order cancelled");
  };

  const inputCls =
    "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
  const labelCls = "text-[12px] font-medium text-gray-600 mb-1 block";

  const statusBadge = (status: Order["status"]) => {
    const map: Record<Order["status"], string> = {
      open: "bg-blue-100 text-blue-700",
      partial: "bg-amber-100 text-amber-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[12px] font-semibold ${map[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  // ── FORM VIEW ──────────────────────────────────────────────────────────────
  if (showForm) {
    return (
      <div className="p-4 bg-[var(--ds-surface-muted)] min-h-screen">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">
              {editOrder ? "Modify" : "Add"} {title}
            </h1>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Order No:{" "}
              <strong>
                {prefix}
                {String(orders.length + 1).padStart(4, "0")}
              </strong>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md hover:bg-gray-50"
            >
              ← Back (Esc)
            </button>
            <button
              onClick={handleSave}
              className="h-8 px-3 bg-[var(--ds-action-primary)] text-white text-[12px] font-medium rounded-md hover:bg-[var(--ds-action-primary-hover)]"
            >
              Save (F2)
            </button>
          </div>
        </div>

        {/* Header fields */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className={labelCls}>{isSalesOrder ? "Sale Type" : "Purchase Type"}</label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className={`${inputCls} w-full`}
              >
                {(isSalesOrder ? SALE_TYPES : PURCHASE_TYPES).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>{isSalesOrder ? "Customer" : "Supplier"} *</label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className={`${inputCls} w-full`}
              >
                <option value="">— Select {isSalesOrder ? "Customer" : "Supplier"} —</option>
                {partyList.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Delivery / Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${inputCls} w-full`}
              />
            </div>
          </div>
        </div>

        {/* Item grid */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-[var(--ds-surface-muted)] flex items-center justify-between">
            <span className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">
              Item Details
            </span>
            <button
              onClick={addLine}
              className="h-7 px-2 text-[12px] bg-[var(--ds-action-primary)] text-white rounded flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add Row (F5)
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[var(--ds-surface-muted)]">
                  {["#", "Item", "Qty", "Unit", "Rate", "Amount", "Del. Date", ""].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[12px] text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-1">
                      <select
                        value={line.itemId}
                        onChange={(e) => handleLineChange(idx, "itemId", e.target.value)}
                        className={`${inputCls} w-full`}
                      >
                        <option value="">— Select Item (F4) —</option>
                        {(items || [])
                          .filter((i: any) => i.isActive !== false)
                          .map((i: any) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                        className={`${inputCls} w-20 text-right`}
                        min={0.01}
                        step={0.01}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={line.unit}
                        onChange={(e) => handleLineChange(idx, "unit", e.target.value)}
                        className={`${inputCls} w-20`}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        value={line.rate}
                        onChange={(e) => handleLineChange(idx, "rate", e.target.value)}
                        className={`${inputCls} w-28 text-right`}
                        min={0}
                        step={0.01}
                      />
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right">
                      {formatNumber(line.amount)}
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="date"
                        value={(line as any).deliveryDate || ""}
                        onChange={(e) => handleLineChange(idx, "deliveryDate", e.target.value)}
                        className={`${inputCls} w-36`}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <button
                        onClick={() => removeLine(idx)}
                        className="p-1 text-red-400 hover:bg-red-50 rounded"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Total bar */}
          <div className="px-4 py-3 border-t border-gray-200 bg-[var(--ds-action-primary)] flex justify-end">
            <div className="text-right">
              <div className="text-[12px] text-gray-500 uppercase tracking-wide">Order Total</div>
              <div className="text-[16px] font-bold text-gray-800 font-mono">
                Rs. {formatNumber(totalAmount)}
              </div>
            </div>
          </div>
        </div>

        {/* Narration */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <label className={labelCls}>Narration (F4 for standard narrations)</label>
          <textarea
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            className="w-full px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 resize-none"
            rows={2}
            placeholder={`e.g. Being ${title.toLowerCase()} raised for ${isSalesOrder ? "customer" : "supplier"}`}
          />
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="p-4 bg-[var(--ds-surface-muted)] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Manage {title.toLowerCase()}s — pick into{" "}
            {isSalesOrder ? "sales/delivery challans" : "purchase/GRNs"} via F11
          </p>
        </div>
        <button
          onClick={openAdd}
          className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add {title}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}s...`}
              className="h-8 pl-8 pr-3 text-[12px] border border-gray-300 rounded-md w-52 focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "open", "partial", "completed", "cancelled"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`h-7 px-3 rounded text-[12px] font-medium capitalize transition-colors ${statusFilter === s ? "bg-[var(--ds-action-primary)] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
              {[
                "Order No.",
                "Date",
                isSalesOrder ? "Customer" : "Supplier",
                "Items",
                "Total Amount",
                "Status",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-[12px] font-mono font-bold text-[var(--ds-action-primary)]">
                  {order.orderNo}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{order.date}</td>
                <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">
                  {order.partyName}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">
                  {order.lines.length} items
                </td>
                <td className="px-3 py-2.5 text-[12px] font-mono text-right">
                  Rs. {formatNumber(order.totalAmount)}
                </td>
                <td className="px-3 py-2.5">{statusBadge(order.status)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditOrder(order);
                        setLines(
                          order.lines.map(({ id, pendingQty, deliveredQty, ...rest }) => rest),
                        );
                        setDate(order.date);
                        setPartyId(order.partyId);
                        setNarration(order.narration);
                        setOrderType(order.orderType);
                        setShowForm(true);
                      }}
                      className="h-7 px-2 text-[12px] border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    {order.status === "open" && (
                      <button
                        onClick={() => cancelOrder(order.id)}
                        className="h-7 px-2 text-[12px] border border-red-200 text-red-600 rounded hover:bg-red-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[12px] text-gray-500">
                  No {title.toLowerCase()}s found. Click "Add {title}" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
