import React, { useMemo, useState } from "react";
import toast from "@/lib/appToast";
import { useStore } from "../store/useStore";
import { DBWarehouse, getDB } from "../lib/db";
import { computeStockPosition } from "../lib/godownStockUtils";
import { Save, Plus, Trash2 } from "lucide-react";
import { stampMovementBranch } from "../lib/activeBranch";
import { useBranchFilter } from "../hooks/useBranchFilter";

export default function StockAdjustment() {
  const { warehouses, items, stockMovements, currentUser } = useStore() as any;
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [warehouseId, setWarehouseId] = useState("");
  const [reason, setReason] = useState("");

  const [lines, setLines] = useState([
    {
      id: crypto.randomUUID(),
      itemId: "",
      systemQty: 0,
      adjustedQty: 0,
      rate: 0,
    },
  ]);

  const scopedWarehouses = useMemo(
    () =>
      (warehouses || []).filter((w: DBWarehouse & { branchId?: string }) =>
        matchBranch(w.branchId),
      ),
    [warehouses, matchBranch, branchFilter],
  );

  const warehouse = scopedWarehouses.find((w: DBWarehouse) => w.id === warehouseId);

  const getSystemQty = (itemId: string, wid: string) => {
    const movements = (stockMovements || []).filter(
      (m: any) => m.itemId === itemId && m.warehouseId === wid && m.date <= date,
    );
    return computeStockPosition(movements, "weighted-average").qty;
  };

  const getWeightedRate = (itemId: string, wid: string) => {
    const movements = (stockMovements || []).filter(
      (m: any) => m.itemId === itemId && m.warehouseId === wid && m.date <= date,
    );
    return computeStockPosition(movements, "weighted-average").avgRate;
  };

  const updateLine = (id: string, updates: any) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...updates };

        if (updates.itemId) {
          next.systemQty = warehouseId ? getSystemQty(updates.itemId, warehouseId) : 0;
          next.adjustedQty = next.systemQty;
          next.rate = warehouseId ? getWeightedRate(updates.itemId, warehouseId) : 0;
        }

        return next;
      }),
    );
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), itemId: "", systemQty: 0, adjustedQty: 0, rate: 0 },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length === 1) {
      toast.error("At least one item is required.");
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSave = async () => {
    if (!warehouse) {
      toast.error("Please select a warehouse");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please provide a reason for adjustment");
      return;
    }

    const validLines = lines.filter((l) => l.itemId);
    if (validLines.length === 0) {
      toast.error("Please select at least one item");
      return;
    }

    const db = getDB();
    const adjustmentId = crypto.randomUUID();
    const ts = new Date().toISOString();

    const movements = validLines
      .map((line) => {
        const difference = Number(line.adjustedQty) - Number(line.systemQty);
        if (difference === 0) return null;

        const item = items?.find((i: any) => i.id === line.itemId);

        return stampMovementBranch(
          {
            id: crypto.randomUUID(),
            date,
            dateNepali: "", // Assuming standard handling elsewhere
            itemId: line.itemId,
            itemName: item?.name || "",
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            type: difference > 0 ? "in" : "out",
            qty: Math.abs(difference),
            rate: line.rate,
            value: Math.abs(difference) * line.rate,
            referenceType: "adjustment",
            referenceId: adjustmentId,
            voucherNo: "ADJ-" + Date.now().toString().slice(-6),
            narration: reason,
            createdAt: ts,
          },
          warehouses || [],
        );
      })
      .filter(Boolean);

    if (movements.length === 0) {
      toast.success("No adjustments needed (quantities match).");
      return;
    }

    try {
      await db.transaction("rw", db.stockMovements, async () => {
        for (const m of movements) {
          if (m) await db.stockMovements.add(m as any);
        }
      });
      toast.success("Stock adjustment saved successfully");

      // Reset form
      setReason("");
      setLines([{ id: crypto.randomUUID(), itemId: "", systemQty: 0, adjustedQty: 0, rate: 0 }]);

      // Trigger store refresh for stockMovements
      const allMovements = await db.stockMovements.toArray();
      useStore.setState({ stockMovements: allMovements });
    } catch (e) {
      console.error(e);
      toast.error("Failed to save adjustment");
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Stock Adjustment</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Adjust physical stock quantities</p>
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
          <button onClick={handleSave} className="btn-primary">
            <Save size={14} /> Save Adjustment
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-4 mb-4 grid grid-cols-3 gap-4">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            Warehouse / Godown
          </label>
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              // reset lines qty when warehouse changes
              setLines(lines.map((l) => ({ ...l, systemQty: 0, adjustedQty: 0 })));
            }}
            className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
          >
            <option value="">-- Select Godown --</option>
            {scopedWarehouses.map((w: DBWarehouse) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">
            Reason / Narration
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Damage, Physical Verification"
            className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-12">
                #
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Item
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                System Qty
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                Adjusted Qty
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                Difference
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-16">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const diff = Number(line.adjustedQty) - Number(line.systemQty);
              return (
                <tr key={line.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 text-[12px] text-gray-500">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <select
                      value={line.itemId}
                      onChange={(e) => updateLine(line.id, { itemId: e.target.value })}
                      className="w-full h-7 px-2 text-[12px] border border-gray-300 rounded focus:outline-none focus:border-[var(--ds-action-primary)]"
                    >
                      <option value="">-- Select Item --</option>
                      {items?.map((i: any) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-[12px] text-right font-mono bg-gray-50">
                    {line.systemQty.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={line.adjustedQty}
                      onChange={(e) => updateLine(line.id, { adjustedQty: e.target.value })}
                      className="w-full h-7 px-2 text-[12px] text-right font-mono border border-gray-300 rounded focus:outline-none focus:border-[var(--ds-action-primary)]"
                    />
                  </td>
                  <td
                    className={`px-3 py-2 text-[12px] text-right font-mono ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-500"}`}
                  >
                    {diff > 0 ? "+" : ""}
                    {diff.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => removeLine(line.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="p-2 bg-gray-50 border-t border-gray-200">
          <button
            onClick={addLine}
            className="flex items-center gap-1 text-[12px] text-[var(--ds-action-primary)] hover:underline px-2 py-1"
          >
            <Plus size={14} /> Add Row
          </button>
        </div>
      </div>
    </div>
  );
}
