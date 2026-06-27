import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useStore } from "../store/useStore";
import type { DBWarehouse, DBStockTransferLine } from "../lib/db";
import { computeStockPosition } from "../lib/godownStockUtils";

function money(value: number) {
  return Number(value || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const StockTransfer: React.FC = () => {
  const {
    warehouses,
    items,
    stockMovements,
    saveStockTransfer,
    getNextTransferNo,
    currentUser,
  } = useStore() as any;

  const [transferNo, setTransferNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dateNepali, setDateNepali] = useState("");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState(currentUser?.name || "");
  const [narration, setNarration] = useState("");

  const [lines, setLines] = useState<DBStockTransferLine[]>([
    {
      id: crypto.randomUUID(),
      itemId: "",
      itemName: "",
      fromBatch: "",
      qty: 1,
      rate: 0,
      amount: 0,
    },
  ]);

  React.useEffect(() => {
    getNextTransferNo?.().then(setTransferNo);
  }, [getNextTransferNo]);

  const fromWarehouse = warehouses?.find((w: DBWarehouse) => w.id === fromWarehouseId);
  const toWarehouse = warehouses?.find((w: DBWarehouse) => w.id === toWarehouseId);

  const isInterBranch =
    fromWarehouse &&
    toWarehouse &&
    fromWarehouse.branchId &&
    toWarehouse.branchId &&
    fromWarehouse.branchId !== toWarehouse.branchId;

  const getWeightedRate = (itemId: string, warehouseId: string) => {
    const movements = (stockMovements || []).filter(
      (m: any) => m.itemId === itemId && m.warehouseId === warehouseId && m.date <= date,
    );

    return computeStockPosition(movements, "weighted-average").avgRate;
  };

  const getAvailableQty = (itemId: string, warehouseId: string) => {
    const movements = (stockMovements || []).filter(
      (m: any) => m.itemId === itemId && m.warehouseId === warehouseId && m.date <= date,
    );

    return computeStockPosition(movements, "weighted-average").qty;
  };

  const updateLine = (id: string, updates: Partial<DBStockTransferLine>) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;

        const next = { ...line, ...updates };

        if (updates.itemId) {
          const item = items.find((i: any) => i.id === updates.itemId);
          next.itemName = item?.name || "";
          next.itemCode = item?.code || "";
          next.rate = fromWarehouseId ? getWeightedRate(updates.itemId, fromWarehouseId) : 0;
        }

        if (updates.qty !== undefined || updates.rate !== undefined || updates.itemId) {
          next.amount = Number(next.qty || 0) * Number(next.rate || 0);
        }

        return next;
      }),
    );
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        itemId: "",
        itemName: "",
        fromBatch: "",
        qty: 1,
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length === 1) {
      toast.error("At least one item is required.");
      return;
    }

    setLines((prev) => prev.filter((line) => line.id !== id));
  };

  const totalQty = useMemo(
    () => lines.reduce((s, l) => s + Number(l.qty || 0), 0),
    [lines],
  );

  const totalAmount = useMemo(
    () => lines.reduce((s, l) => s + Number(l.amount || 0), 0),
    [lines],
  );

  const save = async () => {
    if (!fromWarehouse || !toWarehouse) {
      toast.error("Select source and destination godown.");
      return;
    }

    if (fromWarehouse.id === toWarehouse.id) {
      toast.error("Source and destination godown cannot be same.");
      return;
    }

    for (const line of lines) {
      if (!line.itemId || line.qty <= 0) {
        toast.error("Each transfer line must have valid item and quantity.");
        return;
      }

      const available = getAvailableQty(line.itemId, fromWarehouse.id);

      if (!fromWarehouse.allowNegativeStock && line.qty > available) {
        toast.error(
          `${line.itemName}: insufficient stock. Available ${available}, requested ${line.qty}.`,
        );
        return;
      }
    }

    const voucher = await saveStockTransfer({
      date,
      dateNepali,
      fromWarehouseId: fromWarehouse.id,
      fromWarehouseName: fromWarehouse.name,
      fromBranchId: fromWarehouse.branchId,
      fromBranchName: fromWarehouse.branchName,
      toWarehouseId: toWarehouse.id,
      toWarehouseName: toWarehouse.name,
      toBranchId: toWarehouse.branchId,
      toBranchName: toWarehouse.branchName,
      isInterBranch: !!isInterBranch,
      lines,
      totalQty,
      totalAmount,
      narration,
      authorizedBy,
    });

    setTransferNo(voucher.transferNo);
    toast.success(`Transfer ${voucher.transferNo} posted.`);
  };

  const print = () => window.print();

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-[15px] font-semibold">Stock Transfer Voucher</h1>
          <p className="text-[11px] text-gray-500">Inter-godown / inter-branch material transfer</p>
        </div>

        <div className="flex gap-2">
          <button onClick={print} className="h-8 px-3 border rounded-md text-[12px]">
            Print
          </button>
          <button onClick={save} className="h-8 px-3 bg-[#1557b0] text-white rounded-md text-[12px]">
            Save Transfer
          </button>
        </div>
      </div>

      <div className="print-only hidden text-center mb-4">
        <h1 className="text-[16px] font-bold">Material Transfer Note</h1>
        <div className="text-[12px]">Transfer No.: {transferNo}</div>
      </div>

      <div className="bg-white border rounded-md p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <Field label="Transfer No." value={transferNo} readOnly />
        <Field label="AD Date" value={date} onChange={setDate} type="date" />
        <Field label="BS Date" value={dateNepali} onChange={setDateNepali} placeholder="2081-04-15" />
        <Field label="Authorized By" value={authorizedBy} onChange={setAuthorizedBy} />

        <SelectWarehouse
          label="From Godown"
          value={fromWarehouseId}
          onChange={setFromWarehouseId}
          warehouses={warehouses || []}
        />

        <SelectWarehouse
          label="To Godown"
          value={toWarehouseId}
          onChange={setToWarehouseId}
          warehouses={warehouses || []}
        />

        <div className="md:col-span-2">
          <label className="text-[11px] font-medium text-gray-600">Narration</label>
          <input
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            className="mt-1 h-8 px-2.5 text-[12px] border rounded-md w-full"
          />
        </div>

        {isInterBranch && (
          <div className="md:col-span-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-md p-2 text-[12px]">
            Inter-branch transfer detected. Accounting entries will be created for Branch Transfer Receivable / Payable.
          </div>
        )}
      </div>

      <div className="bg-white border rounded-md overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-[#f5f6fa]">
            <tr>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-left">From Batch</th>
              <th className="px-3 py-2 text-right">Available</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 no-print"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const available =
                line.itemId && fromWarehouseId
                  ? getAvailableQty(line.itemId, fromWarehouseId)
                  : 0;

              return (
                <tr key={line.id} className="border-t">
                  <td className="px-3 py-2">
                    <select
                      value={line.itemId}
                      onChange={(e) => updateLine(line.id, { itemId: e.target.value })}
                      className="h-8 px-2 border rounded-md w-full"
                    >
                      <option value="">Select Item</option>
                      {(items || []).map((i: any) => (
                        <option key={i.id} value={i.id}>
                          {i.code ? `${i.code} - ` : ""}
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-3 py-2">
                    <input
                      value={line.fromBatch || ""}
                      onChange={(e) => updateLine(line.id, { fromBatch: e.target.value })}
                      className="h-8 px-2 border rounded-md w-full"
                    />
                  </td>

                  <td className="px-3 py-2 text-right font-mono">
                    {available}
                  </td>

                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={line.qty}
                      onChange={(e) => updateLine(line.id, { qty: Number(e.target.value || 0) })}
                      className="h-8 px-2 border rounded-md w-full text-right"
                    />
                  </td>

                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={line.rate}
                      onChange={(e) => updateLine(line.id, { rate: Number(e.target.value || 0) })}
                      className="h-8 px-2 border rounded-md w-full text-right"
                    />
                  </td>

                  <td className="px-3 py-2 text-right font-mono">
                    {money(line.amount)}
                  </td>

                  <td className="px-3 py-2 text-center no-print">
                    <button onClick={() => removeLine(line.id)} className="text-red-600">
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="bg-[#eef2ff] font-bold">
              <td colSpan={3} className="px-3 py-2 text-right">Total</td>
              <td className="px-3 py-2 text-right font-mono">{totalQty}</td>
              <td />
              <td className="px-3 py-2 text-right font-mono">{money(totalAmount)}</td>
              <td className="no-print" />
            </tr>
          </tfoot>
        </table>

        <div className="p-3 no-print">
          <button onClick={addLine} className="h-8 px-3 border rounded-md text-[12px]">
            Add Item
          </button>
        </div>
      </div>

      <div className="print-only hidden mt-16 grid grid-cols-3 gap-10 text-center text-[12px]">
        <div className="border-t border-black pt-2">Prepared By</div>
        <div className="border-t border-black pt-2">Authorized By</div>
        <div className="border-t border-black pt-2">Received By</div>
      </div>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  readOnly,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  type?: string;
  placeholder?: string;
}) => (
  <div>
    <label className="text-[11px] font-medium text-gray-600">{label}</label>
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className="mt-1 h-8 px-2.5 text-[12px] border rounded-md w-full"
    />
  </div>
);

const SelectWarehouse = ({
  label,
  value,
  onChange,
  warehouses,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  warehouses: DBWarehouse[];
}) => (
  <div>
    <label className="text-[11px] font-medium text-gray-600">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 h-8 px-2.5 text-[12px] border rounded-md w-full"
    >
      <option value="">Select Godown</option>
      {warehouses
        .filter((w) => w.isActive)
        .map((w) => (
          <option key={w.id} value={w.id}>
            {w.branchName ? `[${w.branchName}] ` : ""}
            {w.code} - {w.name}
          </option>
        ))}
    </select>
  </div>
);

export default StockTransfer;
