import React, { useEffect, useMemo, useState } from "react";
import { Button, Input, Select, AmountInput, AccountSelect } from "../ui";
import { useStore } from "@/store/useStore";
import { ItemType, AccountType, type Item } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface ItemFormProps {
  item?: Item;
  onSave: (item: Item) => void;
  onCancel: () => void;
}

const TABS = [
  { id: "basic", label: "Basic" },
  { id: "pricing", label: "Pricing" },
  { id: "units", label: "Units" },
  { id: "stock", label: "Stock Settings" },
  { id: "accounts", label: "Accounts" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const nextItemCode = (items: Item[]) => {
  const nums = items
    .map((i) => /^ITEM-(\d+)$/i.exec(i.code || "")?.[1])
    .filter(Boolean)
    .map((n) => parseInt(n as string, 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `ITEM-${String(next).padStart(3, "0")}`;
};

const ItemForm: React.FC<ItemFormProps> = ({ item, onSave, onCancel }) => {
  const { items, units, warehouses, accounts } = useStore();

  const defaultPurchaseAcc = useMemo(
    () =>
      accounts.find((a) => /purchase/i.test(a.name) && a.type === AccountType.EXPENSE)?.id ?? "",
    [accounts],
  );
  const defaultSalesAcc = useMemo(
    () => accounts.find((a) => /sales/i.test(a.name) && a.type === AccountType.INCOME)?.id ?? "",
    [accounts],
  );
  const defaultStockAcc = useMemo(
    () => accounts.find((a) => /stock|inventory/i.test(a.name))?.id ?? "",
    [accounts],
  );
  const defaultWarehouse = useMemo(
    () => warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? "",
    [warehouses],
  );

  const [tab, setTab] = useState<TabId>("basic");

  // Basic
  const [code, setCode] = useState(item?.code ?? nextItemCode(items));
  const [name, setName] = useState(item?.name ?? "");
  const [nameNepali, setNameNepali] = useState(item?.nameNepali ?? "");
  const [type, setType] = useState<ItemType>(item?.type ?? ItemType.PRODUCT);
  const [hsnCode, setHsnCode] = useState(item?.hsnCode ?? "");
  const [barcode, setBarcode] = useState(item?.barcode ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [category, setCategory] = useState((item as any)?.category ?? "");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);

  // Pricing
  const [purchaseRate, setPurchaseRate] = useState<number>(item?.purchaseRate ?? 0);
  const [salesRate, setSalesRate] = useState<number>(item?.salesRate ?? 0);
  const [mrp, setMrp] = useState<number>(item?.mrp ?? 0);
  const [isTaxable, setIsTaxable] = useState<boolean>(item?.isTaxable ?? true);
  const [vatRate, setVatRate] = useState<number>(item?.vatRate ?? 13);

  // Units
  const [unit, setUnit] = useState(item?.unit ?? units[0]?.code ?? "PCS");
  const [alternateUnit, setAlternateUnit] = useState(item?.alternateUnit ?? "");
  const [conversionFactor, setConversionFactor] = useState<number>(item?.conversionFactor ?? 1);

  // Stock
  const [warehouseId, setWarehouseId] = useState((item as any)?.warehouseId ?? defaultWarehouse);
  const [minimumStock, setMinimumStock] = useState<number>(item?.minimumStock ?? 0);
  const [maximumStock, setMaximumStock] = useState<number>(item?.maximumStock ?? 0);
  const [reorderLevel, setReorderLevel] = useState<number>(item?.reorderLevel ?? 10);
  const [openingStock, setOpeningStock] = useState<number>(item?.openingStock ?? 0);
  const [openingStockRate, setOpeningStockRate] = useState<number>(item?.openingStockRate ?? 0);

  // Accounts
  const [purchaseAccountId, setPurchaseAccountId] = useState(
    item?.purchaseAccountId ?? defaultPurchaseAcc,
  );
  const [salesAccountId, setSalesAccountId] = useState(item?.salesAccountId ?? defaultSalesAcc);
  const [stockAccountId, setStockAccountId] = useState(item?.stockAccountId ?? defaultStockAcc);

  // Sync defaults if accounts loaded after mount
  useEffect(() => {
    if (!purchaseAccountId && defaultPurchaseAcc) setPurchaseAccountId(defaultPurchaseAcc);
    if (!salesAccountId && defaultSalesAcc) setSalesAccountId(defaultSalesAcc);
    if (!stockAccountId && defaultStockAcc) setStockAccountId(defaultStockAcc);
    if (!warehouseId && defaultWarehouse) setWarehouseId(defaultWarehouse);
  }, [defaultPurchaseAcc, defaultSalesAcc, defaultStockAcc, defaultWarehouse]);

  const openingValue = openingStock * openingStockRate;

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = "Code required";
    if (!name.trim()) e.name = "Name required";
    if (purchaseRate < 0) e.purchaseRate = "Must be >= 0";
    if (salesRate < 0) e.salesRate = "Must be >= 0";
    if (mrp < 0) e.mrp = "Must be >= 0";
    if (isTaxable && (vatRate < 0 || vatRate > 100)) e.vatRate = "0-100";
    if (type === ItemType.PRODUCT && conversionFactor <= 0) e.conversionFactor = "Must be > 0";
    setErrors(e);
    if (Object.keys(e).length) {
      // jump to first failing tab
      if (e.code || e.name) setTab("basic");
      else if (e.purchaseRate || e.salesRate || e.mrp || e.vatRate) setTab("pricing");
      else if (e.conversionFactor) setTab("units");
    }
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const payload: Item = {
      id: item?.id ?? "",
      code: code.trim(),
      name: name.trim(),
      nameNepali: nameNepali.trim() || undefined,
      type,
      hsnCode: hsnCode.trim() || undefined,
      barcode: barcode.trim() || undefined,
      description: description.trim() || undefined,
      unit,
      alternateUnit: alternateUnit || undefined,
      conversionFactor,
      purchaseRate,
      salesRate,
      mrp: mrp || undefined,
      isTaxable,
      vatRate: isTaxable ? vatRate : undefined,
      minimumStock: type === ItemType.PRODUCT ? minimumStock : undefined,
      maximumStock: type === ItemType.PRODUCT ? maximumStock : undefined,
      reorderLevel: type === ItemType.PRODUCT ? reorderLevel : undefined,
      openingStock: type === ItemType.PRODUCT ? openingStock : undefined,
      openingStockRate: type === ItemType.PRODUCT ? openingStockRate : undefined,
      purchaseAccountId: purchaseAccountId || undefined,
      salesAccountId: salesAccountId || undefined,
      stockAccountId: type === ItemType.PRODUCT ? stockAccountId || undefined : undefined,
      isActive,
      ...(category ? { category } : {}),
    } as Item;
    onSave(payload);
  };

  const unitOptions = units.length
    ? units.map((u) => ({ value: u.code, label: `${u.code} — ${u.name}` }))
    : [
        { value: "PCS", label: "PCS — Pieces" },
        { value: "BOX", label: "BOX — Box" },
        { value: "KG", label: "KG — Kilogram" },
      ];

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }));

  const isEdit = !!item;

  return (
    <div className="flex flex-col h-full bg-white text-xs text-gray-700">
      {/* Form Header */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0 select-none">
        <h3 className="text-[13px] font-semibold text-gray-800">
          {isEdit ? "Edit Item" : "New Item"}
        </h3>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6"
      >
        {/* Section 1: Item Details */}
        <div>
          <div className="section-header text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Item Details
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Item Code"
              value={code}
              onChange={setCode}
              required
              disabled={isEdit}
              error={errors.code}
            />
            <Select
              label="Item Type"
              value={type}
              onChange={(v) => setType(v as ItemType)}
              options={[
                { value: ItemType.PRODUCT, label: "Product" },
                { value: ItemType.SERVICE, label: "Service" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <Input
              label="Item Name (English)"
              value={name}
              onChange={setName}
              required
              error={errors.name}
            />
            <Input label="Item Name (Nepali)" value={nameNepali} onChange={setNameNepali} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <Input label="HSN / SAC Code" value={hsnCode} onChange={setHsnCode} />
            <Input
              label="Barcode"
              value={barcode}
              onChange={setBarcode}
              placeholder="Scan or type barcode"
            />
            <Input label="Category / Group" value={category} onChange={setCategory} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <div className="flex items-center gap-1.5 h-8 mt-4">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-[11px] font-medium text-gray-600">Is Active</span>
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-[12px] text-gray-900 focus:border-[#1557b0] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Unit & Pricing */}
        <div>
          <div className="section-header text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3 border-t pt-4">
            Unit & Pricing
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Primary Unit"
              value={unit}
              onChange={setUnit}
              options={unitOptions}
              required
            />
            <Select
              label="Alternate Unit"
              value={alternateUnit}
              onChange={setAlternateUnit}
              options={[{ value: "", label: "— None —" }, ...unitOptions]}
            />
            <Input
              label={`Conversion Factor (1 ${unit} = ?)`}
              type="number"
              value={conversionFactor}
              onChange={(v) => setConversionFactor(parseFloat(v) || 0)}
              error={errors.conversionFactor}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <AmountInput
              label="Purchase Rate"
              value={purchaseRate}
              onChange={setPurchaseRate}
              error={errors.purchaseRate}
            />
            <AmountInput
              label="Sales Rate"
              value={salesRate}
              onChange={setSalesRate}
              error={errors.salesRate}
            />
            <AmountInput label="MRP" value={mrp} onChange={setMrp} error={errors.mrp} />
          </div>
        </div>

        {/* Section 3: Tax & Stock */}
        <div>
          <div className="section-header text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3 border-t pt-4">
            Tax & Stock
          </div>

          <div className="mt-2 bg-slate-50 p-4 border rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="block text-[11px] font-medium text-gray-600 mb-0.5">
                  Is Taxable (VAT)
                </span>
                <span className="text-[11px] text-gray-400">
                  Enabling this applies VAT on sales and purchases.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsTaxable(!isTaxable)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                  ${isTaxable ? "bg-[#1557b0]" : "bg-gray-200"}
                `}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                    ${isTaxable ? "translate-x-5" : "translate-x-0"}
                  `}
                />
              </button>
            </div>

            {isTaxable && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-3 bg-white border rounded-md animate-fadeIn">
                <Input
                  label="VAT Rate (%)"
                  type="number"
                  value={vatRate}
                  onChange={(v) => setVatRate(parseFloat(v) || 0)}
                  suffix="%"
                  error={errors.vatRate}
                />
              </div>
            )}
          </div>

          {type === ItemType.PRODUCT && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <Select
                label="Default Warehouse"
                value={warehouseId}
                onChange={setWarehouseId}
                options={warehouseOptions}
                placeholder="Select warehouse"
              />
              <Input
                label="Reorder Level"
                type="number"
                value={reorderLevel}
                onChange={(v) => setReorderLevel(parseFloat(v) || 0)}
              />
              <Input
                label="Minimum Stock Level"
                type="number"
                value={minimumStock}
                onChange={(v) => setMinimumStock(parseFloat(v) || 0)}
              />
            </div>
          )}

          {type === ItemType.PRODUCT && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <Input
                label="Opening Stock Quantity"
                type="number"
                value={openingStock}
                onChange={(v) => setOpeningStock(parseFloat(v) || 0)}
                disabled={isEdit}
              />
              <AmountInput
                label="Opening Stock Rate"
                value={openingStockRate}
                onChange={setOpeningStockRate}
                disabled={isEdit}
              />
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                  Opening Stock Value
                </label>
                <div className="h-8 rounded-md border border-gray-200 bg-gray-50 px-3 flex items-center text-[12px] font-mono text-gray-700">
                  {formatNumber(openingValue)}
                </div>
              </div>
            </div>
          )}

          {/* Accounts Integration */}
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-slate-50">
            <label className="block text-[11px] font-medium text-gray-600 mb-2">
              Ledger Accounts Integration
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AccountSelect
                label="Purchase Account"
                value={purchaseAccountId}
                onChange={setPurchaseAccountId}
                filterType={AccountType.EXPENSE}
              />
              <AccountSelect
                label="Sales Account"
                value={salesAccountId}
                onChange={setSalesAccountId}
                filterType={AccountType.INCOME}
              />
              {type === ItemType.PRODUCT && (
                <AccountSelect
                  label="Stock Account"
                  value={stockAccountId}
                  onChange={setStockAccountId}
                  filterType={AccountType.ASSET}
                />
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Form Footer */}
      <div className="border-t border-gray-200 p-4 flex justify-end gap-2 shrink-0 select-none bg-gray-50">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          {isEdit ? "Update Item" : "Create Item"}
        </Button>
      </div>
    </div>
  );
};

export default ItemForm;
