// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stock journal / inventory transfer page.
 */

import { DualDate } from "../components/ui/DualDate";
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import {
  Badge,
  Button,
  Input,
  Select,
  NepaliDatePicker,
  SearchableTable,
} from "../components/ui";
import ItemSelect from "../components/ui/ItemSelect";
import { Plus } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { ADToBSString } from "../lib/nepaliDate";
import { VoucherStatus, StockJournalLine } from "../lib/types";
import toast from "@/lib/appToast";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

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
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  const symbol = companySettings?.currencySymbol || "Rs.";
  const defaultDate = new Date().toISOString().split("T")[0];
  const scopedWarehouses = warehouses.filter(
    (w) => w.isActive && matchBranch((w as { branchId?: string }).branchId),
  );
  const defaultWarehouseId =
    scopedWarehouses.find((w) => w.isDefault)?.id || scopedWarehouses[0]?.id || "";
  const secondWarehouseId =
    scopedWarehouses.find((w) => w.id !== defaultWarehouseId)?.id || defaultWarehouseId;

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
      .filter((sj) => matchBranch((sj as { branchId?: string }).branchId))
      .map((sj) => ({
        ...sj,
        totalQty: sj.lines.reduce((sum, line) => sum + (line.qty || 0), 0),
      }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [stockJournals, matchBranch, branchFilter]);

  const warehouseOptions = scopedWarehouses.map((w) => ({
    value: w.id,
    label: `${w.code} — ${w.name}`,
  }));

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
        branchId: readActiveBranchId() || undefined,
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
      render: (v: string) => <span className="font-mono font-bold text-[var(--ox-text)]">{v}</span>,
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
          <span className="text-xs text-[var(--ox-text)]">—</span>
        ),
    },
  ];

  if (mode === "new") {
    return (
      <div className="min-h-screen bg-[var(--ox-bg,var(--ds-canvas))] p-4 text-[12px] text-[var(--ox-text)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Stock journal</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">Adjust stock with accounting.</p>
            <p className="mt-0.5 text-[12px] text-gray-500">
              Transfer inventory between warehouses
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("list");
                resetForm();
              }}
              className="h-8 rounded-md border border-gray-300 bg-white px-3 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
            >
              Back to list
            </button>
          </div>
        </div>

        <div className="rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface)] p-4">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-gray-500">
            Journal details
          </p>
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-gray-600">Date</label>
              <NepaliDatePicker value={date} onChange={setDate} required />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-[12px] font-medium text-gray-600">Narration</label>
              <Input
                value={narration}
                onChange={setNarration}
                placeholder="Purpose of stock transfer"
              />
            </div>
          </div>

          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-gray-500">
            Transfer lines
          </p>
          <div className="space-y-3">
            {lines.map((line, index) => (
              <div
                key={line.id}
                className="grid grid-cols-1 gap-2 rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface-muted)] p-3 md:grid-cols-6"
              >
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
                    label="From warehouse"
                    value={line.fromWarehouseId}
                    onChange={(val) => updateLine(line.id, { fromWarehouseId: val })}
                    options={[{ value: "", label: "Select warehouse" }, ...warehouseOptions]}
                    required
                  />
                  <Select
                    label="To warehouse"
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
                  <div>
                    <Input
                      label="Rate"
                      type="number"
                      value={line.rate || ""}
                      onChange={(val) => updateLine(line.id, { rate: Number(val) || 0 })}
                      prefix={symbol}
                      placeholder="0.00"
                      required
                    />
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-mono text-[12px] text-gray-600">
                        {symbol} {formatNumber((line.qty || 0) * (line.rate || 0))}
                      </span>
                      <Button size="xs" variant="danger" onClick={() => removeLine(line.id)}>
                        Remove
                      </Button>
                    </div>
                  </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                size="sm"
                variant="outline"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setLines((prev) => [...prev, createLine()])}
              >
                Add line
              </Button>
              <div className="text-right text-[12px] text-gray-600">
                Total qty:{" "}
                <span className="font-mono font-semibold text-gray-800">
                  {formatNumber(totals.totalQty)}
                </span>
                <br />
                Total value:{" "}
                <span className="font-mono font-semibold text-gray-800">
                  {symbol} {formatNumber(totals.totalValue)}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--ox-border)] pt-4">
            <button
              type="button"
              className="h-8 rounded-md bg-[var(--ds-action-primary)] px-3 text-[12px] font-medium text-white hover:bg-[var(--ds-action-primary-hover)] disabled:opacity-50"
              onClick={handleCreate}
              disabled={saving}
            >
              Save stock journal
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-gray-300 bg-white px-3 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
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
    <div className="min-h-screen bg-[var(--ox-bg,var(--ds-canvas))] p-4 text-[12px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Stock journal</h1>
          <p className="mt-0.5 text-[12px] text-gray-500">
            Draft and post warehouse transfer journals
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
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setMode("new")}
          >
            New stock journal
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-[var(--ox-border)] bg-[var(--ox-surface)]">
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
