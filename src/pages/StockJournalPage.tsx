// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stock Journal / inventory transfer page.
 */

import { DualDate } from "../components/ui/DualDate";
import React, { useMemo, useState } from "react";
import { ActionToolbar } from "../components/ui";
import { useStore } from "../store/useStore";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  NepaliDatePicker,
  SearchableTable,
} from "../components/ui";
import ItemSelect from "../components/ui/ItemSelect";
import { Plus, Save, ArrowLeftRight, Package, ArrowRightLeft } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { ADToBSString } from "../lib/nepaliDate";
import { VoucherStatus, StockJournalLine } from "../lib/types";
import toast from "react-hot-toast";

type Mode = "list" | "new";

type StockJournalLineState = StockJournalLine & { id: string };

const StockJournalPage: React.FC = () => {
  const {
    stockJournals,
    items,
    warehouses,
    companySettings,
    currentFiscalYear,
    addStockJournal,
    postStockJournal,
  } = useStore();

  const symbol = companySettings?.currencySymbol || "Rs.";
  const defaultDate = new Date().toISOString().split("T")[0];
  const defaultWarehouseId =
    warehouses.find((w) => w.isDefault && w.isActive)?.id ||
    warehouses.find((w) => w.isActive)?.id ||
    "";
  const secondWarehouseId =
    warehouses.find((w) => w.isActive && w.id !== defaultWarehouseId)?.id || defaultWarehouseId;

  const [mode, setMode] = useState<Mode>("list");
  const [date, setDate] = useState(defaultDate);
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<StockJournalLineState[]>([
    {
      id: `line-${Date.now().toString(36).slice(2, 8)}`,
      itemId: "",
      itemName: "",
      fromWarehouseId: defaultWarehouseId,
      toWarehouseId: secondWarehouseId,
      qty: 0,
      rate: 0,
    },
  ] as StockJournalLineState[]);
  const [saving, setSaving] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);

  const journalRows = useMemo(() => {
    return stockJournals
      .map((sj) => ({
        ...sj,
        totalQty: sj.lines.reduce((sum, line) => sum + (line.qty || 0), 0),
      }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [stockJournals]);

  const warehouseOptions = warehouses
    .filter((w) => w.isActive)
    .map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }));

  const itemOptions = items
    .filter((item) => item.isActive)
    .map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }));

  const totals = useMemo(() => {
    const totalQty = lines.reduce((sum, line) => sum + (line.qty || 0), 0);
    const totalValue = lines.reduce((sum, line) => sum + (line.qty || 0) * (line.rate || 0), 0);
    return { totalQty, totalValue };
  }, [lines]);

  const createLine = (): StockJournalLineState => ({
    id: `line-${Date.now().toString(36).slice(2, 8)}`,
    itemId: "",
    itemName: "",
    fromWarehouseId: defaultWarehouseId,
    toWarehouseId: secondWarehouseId,
    qty: 0,
    rate: 0,
  });

  const updateLine = (id: string, changes: Partial<StockJournalLineState>) => {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...changes } : line)));
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((line) => line.id !== id));
  };

  const resetForm = () => {
    setDate(defaultDate);
    setNarration("");
    setLines([createLine()]);
  };

  const validate = (): string | null => {
    if (!date) return "Date is required.";
    if (
      currentFiscalYear &&
      (date < currentFiscalYear.startDate || date > currentFiscalYear.endDate)
    ) {
      return `Date must lie within fiscal year ${currentFiscalYear.name}.`;
    }
    if (!lines.length) return "Add at least one stock transfer line.";
    for (const [index, line] of lines.entries()) {
      if (!line.itemId) return `Select an item for line ${index + 1}.`;
      if (!line.fromWarehouseId) return `Select a source warehouse for line ${index + 1}.`;
      if (!line.toWarehouseId) return `Select a destination warehouse for line ${index + 1}.`;
      if (line.fromWarehouseId === line.toWarehouseId)
        return `Source and destination warehouses must differ for line ${index + 1}.`;
      if (!(line.qty > 0)) return `Enter quantity greater than zero for line ${index + 1}.`;
      if (!(line.rate > 0)) return `Enter rate greater than zero for line ${index + 1}.`;
    }
    return null;
  };

  const handleCreate = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    const bsDate = ADToBSString(date);
    if (!bsDate) {
      toast.error("Invalid Nepali date conversion.");
      return;
    }

    const payloadLines = lines
      .filter(
        (line) =>
          line.itemId &&
          line.fromWarehouseId &&
          line.toWarehouseId &&
          line.qty > 0 &&
          line.rate > 0,
      )
      .map((line) => ({
        itemId: line.itemId,
        itemName: line.itemName,
        fromWarehouseId: line.fromWarehouseId,
        toWarehouseId: line.toWarehouseId,
        qty: line.qty,
        rate: line.rate,
        fromWarehouseName: warehouses.find((w) => w.id === line.fromWarehouseId)?.name || "",
        toWarehouseName: warehouses.find((w) => w.id === line.toWarehouseId)?.name || "",
      }));

    if (!payloadLines.length) {
      toast.error("Add at least one valid transfer line.");
      return;
    }

    setSaving(true);
    try {
      const journalNo = `SJ-${Date.now().toString().slice(-6)}`;
      await addStockJournal({
        journalNo,
        date,
        dateNepali: bsDate,
        narration: narration.trim(),
        lines: payloadLines,
        status: VoucherStatus.DRAFT,
      } as any);
      toast.success("Stock transfer journal saved as draft.");
      resetForm();
      setMode("list");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save stock journal.");
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (id: string) => {
    setPostingId(id);
    try {
      await postStockJournal(id);
      toast.success("Stock journal posted and transfer movements created.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to post stock journal.");
    } finally {
      setPostingId(null);
    }
  };

  const columns = [
    {
      key: "journalNo",
      header: "Journal No",
      render: (v: string) => <span className="font-mono font-bold text-[#000000]">{v}</span>,
    },
    {
      key: "date",
      header: "Date",
      render: (_: any, row: any) => (
        <DualDate date={row.date || row.adDate} dateNepali={row.dateNepali || row.bsDate} />
      ),
    },
    {
      key: "narration",
      header: "Narration",
      render: (v: string) => <span className="line-clamp-1 max-w-[220px]">{v || "—"}</span>,
    },
    { key: "totalQty", header: "Qty", align: "right", render: (v: number) => formatNumber(v) },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (v: string) => (
        <Badge
          variant={
            v === VoucherStatus.POSTED
              ? "success"
              : v === VoucherStatus.CANCELLED
                ? "danger"
                : "default"
          }
          size="sm"
        >
          {(v || "").toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "center",
      render: (_: any, row: any) =>
        row.status === VoucherStatus.DRAFT ? (
          <Button
            size="xs"
            variant="primary"
            loading={postingId === row.id}
            onClick={(e) => {
              e.stopPropagation();
              handlePost(row.id);
            }}
          >
            Post
          </Button>
        ) : (
          <span className="text-xs text-[#000000]">—</span>
        ),
    },
  ];

  if (mode === "new") {
    return (
      <div className="flex flex-col gap-5 animate-fadeIn text-xs select-none">
        <ActionToolbar title="Stock Journal" subtitle="Stock transfer and adjustment entries" />
        <div className="flex items-center justify-between border-b border-[#9DC07A] pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setMode("list");
                resetForm();
              }}
              className="p-2 rounded-md hover:bg-[#EBF5E2] text-[#000000]"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-[#000000] tracking-tight flex items-center gap-2">
                <Package className="h-5 w-5 text-[#1557b0]" />
                STOCK JOURNAL TRANSFER
              </h2>
              <p className="text-[11px] text-[#000000] mt-0.5 tracking-wider font-bold">
                Transfer inventory between warehouses
              </p>
            </div>
          </div>
          <Badge variant="info" size="md">
            STOCK JOURNAL
          </Badge>
        </div>

        <div className="card">
          <h3 className="section-title">Stock Journal Info</h3>
          <div className="form-grid">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Date</label>
              <NepaliDatePicker value={date} onChange={setDate} required />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Narration</label>
              <Input
                value={narration}
                onChange={setNarration}
                placeholder="Purpose of stock transfer"
              />
            </div>
          </div>

          <h4 className="section-title mt-6">Transfer Lines</h4>
          <div className="space-y-3">
            {lines.map((line, index) => {
              const item = items.find((it) => it.id === line.itemId);
              return (
                <div key={line.id} className="form-row">
                  <div className="md:col-span-2">
                    <ItemSelect
                      label={`Item ${index + 1}`}
                      value={line.itemId}
                      onChange={(val) =>
                        updateLine(line.id, {
                          itemId: val,
                          itemName: items.find((it) => it.id === val)?.name || "",
                        })
                      }
                      required
                    />
                  </div>
                  <Select
                    label="From Warehouse"
                    value={line.fromWarehouseId}
                    onChange={(val) => updateLine(line.id, { fromWarehouseId: val })}
                    options={[{ value: "", label: "Select warehouse" }, ...warehouseOptions]}
                    required
                  />
                  <Select
                    label="To Warehouse"
                    value={line.toWarehouseId}
                    onChange={(val) => updateLine(line.id, { toWarehouseId: val })}
                    options={[{ value: "", label: "Select warehouse" }, ...warehouseOptions]}
                    required
                  />
                  <Input
                    label="Quantity"
                    type="number"
                    value={line.qty || ""}
                    onChange={(val) => updateLine(line.id, { qty: Number(val) || 0 })}
                    placeholder="0"
                    required
                  />
                  <Input
                    label="Rate"
                    type="number"
                    value={line.rate || ""}
                    onChange={(val) => updateLine(line.id, { rate: Number(val) || 0 })}
                    prefix={symbol}
                    placeholder="0.00"
                    required
                  />
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-[#000000]">Line Value</div>
                    <div className="text-right text-[#000000] font-mono">
                      {symbol} {formatNumber((line.qty || 0) * (line.rate || 0))}
                    </div>
                    <Button size="xs" variant="danger" onClick={() => removeLine(line.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                size="sm"
                variant="outline"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setLines((prev) => [...prev, createLine()])}
              >
                Add Line
              </Button>
              <div className="text-right text-[11px] text-[#000000]">
                Total Qty:{" "}
                <span className="font-semibold text-[#000000]">
                  {formatNumber(totals.totalQty)}
                </span>
                <br />
                Total Value:{" "}
                <span className="font-semibold text-[#000000]">
                  {symbol} {formatNumber(totals.totalValue)}
                </span>
              </div>
            </div>
          </div>
          <div className="actions pt-4 border-t border-gray-100 mt-4">
            <button
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md"
              onClick={handleCreate}
              disabled={saving}
            >
              Save Stock Journal
            </button>
            <button
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
              onClick={() => {
                setMode("list");
                resetForm();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-fadeIn text-xs select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#9DC07A] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#000000] tracking-tight flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-[#000000]" />
            STOCK JOURNAL TRANSFERS
          </h2>
          <p className="text-xs text-[#000000] mt-1 leading-none tracking-wider font-semibold">
            Draft and post warehouse transfer journals
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setMode("new")}
        >
          New Stock Journal
        </Button>
      </div>

      <div className="table-card">
        <SearchableTable
          columns={columns as any}
          data={journalRows}
          rowKey="id"
          searchFields={["journalNo", "narration"]}
          emptyMessage="No stock journals available. Create a new stock transfer."
          placeholder="Search journal no or narration…"
        />
      </div>
    </div>
  );
};

export default StockJournalPage;
