// @ts-nocheck
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
import { computeStockPosition, getLowStockItems, getCurrentStock } from "../lib/stockUtils";
import { formatCurrency, formatNumber } from "../lib/utils";

type TabKey = "PRODUCT" | "SERVICE" | "ALL" | "REORDER";

const StockBook: React.FC = () => {
  const { items, warehouses, stockMovements, addItem, updateItem, setCurrentPage } = useStore();

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

  const handleExportReorder = () => {
    const alerts = items
      .filter(i => {
        if (!i.reorderLevel) return false;
        const stock = getCurrentStock(i.id, undefined, stockMovements);
        return stock <= i.reorderLevel;
      })
      .map(i => {
        const stock = getCurrentStock(i.id, undefined, stockMovements);
        return {
          id: i.id,
          name: i.name,
          category: (i as any).category || "Uncategorized",
          stock,
          reorderLevel: i.reorderLevel || 0,
          shortage: (i.reorderLevel || 0) - stock,
          unit: i.unit || "PCS",
          lastPurchaseRate: i.purchaseRate || 0
        };
      })
      .sort((a, b) => b.shortage - a.shortage);

    const rows = alerts.map(a => ({
      "Item Name": a.name,
      "Group": a.category,
      "Current Stock": a.stock,
      "Reorder Level": a.reorderLevel,
      "Shortage": a.shortage,
      "Unit": a.unit,
      "Last Purchase Rate": a.lastPurchaseRate
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reorder Alerts");
    XLSX.writeFile(wb, `reorder-alerts-${new Date().toISOString().slice(0, 10)}.xlsx`);
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

  // ===== Detail panel data =====
  const detailData = useMemo(() => {
    if (!detailItem) return null;
    const perWarehouse = warehouses.map((w) => ({
      warehouse: w,
      position: computeStockPosition(stockMovements, detailItem.id, w.id),
    }));
    const movements = stockMovements
      .filter((m) => m.itemId === detailItem.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50);
    return { perWarehouse, movements };
  }, [detailItem, warehouses, stockMovements]);

  // ===== Render row =====
  const renderRow = (it: Item) => {
    const stock = stockByItem.get(it.id) ?? 0;
    const isLow = lowStockSet.has(it.id) && it.type === ItemType.PRODUCT;
    return (
      <tr
        key={it.id}
        onClick={() => setDetailItem(it)}
        className={`cursor-pointer border-b border-[#9DC07A] text-sm transition-colors ${
          isLow ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-[#D4EABD]/40"
        }`}
      >
        <td className="px-3 py-2 font-mono text-xs text-[#000000]">{it.code}</td>
        <td className="px-3 py-2 font-semibold text-[#000000]">
          {it.name}
          {it.nameNepali && <div className="text-[11px] text-[#000000]">{it.nameNepali}</div>}
        </td>
        <td className="px-3 py-2">
          <Badge variant={it.type === ItemType.PRODUCT ? "info" : "default"}>
            {it.type === ItemType.PRODUCT ? "Product" : "Service"}
          </Badge>
        </td>
        <td className="px-3 py-2 text-xs text-[#000000]">{it.unit ?? "—"}</td>
        <td className="px-3 py-2 text-right font-mono">{formatNumber(it.purchaseRate ?? 0)}</td>
        <td className="px-3 py-2 text-right font-mono">{formatNumber(it.salesRate ?? 0)}</td>
        <td className="px-3 py-2 text-right font-mono text-[#000000]">
          {it.mrp ? formatNumber(it.mrp) : "—"}
        </td>
        <td className="px-3 py-2 text-right font-mono">
          {it.type === ItemType.PRODUCT ? (
            <div className="inline-flex items-center justify-end">
              <span className={isLow ? "text-orange-700 font-bold" : ""}>{formatNumber(stock)}</span>
              {(stock <= (it.reorderLevel || 0) && (it.reorderLevel || 0) > 0) && (
                <span className="ml-1.5 badge badge-unpaid text-[9px] bg-red-100 text-red-700 border border-red-205">LOW</span>
              )}
            </div>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-2 text-center">{it.isTaxable ? "Y" : "N"}</td>
        <td className="px-3 py-2 text-right font-mono text-[#000000]">
          {it.type === ItemType.PRODUCT ? (it.minimumStock ?? 0) : "—"}
        </td>
        <td className="px-3 py-2">
          <Badge variant={it.isActive ? "success" : "default"}>
            {it.isActive ? "Active" : "Inactive"}
          </Badge>
        </td>
        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
          <Button
            size="xs"
            variant="ghost"
            icon={<Edit2 className="h-3.5 w-3.5" />}
            onClick={() => handleEdit(it)}
          >
            Edit
          </Button>
        </td>
      </tr>
    );
  };

  const tableHeader = (
    <thead>
      <tr className="border-b-2 border-[#9DC07A] bg-[#EBF5E2] text-[11px] font-bold uppercase text-[#000000]">
        <th className="px-3 py-2 text-left">Code</th>
        <th className="px-3 py-2 text-left">Name</th>
        <th className="px-3 py-2 text-left">Type</th>
        <th className="px-3 py-2 text-left">Unit</th>
        <th className="px-3 py-2 text-right">Purchase</th>
        <th className="px-3 py-2 text-right">Sales</th>
        <th className="px-3 py-2 text-right">MRP</th>
        <th className="px-3 py-2 text-right">Stock</th>
        <th className="px-3 py-2 text-center">Tax</th>
        <th className="px-3 py-2 text-right">Min</th>
        <th className="px-3 py-2 text-left">Status</th>
        <th className="px-3 py-2 text-right">Actions</th>
      </tr>
    </thead>
  );

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#9DC07A] pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-[#000000]">
            <Package className="h-5 w-5 text-[#000000]" />
            ITEMS MASTER
          </h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#000000]">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[
          { label: "Total Items", value: items.length, color: "#1557b0" },
          { label: "Low Stock", value: items.filter(i => (stockByItem.get(i.id)||0) <= (i.reorderLevel||0) && (i.reorderLevel||0) > 0).length, color: "#dc2626" },
          { label: "Out of Stock", value: items.filter(i => (stockByItem.get(i.id)||0) === 0).length, color: "#b45309" },
          { label: "Active SKUs", value: items.filter(i => i.isActive !== false).length, color: "#15803d" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border rounded-lg p-3 flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
            <div className="w-1 h-8 rounded-full shrink-0" style={{ background: color }} />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#000000]">{label}</div>
              <div className="text-[18px] font-bold text-[#000000] leading-none mt-0.5">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {(["PRODUCT", "SERVICE", "ALL", "REORDER"] as TabKey[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`rounded-lg border px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${
              activeTab === t
                ? "border-[#9DC07A] bg-[#D4EABD] text-white"
                : "border-[#9DC07A] bg-[#EBF5E2] text-[#000000] hover:bg-[#EBF5E2]"
            }`}
          >
            {t === "PRODUCT" ? "Products" : t === "SERVICE" ? "Services" : t === "REORDER" ? "Reorder Alerts" : "All Items"}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      {activeTab !== "REORDER" && (
        <div className="flex flex-col gap-3 rounded-xl border border-[#9DC07A] bg-white p-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Search by code, name, HSN, barcode…"
              inputClassName="pl-9"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#000000]" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#000000]">
              <input
                type="checkbox"
                checked={groupByCategory}
                onChange={(e) => setGroupByCategory(e.target.checked)}
                className="h-4 w-4 rounded border-[#9DC07A]"
              />
              Group by Category
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#000000]">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="h-4 w-4 rounded border-[#9DC07A]"
              />
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              Low Stock Only
              {lowStockSet.size > 0 && <Badge variant="warning">{lowStockSet.size}</Badge>}
            </label>
          </div>
        </div>
      )}

      {/* Reorder Alerts Table */}
      {activeTab === "REORDER" && (
        <Card border padding="none">
          <div className="p-3 border-b border-[#9DC07A] flex justify-between items-center bg-white">
             <h3 className="text-[14px] font-semibold text-[#000000]">Items Below Reorder Level</h3>
             <Button variant="outline" size="sm" icon={<Download className="w-4 h-4"/>} onClick={handleExportReorder}>
               Export Alerts
             </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#f5f6fa] border-b border-[#9DC07A]">
                <tr>
                  <th className="px-3 py-2.5 text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Item Name</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Group</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold text-[#000000] uppercase tracking-wide text-right">Current Stock</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold text-[#000000] uppercase tracking-wide text-right">Reorder Level</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold text-[#000000] uppercase tracking-wide text-right">Shortage</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Unit</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold text-[#000000] uppercase tracking-wide text-right">Last Purchase Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.filter(i => i.reorderLevel && getCurrentStock(i.id, undefined, stockMovements) <= i.reorderLevel)
                  .map(i => ({
                    ...i,
                    stock: getCurrentStock(i.id, undefined, stockMovements),
                    shortage: (i.reorderLevel || 0) - getCurrentStock(i.id, undefined, stockMovements)
                  }))
                  .sort((a,b) => b.shortage - a.shortage)
                  .map(alert => (
                    <tr key={alert.id} className="hover:bg-red-50/50 bg-white">
                       <td className="px-3 py-2.5 text-[12px] font-semibold text-[#000000]">{alert.name}</td>
                       <td className="px-3 py-2.5 text-[12px] text-[#000000]">{(alert as any).category || "Uncategorized"}</td>
                       <td className="px-3 py-2.5 text-[12px] text-right font-bold text-red-600">{alert.stock}</td>
                       <td className="px-3 py-2.5 text-[12px] text-right text-[#000000]">{alert.reorderLevel}</td>
                       <td className="px-3 py-2.5 text-[12px] text-right font-bold text-amber-600">{alert.shortage}</td>
                       <td className="px-3 py-2.5 text-[12px] text-[#000000]">{alert.unit || "PCS"}</td>
                       <td className="px-3 py-2.5 text-[12px] text-right font-mono text-[#000000]">Rs. {formatNumber(alert.purchaseRate || 0)}</td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Main Table */}
      {activeTab !== "REORDER" && (
        <Card border padding="none">
        <div className="overflow-x-auto">
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8" />}
              title="No items found"
              description={
                search
                  ? "Try adjusting your search or filters."
                  : "Create your first item to get started."
              }
            />
          ) : grouped ? (
            <table className="data-table">
              {tableHeader}
              <tbody>
                {Object.entries(grouped).map(([cat, list]) => (
                  <React.Fragment key={cat}>
                    <tr>
                      <td
                        colSpan={12}
                        className="bg-[#EBF5E2] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#000000]"
                      >
                        {cat}{" "}
                        <span className="ml-2 font-normal text-[#000000]">({list.length})</span>
                      </td>
                    </tr>
                    {list.map(renderRow)}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              {tableHeader}
              <tbody>{paginatedItems.map(renderRow)}</tbody>
            </table>
          )}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          totalRecords={filteredItems.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </Card>
      )}

      {/* Item Form Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit Item — ${editing.name}` : "New Item"}
        size="full"
      >
        <ItemForm item={editing} onSave={handleSave} onCancel={() => setFormOpen(false)} />
      </Modal>

      {/* Detail Panel */}
      {detailItem && detailData && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="flex-1 bg-black/30" onClick={() => setDetailItem(null)} />
          <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#9DC07A] p-4">
              <div>
                <div className="text-xs font-mono text-[#000000]">{detailItem.code}</div>
                <h3 className="text-lg font-bold text-[#000000]">{detailItem.name}</h3>
                {detailItem.nameNepali && (
                  <div className="text-xs text-[#000000]">{detailItem.nameNepali}</div>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={detailItem.type === ItemType.PRODUCT ? "info" : "default"}>
                    {detailItem.type}
                  </Badge>
                  {detailItem.hsnCode && <Badge variant="default">HSN: {detailItem.hsnCode}</Badge>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="rounded-md p-1 text-[#000000] hover:bg-[#EBF5E2] hover:text-[#000000]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-4">
              <section>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#000000]">
                  Pricing
                </h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded border border-[#9DC07A] p-2">
                    <div className="text-[10px] uppercase text-[#000000]">Purchase</div>
                    <div className="font-mono font-bold">
                      {formatCurrency(detailItem.purchaseRate ?? 0)}
                    </div>
                  </div>
                  <div className="rounded border border-[#9DC07A] p-2">
                    <div className="text-[10px] uppercase text-[#000000]">Sales</div>
                    <div className="font-mono font-bold">
                      {formatCurrency(detailItem.salesRate ?? 0)}
                    </div>
                  </div>
                  <div className="rounded border border-[#9DC07A] p-2">
                    <div className="text-[10px] uppercase text-[#000000]">MRP</div>
                    <div className="font-mono font-bold">
                      {detailItem.mrp ? formatCurrency(detailItem.mrp) : "—"}
                    </div>
                  </div>
                </div>
              </section>

              {detailItem.type === ItemType.PRODUCT && (
                <section>
                  <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#000000]">
                    Stock by Warehouse
                  </h4>
                  <div className="overflow-hidden rounded border border-[#9DC07A]">
                    <table className="w-full text-sm">
                      <thead className="bg-[#EBF5E2] text-[11px] uppercase text-[#000000]">
                        <tr>
                          <th className="px-3 py-2 text-left">Warehouse</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Avg Rate</th>
                          <th className="px-3 py-2 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.perWarehouse.map(({ warehouse, position }) => (
                          <tr key={warehouse.id} className="border-t border-[#9DC07A]">
                            <td className="px-3 py-2">{warehouse.name}</td>
                            <td className="px-3 py-2 text-right font-mono">
                              {formatNumber(position.qty)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {formatNumber(position.avgRate)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {formatNumber(position.value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <section>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#000000]">
                  Recent Stock Movements
                </h4>
                {detailData.movements.length === 0 ? (
                  <div className="rounded border border-dashed border-[#9DC07A] p-4 text-center text-xs text-[#000000]">
                    No stock movements yet.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded border border-[#9DC07A]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#EBF5E2] text-[10px] uppercase text-[#000000]">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Date</th>
                          <th className="px-2 py-1.5 text-left">Type</th>
                          <th className="px-2 py-1.5 text-left">Ref</th>
                          <th className="px-2 py-1.5 text-right">Qty</th>
                          <th className="px-2 py-1.5 text-right">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.movements.map((m) => (
                          <tr key={m.id} className="border-t border-[#9DC07A]">
                            <td className="px-2 py-1.5 font-mono">{m.date}</td>
                            <td className="px-2 py-1.5">{m.type}</td>
                            <td className="px-2 py-1.5 text-[#000000]">{m.referenceNo ?? "—"}</td>
                            <td className="px-2 py-1.5 text-right font-mono">
                              {formatNumber(m.qty)}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono">
                              {formatNumber(m.rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#000000]">
                  Quick Actions
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<ShoppingCart className="h-4 w-4" />}
                    onClick={() => {
                      setDetailItem(null);
                      setCurrentPage("purchase-invoice");
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
                      setCurrentPage("sales-invoice");
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

            <div className="mt-auto flex justify-end gap-2 border-t border-[#9DC07A] p-3">
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

