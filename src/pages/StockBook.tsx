import React, { useMemo, useRef, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  Package,
  Plus,
  Search,
  Download,
  Upload,
  AlertTriangle,
  FileText,
  Edit2,
  ShoppingCart,
  TrendingUp,
  Eye,
  X,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { Card, Badge, Button, Input, Modal, EmptyState, Pagination } from "../components/ui";
import ItemForm from "../components/item/ItemForm";
import { ItemType, type Item } from "../lib/types";
import { computeStockPosition, getLowStockItems } from "../lib/stockUtils";
import { formatCurrency, formatNumber } from "../lib/utils";
import { getStockBalance, calculateFIFOLayers } from "../lib/accounting";

type TabKey = "PRODUCT" | "SERVICE" | "ALL";

const StockBook: React.FC = () => {
  const {
    items,
    warehouses,
    stockMovements,
    addItem,
    updateItem,
    setCurrentPage,
    companySettings,
  } = useStore();

  const [activeTab, setActiveTab] = useState<TabKey>("PRODUCT");
  const [search, setSearch] = useState("");
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Item | undefined>(undefined);

  const [detailItem, setDetailItem] = useState<Item | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Real-time current stock per item (across all warehouses)
  const stockByItem = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((it) => {
      const pos = computeStockPosition(stockMovements, it.id, null);
      map.set(it.id, pos.qty);
    });
    return map;
  }, [items, stockMovements]);

  const lowStockSet = useMemo(() => {
    const rows = getLowStockItems(stockMovements, items, warehouses);
    return new Set(rows.map((r) => r.id));
  }, [items, warehouses, stockMovements]);

  const lowStockItemsList = useMemo(() => {
    return items.filter((it) => {
      if (it.type !== ItemType.PRODUCT) return false;
      const stock = stockByItem.get(it.id) ?? 0;
      return it.reorderLevel !== undefined && stock <= it.reorderLevel && it.reorderLevel > 0;
    });
  }, [items, stockByItem]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (activeTab === "PRODUCT" && it.type !== ItemType.PRODUCT) return false;
      if (activeTab === "SERVICE" && it.type !== ItemType.SERVICE) return false;
      if (lowStockOnly && !lowStockSet.has(it.id)) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        it.code.toLowerCase().includes(q) ||
        (it.nameNepali ?? "").toLowerCase().includes(q) ||
        (it.hsnCode ?? "").toLowerCase().includes(q) ||
        (it.barcode ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, activeTab, lowStockOnly, lowStockSet]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, activeTab, groupByCategory, lowStockOnly]);

  const grouped = useMemo(() => {
    if (!groupByCategory) return null;
    const groups: Record<string, Item[]> = {};
    for (const it of paginatedItems) {
      const key = ((it as any).category as string) || "Uncategorized";
      (groups[key] = groups[key] || []).push(it);
    }
    return groups;
  }, [paginatedItems, groupByCategory]);

  // ===== Handlers =====
  const handleOpenCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const handleEdit = (it: Item) => {
    setEditing(it);
    setFormOpen(true);
  };

  const handleSave = async (payload: Item) => {
    try {
      if (editing) {
        await updateItem({ ...editing, ...payload, id: editing.id });
        toast.success(`Item ${payload.name} updated`);
      } else {
        const { id: _ignore, ...rest } = payload as any;
        await addItem(rest);
        toast.success(`Item ${payload.name} created`);
      }
      setFormOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save item");
    }
  };

  const handleExport = () => {
    const rows = filteredItems.map((it) => ({
      Code: it.code,
      Name: it.name,
      "Name (Nepali)": it.nameNepali ?? "",
      Type: it.type,
      HSN: it.hsnCode ?? "",
      Unit: it.unit ?? "",
      "Purchase Rate": it.purchaseRate ?? 0,
      "Sales Rate": it.salesRate ?? 0,
      MRP: it.mrp ?? 0,
      Taxable: it.isTaxable ? "Y" : "N",
      "VAT %": it.vatRate ?? "",
      "Current Stock": stockByItem.get(it.id) ?? 0,
      "Min Stock": it.minimumStock ?? "",
      "Reorder Level": it.reorderLevel ?? "",
      Status: it.isActive ? "Active" : "Inactive",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Items");
    XLSX.writeFile(wb, `items-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        Code: "ITEM-001",
        Name: "Sample Product",
        "Name (Nepali)": "",
        Type: "product",
        HSN: "",
        Unit: "PCS",
        "Purchase Rate": 100,
        "Sales Rate": 120,
        MRP: 130,
        Taxable: "Y",
        "VAT %": 13,
        "Opening Stock": 0,
        "Opening Rate": 0,
        "Reorder Level": 10,
        Category: "",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Items Template");
    XLSX.writeFile(wb, "items-import-template.xlsx");
  };

  const handleImportFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      let created = 0;
      for (const r of rows) {
        if (!r.Name) continue;
        const type =
          String(r.Type ?? "product").toLowerCase() === "service"
            ? ItemType.SERVICE
            : ItemType.PRODUCT;
        await addItem({
          code: String(r.Code ?? "").trim() || `ITEM-${Date.now()}-${created}`,
          name: String(r.Name).trim(),
          nameNepali: r["Name (Nepali)"] ? String(r["Name (Nepali)"]) : undefined,
          type,
          hsnCode: r.HSN ? String(r.HSN) : undefined,
          unit: r.Unit ? String(r.Unit) : "PCS",
          purchaseRate: Number(r["Purchase Rate"]) || 0,
          salesRate: Number(r["Sales Rate"]) || 0,
          mrp: Number(r.MRP) || 0,
          isTaxable: String(r.Taxable ?? "Y").toUpperCase() === "Y",
          vatRate: Number(r["VAT %"]) || 13,
          openingStock: Number(r["Opening Stock"]) || 0,
          openingStockRate: Number(r["Opening Rate"]) || 0,
          reorderLevel: Number(r["Reorder Level"]) || 10,
          isActive: true,
        } as any);
        created++;
      }
      toast.success(`Imported ${created} item(s)`);
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    }
  };

  // ===== Detail panel calculations =====
  const detailData = useMemo(() => {
    if (!detailItem) return null;
    const perWarehouse = warehouses.map((w) => {
      const bal = getStockBalance(detailItem.id, w.id, stockMovements);
      return {
        warehouse: w,
        position: {
          qty: bal.qty,
          avgRate: bal.avgCost,
          value: bal.value,
        },
      };
    });
    return { perWarehouse };
  }, [detailItem, warehouses, stockMovements]);

  // Chronological stock movements calculation with running balance
  const chronologicalMovements = useMemo(() => {
    if (!detailItem) return [];

    const sorted = stockMovements
      .filter((m) => m.itemId === detailItem.id)
      .sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
      });

    const openingQty = detailItem.openingStock || 0;
    let runningQty = openingQty;

    return sorted.map((m) => {
      const isIncoming =
        m.type === "IN" ||
        m.type === "purchase" ||
        m.type === "opening" ||
        m.type === "transfer-in" ||
        m.type === "sales-return" ||
        m.type === "adjustment" ||
        (m.type as string) === "purchase-return-inbound";

      const isOutgoing =
        m.type === "OUT" ||
        m.type === "sales" ||
        m.type === "transfer-out" ||
        m.type === "purchase-return" ||
        (m.type as string) === "sales-return-outbound";

      if (isIncoming) {
        runningQty += m.qty;
      } else if (isOutgoing) {
        runningQty -= m.qty;
      }

      return {
        ...m,
        isIncoming,
        isOutgoing,
        runningQty,
      };
    });
  }, [detailItem, stockMovements]);

  // ===== Render row =====
  const renderRow = (it: Item) => {
    const stock = stockByItem.get(it.id) ?? 0;
    const isLow = lowStockSet.has(it.id) && it.type === ItemType.PRODUCT;
    return (
      <tr
        key={it.id}
        onClick={() => setDetailItem(it)}
        className={`cursor-pointer border-b border-gray-100 text-sm transition-colors ${
          isLow ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-blue-50/40"
        }`}
      >
        <td className="px-3 py-2 font-mono text-xs text-gray-700">{it.code}</td>
        <td className="px-3 py-2 font-semibold text-gray-900">
          {it.name}
          {it.nameNepali && <div className="text-[11px] text-gray-500">{it.nameNepali}</div>}
        </td>
        <td className="px-3 py-2">
          <Badge variant={it.type === ItemType.PRODUCT ? "info" : "primary"}>
            {it.type === ItemType.PRODUCT ? "Product" : "Service"}
          </Badge>
        </td>
        <td className="px-3 py-2 text-xs text-gray-600">{it.unit ?? "—"}</td>
        <td className="px-3 py-2 text-right font-mono">{formatNumber(it.purchaseRate ?? 0)}</td>
        <td className="px-3 py-2 text-right font-mono">{formatNumber(it.salesRate ?? 0)}</td>
        <td className="px-3 py-2 text-right font-mono text-gray-500">
          {it.mrp ? formatNumber(it.mrp) : "—"}
        </td>
        <td className="px-3 py-2 text-right font-mono">
          {it.type === ItemType.PRODUCT ? (
            <div className="inline-flex items-center justify-end">
              <span className={isLow ? "text-orange-700 font-bold" : ""}>
                {formatNumber(stock)}
              </span>
              {stock <= (it.reorderLevel || 0) && (it.reorderLevel || 0) > 0 && (
                <span className="ml-1.5 badge badge-unpaid text-[9px] bg-red-100 text-red-700 border border-red-205">
                  LOW
                </span>
              )}
            </div>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-2 text-center text-xs text-gray-650">
          {it.isTaxable ? `${it.vatRate || 13}%` : "Exempt"}
        </td>
        <td className="px-3 py-2 text-right font-mono text-gray-500">{it.minimumStock ?? "—"}</td>
        <td className="px-3 py-2 text-left">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              it.isActive ? "bg-green-500" : "bg-gray-300"
            }`}
          />
        </td>
        <td className="px-3 py-2 text-right">
          <Button
            size="xs"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(it);
            }}
          >
            Edit
          </Button>
        </td>
      </tr>
    );
  };

  const renderHeader = () => (
    <thead className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
      <tr>
        <th className="px-3 py-2 text-left">Code</th>
        <th className="px-3 py-2 text-left">Item Name</th>
        <th className="px-3 py-2 text-left">Type</th>
        <th className="px-3 py-2 text-left">Unit</th>
        <th className="px-3 py-2 text-right">Purchase</th>
        <th className="px-3 py-2 text-right">Sales</th>
        <th className="px-3 py-2 text-right">MRP</th>
        <th className="px-3 py-2 text-right">Live Stock</th>
        <th className="px-3 py-2 text-center">Tax</th>
        <th className="px-3 py-2 text-right">Min</th>
        <th className="px-3 py-2 text-left">Status</th>
        <th className="px-3 py-2 text-right">Actions</th>
      </tr>
    </thead>
  );

  return (
    <div className="flex flex-col gap-5 animate-fadeIn page-wrapper">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-800">
            <Package className="h-5 w-5 text-blue-700" />
            ITEMS MASTER
          </h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Products, services and live stock positions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<FileText className="h-4 w-4" />}
            onClick={handleDownloadTemplate}
          >
            Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Upload className="h-4 w-4" />}
            onClick={() => importInputRef.current?.click()}
          >
            Import
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={handleOpenCreate}
          >
            Add Item
          </Button>
        </div>
      </div>

      {/* Low Stock Alerts Section */}
      {lowStockItemsList.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 text-orange-950 p-4 rounded-md text-[12px]">
          <div className="font-bold mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-orange-600 animate-pulse" />
            <span>Low Stock Alerts</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItemsList.map((item) => (
              <div
                key={item.id}
                onClick={() => setDetailItem(item)}
                className="bg-white px-2.5 py-1 border border-orange-100 rounded-md cursor-pointer hover:bg-orange-100/50 flex items-center gap-2"
              >
                <span className="font-semibold text-gray-800">{item.name}</span>
                <span className="font-mono text-gray-500 font-bold">
                  ({stockByItem.get(item.id)} left)
                </span>
                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 text-[9px] font-bold uppercase rounded">
                  LOW STOCK
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[
          { label: "Total Items", value: items.length, color: "#1557b0" },
          { label: "Low Stock", value: lowStockItemsList.length, color: "#dc2626" },
          {
            label: "Out of Stock",
            value: items.filter((i) => (stockByItem.get(i.id) || 0) === 0).length,
            color: "#b45309",
          },
          {
            label: "Active SKUs",
            value: items.filter((i) => i.isActive !== false).length,
            color: "#15803d",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white border rounded-lg p-3 flex items-center gap-3"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="w-1 h-8 rounded-full shrink-0" style={{ background: color }} />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                {label}
              </div>
              <div className="text-[18px] font-bold text-gray-800 leading-none mt-0.5">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {(["PRODUCT", "SERVICE", "ALL"] as TabKey[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`rounded-lg border px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${
              activeTab === t
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            {t === "PRODUCT" ? "Products" : t === "SERVICE" ? "Services" : "All Items"}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Input
            value={search}
            onChange={setSearch}
            placeholder="Search by code, name, HSN, barcode…"
            inputClassName="pl-9"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={groupByCategory}
              onChange={(e) => setGroupByCategory(e.target.checked)}
              className="rounded border-gray-300"
            />
            Group by Category
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            Low Stock Alerts Only
          </label>
        </div>
      </div>

      {/* Table / Grid */}
      <Card border padding="none">
        {filteredItems.length === 0 ? (
          <EmptyState
            title="No Items Found"
            description="Try widening your search terms or create a new item above."
          />
        ) : groupByCategory && grouped ? (
          <div className="divide-y divide-gray-150">
            {Object.entries(grouped).map(([category, list]) => (
              <div key={category} className="p-3">
                <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {category}
                </h4>
                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    {renderHeader()}
                    <tbody>{list.map(renderRow)}</tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              {renderHeader()}
              <tbody>{paginatedItems.map(renderRow)}</tbody>
            </table>
            {totalPages > 1 && (
              <div className="border-t border-gray-200 p-3">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalRecords={filteredItems.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Item" : "Create Item"}
      >
        <ItemForm item={editing} onSave={handleSave} onCancel={() => setFormOpen(false)} />
      </Modal>

      {/* Detail Panel */}
      {detailItem && detailData && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="flex-1 bg-black/30" onClick={() => setDetailItem(null)} />
          <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 p-4">
              <div>
                <div className="text-xs font-mono text-gray-500">{detailItem.code}</div>
                <h3 className="text-lg font-bold text-slate-800">{detailItem.name}</h3>
                {detailItem.nameNepali && (
                  <div className="text-xs text-gray-500">{detailItem.nameNepali}</div>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={detailItem.type === ItemType.PRODUCT ? "info" : "primary"}>
                    {detailItem.type}
                  </Badge>
                  {detailItem.hsnCode && <Badge variant="default">HSN: {detailItem.hsnCode}</Badge>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-4">
              <section>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Pricing
                </h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded border border-gray-200 p-2">
                    <div className="text-[10px] uppercase text-gray-500">Purchase</div>
                    <div className="font-mono font-bold">
                      {formatCurrency(detailItem.purchaseRate ?? 0)}
                    </div>
                  </div>
                  <div className="rounded border border-gray-200 p-2">
                    <div className="text-[10px] uppercase text-gray-500">Sales</div>
                    <div className="font-mono font-bold">
                      {formatCurrency(detailItem.salesRate ?? 0)}
                    </div>
                  </div>
                  <div className="rounded border border-gray-200 p-2">
                    <div className="text-[10px] uppercase text-gray-500">MRP</div>
                    <div className="font-mono font-bold">
                      {detailItem.mrp ? formatCurrency(detailItem.mrp) : "—"}
                    </div>
                  </div>
                </div>
              </section>

              {/* Warehouse summary breakup */}
              {detailItem.type === ItemType.PRODUCT && warehouses.length > 1 && (
                <section>
                  <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Stock Summary by Warehouse
                  </h4>
                  <div className="overflow-hidden rounded border border-gray-200 bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-[11px] uppercase text-gray-600">
                        <tr>
                          <th className="px-3 py-2 text-left">Warehouse</th>
                          <th className="px-3 py-2 text-right">Quantity</th>
                          <th className="px-3 py-2 text-right">Avg Rate</th>
                          <th className="px-3 py-2 text-right">Valuation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.perWarehouse.map(({ warehouse, position }) => (
                          <tr
                            key={warehouse.id}
                            className="border-t border-gray-100 font-mono text-xs"
                          >
                            <td className="px-3 py-2 text-left font-sans font-semibold">
                              {warehouse.name}
                            </td>
                            <td className="px-3 py-2 text-right">{formatNumber(position.qty)}</td>
                            <td className="px-3 py-2 text-right">
                              Rs. {formatNumber(position.avgRate)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold">
                              Rs. {formatNumber(position.value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* FIFO Stock Ageing details */}
              {detailItem.type === ItemType.PRODUCT && (
                <section>
                  <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    FIFO Stock Ageing
                  </h4>
                  {(() => {
                    const layers = calculateFIFOLayers(detailItem.id, stockMovements);
                    if (layers.length === 0) {
                      return (
                        <div className="text-xs text-gray-500 p-2 border border-dashed rounded text-center">
                          No stock layers currently available.
                        </div>
                      );
                    }
                    return (
                      <div className="overflow-hidden rounded border border-gray-200 bg-white">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-[11px] uppercase text-gray-600">
                            <tr>
                              <th className="px-3 py-2 text-left">In Date</th>
                              <th className="px-3 py-2 text-right">Layer Qty</th>
                              <th className="px-3 py-2 text-right">Cost Rate</th>
                              <th className="px-3 py-2 text-right">Sitting Age</th>
                            </tr>
                          </thead>
                          <tbody>
                            {layers.map((layer, index) => {
                              const purchaseDate = new Date(layer.date);
                              const today = new Date();
                              const ageDays = Math.max(
                                0,
                                Math.floor(
                                  (today.getTime() - purchaseDate.getTime()) /
                                    (1000 * 60 * 60 * 24),
                                ),
                              );
                              return (
                                <tr
                                  key={index}
                                  className="border-t border-gray-100 font-mono text-xs"
                                >
                                  <td className="px-3 py-2 text-left">{layer.date}</td>
                                  <td className="px-3 py-2 text-right">
                                    {formatNumber(layer.qty)}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    Rs. {formatNumber(layer.cost)}
                                  </td>
                                  <td
                                    className={`px-3 py-2 text-right font-bold ${ageDays > 90 ? "text-red-600" : ageDays > 30 ? "text-amber-600" : "text-green-600"}`}
                                  >
                                    {ageDays} days
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </section>
              )}

              {/* Movement History with Opening Stock & Running Balance */}
              <section>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Stock Movements History & Running Balance
                </h4>
                {chronologicalMovements.length === 0 && !detailItem.openingStock ? (
                  <div className="rounded border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
                    No stock movements yet.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded border border-gray-200 bg-white">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase text-gray-650">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Date</th>
                          <th className="px-2 py-1.5 text-left">Type</th>
                          <th className="px-2 py-1.5 text-left">Ref</th>
                          <th className="px-2 py-1.5 text-right">In Qty</th>
                          <th className="px-2 py-1.5 text-right">Out Qty</th>
                          <th className="px-2 py-1.5 text-right">Rate</th>
                          <th className="px-2 py-1.5 text-right">Running Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* 1. Show Opening Stock Row at the top */}
                        {detailItem.type === ItemType.PRODUCT &&
                          (detailItem.openingStock || 0) > 0 && (
                            <tr className="border-t border-gray-100 bg-blue-50/50">
                              <td className="px-2 py-1.5 font-mono">Opening</td>
                              <td className="px-2 py-1.5 font-semibold text-blue-700">OPENING</td>
                              <td className="px-2 py-1.5 text-gray-500">—</td>
                              <td className="px-2 py-1.5 text-right font-mono">
                                {formatNumber(detailItem.openingStock || 0)}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono">—</td>
                              <td className="px-2 py-1.5 text-right font-mono">
                                Rs. {formatNumber(detailItem.openingStockRate || 0)}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono font-bold text-blue-800">
                                {formatNumber(detailItem.openingStock || 0)}
                              </td>
                            </tr>
                          )}
                        {/* 2. Show Subsequent Movements */}
                        {chronologicalMovements.map((m) => {
                          const isNegative =
                            m.runningQty < 0 && !companySettings?.allowNegativeStock;
                          const rowClass = isNegative
                            ? "bg-red-50 text-red-900 border-red-200 font-semibold"
                            : "border-t border-gray-100 hover:bg-gray-50";
                          return (
                            <tr key={m.id} className={rowClass}>
                              <td className="px-2 py-1.5 font-mono">{m.date}</td>
                              <td className="px-2 py-1.5 font-medium uppercase">{m.type}</td>
                              <td className="px-2 py-1.5 text-gray-500">{m.referenceNo ?? "—"}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-green-700">
                                {m.isIncoming ? formatNumber(m.qty) : "—"}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono text-red-650">
                                {m.isOutgoing ? formatNumber(m.qty) : "—"}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono">
                                Rs. {formatNumber(m.rate)}
                              </td>
                              <td
                                className={`px-2 py-1.5 text-right font-mono font-bold ${isNegative ? "text-red-700 font-extrabold" : "text-gray-800"}`}
                              >
                                {formatNumber(m.runningQty)}
                                {isNegative && (
                                  <span className="ml-1 text-[9px] bg-red-200 text-red-800 px-1 py-0.5 rounded animate-pulse">
                                    NEG
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Quick Actions
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<ShoppingCart className="h-4 w-4" />}
                    onClick={() => {
                      setDetailItem(null);
                      setCurrentPage("invoices-new");
                    }}
                  >
                    New Purchase
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<TrendingUp className="h-4 w-4" />}
                    onClick={() => {
                      setDetailItem(null);
                      setCurrentPage("invoices-new");
                    }}
                  >
                    New Sales
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Eye className="h-4 w-4" />}
                    onClick={() => {
                      setDetailItem(null);
                      setCurrentPage("reports");
                    }}
                  >
                    View Stock
                  </Button>
                </div>
              </section>
            </div>

            <div className="mt-auto flex justify-end gap-2 border-t border-gray-200 p-3">
              <Button variant="secondary" onClick={() => setDetailItem(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                icon={<Edit2 className="h-4 w-4" />}
                onClick={() => {
                  handleEdit(detailItem);
                  setDetailItem(null);
                }}
              >
                Edit Item
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockBook;
