import React, { useState } from "react";
import { useStore } from "../store";
import { MaterialReceivedEntry, StockJournalItem } from "../lib/types";
import SearchableTable from "../components/ui/SearchableTable";

const emptyItem = (): StockJournalItem => ({
  id: crypto.randomUUID(),
  itemId: "",
  itemName: "",
  qty: 0,
  rate: 0,
  amount: 0,
});

export default function MaterialReceivedPage() {
  const { materialReceived, addMaterialReceived } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [entry, setEntry] = useState<MaterialReceivedEntry>({
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    partyName: "",
    narration: "",
    refNo: "",
    items: [emptyItem()],
    status: "DRAFT",
    createdAt: new Date().toISOString(),
  });

  const addRow = () => setEntry((e) => ({ ...e, items: [...e.items, emptyItem()] }));

  const updateItem = (idx: number, field: keyof StockJournalItem, value: string | number) => {
    const items = [...entry.items];
    const item = { ...items[idx], [field]: value };
    item.amount = Number(item.qty) * Number(item.rate);
    items[idx] = item;
    setEntry((e) => ({ ...e, items }));
  };

  const handleSave = () => {
    addMaterialReceived({ ...entry, status: "POSTED" });
    setShowForm(false);
    setEntry({
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      partyName: "",
      narration: "",
      refNo: "",
      items: [emptyItem()],
      status: "DRAFT",
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-800">Material received</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">Materials brought in.</p>
        </div>
        <button
          className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md"
          onClick={() => setShowForm(true)}
        >
          New Entry
        </button>
      </div>

      {!showForm && (
        <div className="table-card">
          <SearchableTable
            data={materialReceived || []}
            searchFields={["date", "partyName", "refNo", "status"]}
            rowKey="id"
            columns={[
              { key: "date", header: "Date" },
              { key: "partyName", header: "Party" },
              { key: "refNo", header: "Ref No" },
              {
                key: "status",
                header: "Status",
                render: (val: string) => (
                  <span className={`badge ${val ? val.toLowerCase() : ""}`}>{val}</span>
                ),
              },
            ]}
          />
        </div>
      )}

      {showForm && (
        <div className="card">
          <h3 className="section-title">Material Received</h3>
          <div className="form-grid">
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Date</label>
              <input
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                type="date"
                value={entry.date}
                onChange={(e) => setEntry({ ...entry, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Party Name</label>
              <input
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                placeholder="Party Name"
                value={entry.partyName}
                onChange={(e) => setEntry({ ...entry, partyName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Ref No</label>
              <input
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                placeholder="Ref No"
                value={entry.refNo}
                onChange={(e) => setEntry({ ...entry, refNo: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Narration</label>
              <input
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                placeholder="Narration"
                value={entry.narration}
                onChange={(e) => setEntry({ ...entry, narration: e.target.value })}
              />
            </div>
          </div>

          <h4 className="section-title mt-4">Items</h4>
          {entry.items.map((row, i) => (
            <div key={row.id} className="form-row">
              <input
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                placeholder="Item"
                value={row.itemName}
                onChange={(e) => updateItem(i, "itemName", e.target.value)}
              />
              <input
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                type="number"
                placeholder="Qty"
                value={row.qty || ""}
                onChange={(e) => updateItem(i, "qty", Number(e.target.value))}
              />
              <input
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                type="number"
                placeholder="Rate"
                value={row.rate || ""}
                onChange={(e) => updateItem(i, "rate", Number(e.target.value))}
              />
              <input
                className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-[var(--ds-canvas)] cursor-not-allowed"
                type="number"
                placeholder="Amount"
                readOnly
                value={row.amount || ""}
              />
            </div>
          ))}
          <button
            className="mt-2 h-7 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
            onClick={addRow}
          >
            + Add Row
          </button>

          <div className="actions pt-4 border-t border-gray-100 mt-4">
            <button
              className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md"
              onClick={handleSave}
            >
              Save Entry
            </button>
            <button
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
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
