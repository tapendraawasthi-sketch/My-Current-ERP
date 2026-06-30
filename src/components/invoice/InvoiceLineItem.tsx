/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Single row of the Sales/Purchase Invoice line-items table.
 * Computes taxable / VAT / total per-line and exposes Tab/Enter
 * navigation between cells.
 */

import React, { useCallback, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { Trash2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface InvoiceLineState {
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
  discountAmount?: number;
  taxableAmount?: number;
  vatAmount?: number;
  totalAmount?: number;
  warehouseId?: string;
}

interface InvoiceLineItemProps {
  line: InvoiceLineState;
  lineNo: number;
  onUpdate: (updates: Partial<InvoiceLineState>) => void;
  onDelete: () => void;
  onTabNext?: () => void;
  showWarehouse?: boolean;
  type: "sales" | "purchase";
  readOnly?: boolean;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const cellInput =
  "w-full h-8 px-2 text-xs font-mono bg-transparent border border-transparent focus:border-indigo-400 focus:bg-white rounded-sm outline-none";

const InvoiceLineItem: React.FC<InvoiceLineItemProps> = React.memo(
  ({ line, lineNo, onUpdate, onDelete, onTabNext, showWarehouse, type, readOnly }) => {
    const { items, warehouses } = useStore();
    const itemList = useMemo(() => items.filter((i) => i.isActive), [items]);

    const taxable = useMemo(
      () =>
        round2(
          (Number(line.qty) || 0) *
            (Number(line.rate) || 0) *
            (1 - (Number(line.discountPercent) || 0) / 100),
        ),
      [line.qty, line.rate, line.discountPercent],
    );
    const vatAmt = useMemo(
      () => (line.isTaxable ? round2(taxable * ((Number(line.vatRate) || 0) / 100)) : 0),
      [taxable, line.isTaxable, line.vatRate],
    );
    const total = round2(taxable + vatAmt);

    const handleItem = useCallback(
      (id: string) => {
        const it = items.find((x) => x.id === id);
        if (!it) {
          onUpdate({ itemId: "", itemName: "", itemCode: "", unit: "", hsnCode: "" });
          return;
        }
        const itemRate = type === "sales" ? Number(it.salesRate || 0) : Number(it.purchaseRate || 0);
        if (itemRate === 0) {
          // We still add the item but notify user
          setTimeout(() => {
            const event = new CustomEvent("sutra-warn", { 
              detail: `Item "${it.name}" has no ${type === "sales" ? "selling" : "purchase"} price configured.` 
            });
            window.dispatchEvent(event);
          }, 0);
        }
        onUpdate({
          itemId: it.id,
          itemName: it.name,
          itemCode: it.code,
          unit: it.unit || "",
          hsnCode: it.hsnCode || "",
          rate: itemRate,
          isTaxable: !!it.isTaxable,
          vatRate: it.vatRate ?? (it.isTaxable ? 13 : 0),
        });
      },
      [items, onUpdate, type],
    );

    const onKey = (e: React.KeyboardEvent) => {
      // Only trigger next-row on Tab, not Enter (Enter is for dropdown selection)
      if (e.key === "Tab" && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT") {
          onTabNext?.();
        }
      }
    };

    const symbolCell = (n: number, color = "text-[#000000]") => (
      <span className={`font-mono text-xs font-semibold ${color}`}>{formatNumber(n)}</span>
    );

    return (
      <tr className="border-b border-[#9DC07A] hover:bg-[#EBF5E2]/50" onKeyDown={onKey}>
        <td className="px-2 py-1 text-center text-[11px] font-bold text-[#000000] w-8">{lineNo}</td>

        {/* Item */}
        <td className="px-1 py-1 min-w-[200px]">
          <select
            className={cellInput}
            value={line.itemId}
            onChange={(e) => handleItem(e.target.value)}
            disabled={readOnly}
          >
            <option value="">— select item —</option>
            {itemList.map((it) => {
              const rate = type === "sales" ? it.salesRate : it.purchaseRate;
              return (
                <option key={it.id} value={it.id}>
                  {it.name} {it.unit ? `(${it.unit})` : ""} - Rs. {rate || 0}
                </option>
              );
            })}
          </select>
        </td>

        {/* HSN/SAC */}
        <td className="px-1 py-1 w-20 hidden">
          <input
            className={cellInput}
            value={line.hsnCode || ""}
            onChange={(e) => onUpdate({ hsnCode: e.target.value })}
            disabled={readOnly}
            placeholder="—"
          />
        </td>

        {/* Description */}
        <td className="px-1 py-1 min-w-[140px] hidden">
          <input
            className={cellInput}
            value={line.description || ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
            disabled={readOnly}
            placeholder="—"
          />
        </td>

        {/* Qty */}
        <td className="px-1 py-1 w-20">
          <input
            type="number"
            className="w-full h-7 px-2 text-[12px] border-0 border-b border-[#9DC07A] bg-transparent text-right focus:outline-none focus:border-[#1557b0]"
            value={line.qty || ""}
            onChange={(e) => onUpdate({ qty: Math.max(0, Number(e.target.value) || 0) })}
            disabled={readOnly}
            placeholder="0"
            min={0}
          />
        </td>

        {/* Unit */}
        <td className="px-1 py-1 w-16">
          <input
            className={cellInput}
            value={line.unit || ""}
            onChange={(e) => onUpdate({ unit: e.target.value })}
            disabled={readOnly}
            placeholder="pcs"
          />
        </td>

        {/* Rate */}
        <td className="px-1 py-1 w-24">
          <input
            type="number"
            className="w-full h-7 px-2 text-[12px] border-0 border-b border-[#9DC07A] bg-transparent text-right focus:outline-none focus:border-[#1557b0]"
            value={line.rate || ""}
            onChange={(e) => onUpdate({ rate: Math.max(0, Number(e.target.value) || 0) })}
            disabled={readOnly}
            placeholder="0.00"
            min={0}
            step="0.01"
          />
        </td>

        {/* Discount % */}
        <td className="px-1 py-1 w-20">
          <input
            type="number"
            className={cellInput}
            value={line.discountPercent || ""}
            onChange={(e) =>
              onUpdate({ discountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
            }
            disabled={readOnly}
            placeholder="0"
            min={0}
            max={100}
            step="0.01"
          />
        </td>

        {/* Taxable amount (computed) */}
        <td className="px-2 py-1 text-right w-24">{symbolCell(taxable)}</td>

        {/* Is Taxable */}
        <td className="px-1 py-1 text-center w-14">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-indigo-600"
            checked={!!line.isTaxable}
            onChange={(e) => onUpdate({ 
              isTaxable: e.target.checked,
              vatRate: e.target.checked ? (line.vatRate || 13) : 0
            })}
            disabled={readOnly}
          />
        </td>

        {/* VAT % */}
        <td className="px-1 py-1 w-16">
          <input
            type="number"
            className={cellInput}
            value={line.vatRate || ""}
            onChange={(e) => onUpdate({ vatRate: Number(e.target.value) || 0 })}
            disabled={readOnly || !line.isTaxable}
            placeholder="13"
            min={0}
            max={100}
            step="0.01"
          />
        </td>

        {/* VAT Amount */}
        <td className="px-2 py-1 text-right w-24">{symbolCell(vatAmt, "text-[#000000]")}</td>

        {/* Total */}
        <td className="text-right text-[12px] font-medium text-[#000000] font-mono px-3 w-24 bg-[#EBF5E2]/80">
          {formatNumber(total)}
        </td>

        {/* Warehouse */}
        {showWarehouse && (
          <td className="px-1 py-1 w-32">
            <select
              className={cellInput}
              value={line.warehouseId || ""}
              onChange={(e) => onUpdate({ warehouseId: e.target.value })}
              disabled={readOnly}
            >
              <option value="">—</option>
              {warehouses
                .filter((w) => w.isActive)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </td>
        )}

        {/* Delete */}
        <td className="px-1 py-1 w-10 text-center">
          <button
            type="button"
            onClick={onDelete}
            disabled={readOnly}
            className="p-1 text-[#000000] hover:text-red-500 rounded transition-colors disabled:opacity-40"
            title="Remove line"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
    );
  },
);

export default InvoiceLineItem;
