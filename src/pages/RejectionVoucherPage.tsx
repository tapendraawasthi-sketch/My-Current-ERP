import React, { useState } from "react";
import { useStore } from "../store";
import { StockJournalItem } from "../lib/types";
import SearchableTable from "../components/ui/SearchableTable";
import ItemSelect from "../components/ui/ItemSelect";
import toast from "@/lib/appToast";

const emptyItem = (): StockJournalItem => ({
  id: crypto.randomUUID(),
  itemId: "",
  itemName: "",
  qty: 0,
  rate: 0,
  amount: 0,
});

interface RejectionVoucherPageProps {
  mode: "out" | "in";
}

export default function RejectionVoucherPage({ mode }: RejectionVoucherPageProps) {
  const voucherType = mode === "out" ? "rejection-out" : "rejection-in";
  const title = "Rejection in/out";
  const help =
    mode === "out" ? "Rejected goods sent back to supplier." : "Rejected goods returned by customer.";
  const { vouchers, addVoucher, postRejectionStock, items } = useStore() as any;

  const entries = (vouchers || []).filter((v: any) => v.type === voucherType);
  const [showForm, setShowForm] = useState(false);
  const [entry, setEntry] = useState({
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    partyName: "",
    narration: "",
    refNo: "",
    items: [emptyItem()],
  });

  const addRow = () => setEntry((e) => ({ ...e, items: [...e.items, emptyItem()] }));

  const updateItem = (idx: number, field: keyof StockJournalItem, value: string | number) => {
    const items = [...entry.items];
    const item = { ...items[idx], [field]: value };
    item.amount = Number(item.qty) * Number(item.rate);
    items[idx] = item;
    setEntry((e) => ({ ...e, items }));
  };

  const selectItem = (idx: number, itemId: string) => {
    const master = (items || []).find((i: any) => i.id === itemId);
    setEntry((e) => {
      const rows = [...e.items];
      const row = { ...rows[idx], itemId, itemName: master?.name || "" };
      row.rate = Number(master?.purchaseRate ?? master?.rate ?? row.rate ?? 0);
      row.amount = Number(row.qty) * Number(row.rate);
      rows[idx] = row;
      return { ...e, items: rows };
    });
  };

  const handleSave = async () => {
    const validItems = entry.items.filter((i) => i.itemId && Number(i.qty) > 0);
    if (validItems.length === 0) {
      toast.error("Add at least one item with quantity");
      return;
    }
    try {
      const grandTotal = validItems.reduce((s, i) => s + Number(i.amount || 0), 0);
      const voucher = await addVoucher({
        id: entry.id,
        voucherNo:
          entry.refNo ||
          `${mode === "out" ? "RJ-OUT" : "RJ-IN"}-${Date.now().toString().slice(-6)}`,
        date: entry.date,
        type: voucherType,
        status: "posted",
        narration: entry.narration,
        partyName: entry.partyName,
        referenceNo: entry.refNo,
        totalDebit: grandTotal,
        totalCredit: grandTotal,
        grandTotal,
        lines: [],
        itemLines: validItems,
      });
      await postRejectionStock(voucher?.id || entry.id);
      toast.success(`${title} posted`);
      setShowForm(false);
      setEntry({
        id: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        partyName: "",
        narration: "",
        refNo: "",
        items: [emptyItem()],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post rejection");
    }
  };

  return (
    <div className="page p-4 bg-[var(--ds-canvas)] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">{help}</p>
        </div>
        <button
          className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md"
          onClick={() => setShowForm(true)}
        >
          New Entry
        </button>
      </div>

      {!showForm && (
        <div className="table-card bg-white border border-gray-200 rounded-lg">
          <SearchableTable
            data={entries}
            searchFields={["date", "partyName", "voucherNo", "status"]}
            rowKey="id"
            columns={[
              { key: "date", header: "Date" },
              { key: "voucherNo", header: "Ref No" },
              { key: "partyName", header: "Party" },
              {
                key: "grandTotal",
                header: "Amount",
                render: (v: number) => Number(v || 0).toFixed(2),
              },
              { key: "status", header: "Status" },
            ]}
          />
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-[13px] font-semibold text-gray-800 mb-3">New {title}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="text-[12px] font-medium text-gray-600 mb-1 block">Date</label>
              <input
                type="date"
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md"
                value={entry.date}
                onChange={(e) => setEntry({ ...entry, date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-gray-600 mb-1 block">Party</label>
              <input
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md"
                value={entry.partyName}
                onChange={(e) => setEntry({ ...entry, partyName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-gray-600 mb-1 block">Ref No</label>
              <input
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md"
                value={entry.refNo}
                onChange={(e) => setEntry({ ...entry, refNo: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="text-[12px] font-medium text-gray-600 mb-1 block">Narration</label>
              <input
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md"
                value={entry.narration}
                onChange={(e) => setEntry({ ...entry, narration: e.target.value })}
              />
            </div>
          </div>
          <table className="w-full mb-4">
            <thead>
              <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
                {["Item", "Qty", "Rate", "Amount", ""].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[12px] font-semibold text-gray-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entry.items.map((item, idx) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="px-2 py-1 min-w-[200px]">
                    <ItemSelect
                      value={item.itemId}
                      onChange={(itemId) => selectItem(idx, itemId)}
                      placeholder="Select item"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      className="w-24 h-8 px-2 text-[12px] border border-gray-300 rounded-md text-right"
                      value={item.qty}
                      onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      className="w-24 h-8 px-2 text-[12px] border border-gray-300 rounded-md text-right"
                      value={item.rate}
                      onChange={(e) => updateItem(idx, "rate", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-2 py-1 text-[12px] font-mono text-right">
                    {Number(item.amount || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-1">
                    <button
                      className="text-[12px] text-red-600"
                      onClick={() =>
                        setEntry((e) => ({ ...e, items: e.items.filter((_, i) => i !== idx) }))
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2">
            <button
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md"
              onClick={addRow}
            >
              Add Row
            </button>
            <button
              className="h-8 px-3 bg-[var(--ds-action-primary)] text-white text-[12px] rounded-md"
              onClick={handleSave}
            >
              Save & Post
            </button>
            <button
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
