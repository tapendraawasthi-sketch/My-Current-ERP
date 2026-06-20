// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { Card, Badge, Table, Button, Input, Select, Modal } from "./ui";
import { Package, Plus, Search, Edit2, Scale, Percent, AlertCircle } from "lucide-react";
import { formatCurrency, formatNumber } from "../lib/utils";
import { ItemType } from "../lib/types";
import { calculateStockSummary } from "../lib/stockUtils";
import toast from "react-hot-toast";

const StockItems: React.FC = () => {
  const { items, units, stockMovements, addItem, updateItem } = useStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | ItemType>("ALL");

  // Modal visual handlers
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form parameters
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameNepali, setNameNepali] = useState("");
  const [type, setType] = useState<ItemType>(ItemType.PRODUCT);
  const [unit, setUnit] = useState("BOX");
  const [purchaseRate, setPurchaseRate] = useState<number>(0);
  const [salesRate, setSalesRate] = useState<number>(0);
  const [mrp, setMrp] = useState<number>(0);
  const [isTaxable, setIsTaxable] = useState<boolean>(true);
  const [openingStock, setOpeningStock] = useState<number>(0);
  const [openingRate, setOpeningRate] = useState<number>(0);
  const [reorderLevel, setReorderLevel] = useState<number>(10);

  // Compute live valuation ledger from transaction logs
  const stockSummary = useMemo(() => {
    return calculateStockSummary(items, stockMovements);
  }, [items, stockMovements]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.nameNepali && item.nameNepali.includes(searchTerm));

      const matchesTab = activeTab === "ALL" || item.type === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [items, searchTerm, activeTab]);

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setCode(`I-${Date.now().toString().slice(-6)}`);
    setName("");
    setNameNepali("");
    setType(ItemType.PRODUCT);
    setUnit(units[0]?.code || "BOX");
    setPurchaseRate(0);
    setSalesRate(0);
    setMrp(0);
    setIsTaxable(true);
    setOpeningStock(0);
    setOpeningRate(0);
    setReorderLevel(10);
    setModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setNameNepali(item.nameNepali || "");
    setType(item.type);
    setUnit(item.unit);
    setPurchaseRate(item.purchaseRate || 0);
    setSalesRate(item.salesRate || 0);
    setMrp(item.mrp || 0);
    setIsTaxable(item.isTaxable !== false);
    setOpeningStock(item.openingStock || 0);
    setOpeningRate(item.openingStockRate || item.openingRate || 0);
    setReorderLevel(item.reorderLevel || 10);
    setModalOpen(true);
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Item Particulars description Name is mandatory.");
      return;
    }

    try {
      if (editingItem) {
        await updateItem({
          ...editingItem,
          name: name.trim(),
          nameNepali: nameNepali.trim() || undefined,
          type,
          unit,
          purchaseRate,
          salesRate,
          mrp,
          isTaxable,
          openingStock,
          openingStockRate: openingRate,
          reorderLevel,
        });
        toast.success(`Inventory Stock Master ${name} amended.`);
      } else {
        await addItem({
          code,
          name: name.trim(),
          nameNepali: nameNepali.trim() || undefined,
          type,
          unit,
          purchaseRate,
          salesRate,
          mrp,
          isTaxable,
          openingStock,
          openingStockRate: openingRate,
          reorderLevel,
          isActive: true,
        });
        toast.success(`Product SKU ledger created: ${name}`);
      }
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Error occurred while saving item.");
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none">
      {/* Title Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-700" />
            <span>INVENTORY ITEMS RECORD</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1 leading-none font-semibold uppercase tracking-wider">
            Sutra Corporate Warehouse Stock Valuer
          </p>
        </div>

        <div className="shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
            icon={<Plus className="h-4 w-4" />}
          >
            Create Stock SKU Head
          </Button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 border border-gray-200 rounded-xl shadow-sm">
        <div className="w-full md:max-w-xs relative bg-white">
          <Input
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search items by Name, Code, SKU..."
            inputClassName="pl-9 text-xs"
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            <Search className="h-4 w-4" />
          </div>
        </div>

        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors border select-none ${activeTab === "ALL" ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}
          >
            Show All
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(ItemType.PRODUCT)}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors border select-none ${activeTab === ItemType.PRODUCT ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}
          >
            Products
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(ItemType.SERVICE)}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors border select-none ${activeTab === ItemType.SERVICE ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}
          >
            Services
          </button>
        </div>
      </div>

      {/* Grid listing table */}
      <Card border padding="none">
        <Table
          columns={[
            {
              key: "code",
              header: "SKU Code",
              width: "12%",
              render: (code) => (
                <span className="font-mono font-bold text-slate-400 text-xs">{code}</span>
              ),
            },
            {
              key: "name",
              header: "Sku Item Particulars",
              width: "35%",
              render: (name, row) => (
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800 text-xs">{name}</span>
                  {row.nameNepali && (
                    <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                      {row.nameNepali}
                    </span>
                  )}
                  <div className="flex gap-2.5 mt-1 text-[10px] text-gray-400 font-bold tracking-wider leading-none">
                    <span className="flex items-center gap-0.5">
                      <Scale className="h-3 w-3" /> Base Unit: {row.unit || "BOX"}
                    </span>
                    {row.isTaxable && (
                      <span className="text-green-600 flex items-center gap-0.5">
                        <Percent className="h-3 w-3" /> VAT 13% Eligible
                      </span>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: "purchaseRate",
              header: "Buying Base",
              align: "right",
              width: "13%",
              render: (rate) => (
                <span className="font-mono text-slate-600 text-xs">Rs. {formatNumber(rate)}</span>
              ),
            },
            {
              key: "salesRate",
              header: "Selling Base",
              align: "right",
              width: "13%",
              render: (rate) => (
                <span className="font-mono font-extrabold text-slate-800 text-xs">
                  Rs. {formatNumber(rate)}
                </span>
              ),
            },
            {
              key: "stock",
              header: "In Stock Count",
              align: "right",
              width: "17%",
              render: (_, row) => {
                const live = stockSummary.find((s) => s.itemId === row.id);
                const qty = live ? live.closingQty : 0;
                const isUnder = qty <= (row.reorderLevel || 10);
                return (
                  <div className="text-right flex flex-col font-mono text-xs">
                    <span className={`font-bold ${isUnder ? "text-red-500" : "text-slate-900"}`}>
                      {qty} {row.unit || "BOX"}
                    </span>
                    {isUnder && (
                      <span className="text-[10px] font-bold text-red-400 mt-1 leading-none flex items-center justify-end gap-0.5 select-none">
                        <AlertCircle className="h-3.5 w-3.5" /> REORDER LIMIT &le;{row.reorderLevel}
                      </span>
                    )}
                  </div>
                );
              },
            },
            {
              key: "actions",
              header: "Action",
              align: "center",
              width: "10%",
              render: (_, row) => (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditModal(row);
                    }}
                    title="Change item metadata details"
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
              ),
            },
          ]}
          data={filteredItems}
          rowKey="id"
          emptyMessage="No inventory items cataloged in this workspace ledger yet."
        />
      </Card>

      {/* POPUP FORM MODAL CONTAINER */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Edit Sku Item master" : "Catalog New Inventory Item"}
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveSubmit}>
              Save Stock Item
            </Button>
          </div>
        }
      >
        <form
          onSubmit={handleSaveSubmit}
          className="flex flex-col gap-4 text-xs font-semibold text-slate-755 select-none"
        >
          <div className="grid grid-cols-3 gap-4">
            <Input label="SKU Unique Code" value={code} onChange={setCode} required disabled />
            <Select
              label="Classification Catalog"
              options={[
                { value: ItemType.PRODUCT, label: "Tangible Goods (Products)" },
                { value: ItemType.SERVICE, label: "Intangible Billing (Services)" },
              ]}
              value={type}
              onChange={(val) => setType(val as ItemType)}
              required
            />
            <Select
              label="Packaging Unit"
              options={[
                { value: "PCS", label: "Pieces (PCS)" },
                { value: "BOX", label: "Carton Boxes (BOX)" },
                { value: "KG", label: "Kilograms (KG)" },
                { value: "LTR", label: "Liters (LTR)" },
              ]}
              value={unit}
              onChange={setUnit}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Item Particulars Description (EN)"
              placeholder="e.g. Acer Aspire 5 Laptop"
              value={name}
              onChange={setName}
              required
            />
            <Input
              label="Item Particulars Description (NP)"
              placeholder="जस्तै: एसर एस्पायर ५ ल्यापटप"
              value={nameNepali}
              onChange={setNameNepali}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-gray-200 pt-4">
            <Input
              label="Purchase Base Rate"
              type="number"
              value={purchaseRate}
              onChange={(v) => {
                const parsed = parseFloat(v);
                setPurchaseRate(isNaN(parsed) ? 0 : parsed);
              }}
              prefix="Rs."
              align="right"
            />
            <Input
              label="Sales Base Rate"
              type="number"
              value={salesRate}
              onChange={(v) => {
                const parsed = parseFloat(v);
                setSalesRate(isNaN(parsed) ? 0 : parsed);
              }}
              prefix="Rs."
              align="right"
            />
            <Input
              label="Maximum Retail Price (MRP)"
              type="number"
              value={mrp}
              onChange={(v) => {
                const parsed = parseFloat(v);
                setMrp(isNaN(parsed) ? 0 : parsed);
              }}
              prefix="Rs."
              align="right"
            />
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-gray-200 pt-4">
            <Input
              label="Opening Quantity Count"
              type="number"
              value={openingStock}
              onChange={(v) => {
                const parsed = parseFloat(v);
                setOpeningStock(isNaN(parsed) ? 0 : parsed);
              }}
              align="center"
              hint="Initial count physical stock"
            />
            <Input
              label="Valuation Cost Rate"
              type="number"
              value={openingRate}
              onChange={(v) => {
                const parsed = parseFloat(v);
                setOpeningRate(isNaN(parsed) ? 0 : parsed);
              }}
              prefix="Rs."
              align="right"
              hint="Rate of opening quantity"
            />
            <Input
              label="Reorder Safety Limit"
              type="number"
              value={reorderLevel}
              onChange={(v) => {
                const parsed = parseInt(v);
                setReorderLevel(isNaN(parsed) ? 0 : parsed);
              }}
              align="center"
              hint="Warn when stock drops below"
            />
          </div>

          <div className="border-t border-gray-200 pt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="taxableCheck"
              checked={isTaxable}
              onChange={(e) => setIsTaxable(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="taxableCheck" className="text-xs font-bold text-gray-700">
              Taxable (Eligible for standard 13% Nepalese VAT collection on sales & inputs)
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StockItems;
