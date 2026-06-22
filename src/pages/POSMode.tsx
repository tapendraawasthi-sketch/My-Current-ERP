import React, { useState, useMemo, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import {
  VoucherType,
  VoucherStatus,
  PaymentMode,
  PaymentStatus,
  ItemType,
  Item,
  PartyType,
} from "../lib/types";
import { formatNumber } from "../lib/utils";
import { ADToBSString } from "../lib/nepaliDate";
import toast from "react-hot-toast";
import {
  Search,
  ShoppingBag,
  Trash2,
  Printer,
  ArrowLeft,
  DollarSign,
  CreditCard,
  QrCode,
} from "lucide-react";

interface CartItem {
  item: Item;
  qty: number;
}

const POSMode: React.FC = () => {
  const { items, parties, companySettings, addInvoice, setCurrentPage } = useStore();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemFilter, setItemFilter] = useState<"all" | "product" | "service">("all");
  const [selectedPayment, setSelectedPayment] = useState<"cash" | "card" | "qr">("cash");
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [customerName, setCustomerName] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<any>(null);

  const scanBuffer = useRef<string>("");
  const lastKeyTime = useRef<number>(0);
  const [lastScannedCode, setLastScannedCode] = useState<string>("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      const now = Date.now();
      const gap = now - lastKeyTime.current;
      lastKeyTime.current = now;

      if (e.key === "Enter" && scanBuffer.current.length >= 4) {
        const code = scanBuffer.current;
        scanBuffer.current = "";
        setLastScannedCode(code);

        const found = items.find((i) => i.barcode === code) || items.find((i) => i.code === code);
        if (found) {
          addToCart(found);
          toast.success(`${found.name} added via scan`);
        } else {
          toast.error(`No item found: ${code}`);
        }
      } else if (e.key !== "Enter" && e.key.length === 1) {
        if (gap < 80) {
          scanBuffer.current += e.key;
        } else {
          scanBuffer.current = e.key;
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [items]);

  // Focus search input on load
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F10") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        if (cart.length > 0) {
          if (window.confirm("Clear cart?")) {
            setCart([]);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, selectedPayment, cashTendered, customerName]);

  // Catalog items filtering
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!item.isActive) return false;

      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        itemFilter === "all" ||
        (itemFilter === "product" && item.type === ItemType.PRODUCT) ||
        (itemFilter === "service" && item.type === ItemType.SERVICE);

      return matchesSearch && matchesType;
    });
  }, [items, searchQuery, itemFilter]);

  // Cart calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, c) => sum + c.qty * c.item.salesRate, 0);
  }, [cart]);

  const vatAmount = useMemo(() => {
    return cart.reduce((sum, c) => {
      if (c.item.isTaxable) {
        return sum + c.qty * c.item.salesRate * 0.13;
      }
      return sum;
    }, 0);
  }, [cart]);

  const grandTotal = useMemo(() => {
    return subtotal + vatAmount;
  }, [subtotal, vatAmount]);

  const changeDue = useMemo(() => {
    const change = cashTendered - grandTotal;
    return change > 0 ? change : 0;
  }, [cashTendered, grandTotal]);

  // Add item to cart
  const addToCart = (item: Item) => {
    if (
      item.currentStock !== undefined &&
      item.currentStock <= 0 &&
      item.type === ItemType.PRODUCT
    ) {
      toast.error("Item is out of stock");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) => (c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  // Update item quantity
  const updateQty = (itemId: string, qty: number) => {
    if (qty < 1) return;
    setCart((prev) => prev.map((c) => (c.item.id === itemId ? { ...c, qty } : c)));
  };

  // Remove item from cart
  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  };

  // Save POS sales invoice
  const handleSave = async () => {
    if (cart.length === 0) {
      toast.error("Add items to cart first");
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      const dateNepali = ADToBSString(today);

      // Find first active customer for fallback party ID
      const customerParty = parties.find((p) => p.isActive && p.type === PartyType.CUSTOMER);

      const invoiceLines = cart.map((c) => {
        const rate = c.item.salesRate;
        const lineSubtotal = c.qty * rate;
        const vatLine = c.item.isTaxable ? lineSubtotal * 0.13 : 0;
        return {
          itemId: c.item.id,
          itemName: c.item.name,
          itemCode: c.item.code,
          qty: c.qty,
          unit: c.item.unit || "PCS",
          rate: rate,
          discountPercent: 0,
          isTaxable: c.item.isTaxable,
          vatRate: c.item.isTaxable ? 13 : 0,
          netAmount: lineSubtotal,
          vatAmount: vatLine,
          totalAmount: lineSubtotal + vatLine,
        };
      });

      const payload = {
        type: VoucherType.SALES_INVOICE,
        date: today,
        dateNepali,
        partyId: customerParty?.id || "walk-in",
        partyName: customerName || "Walk-in Customer",
        partyPan: customerParty?.pan || "",
        paymentMode: selectedPayment === "cash" ? PaymentMode.CASH : PaymentMode.BANK_TRANSFER,
        paymentStatus: PaymentStatus.PAID,
        status: VoucherStatus.POSTED,
        paidAmount: grandTotal,
        subTotal: subtotal,
        taxableAmount: subtotal,
        exemptAmount: 0,
        vatAmount,
        discountAmount: 0,
        grandTotal,
        roundOff: 0,
        lines: invoiceLines,
        narration: `POS Sale - ${customerName || "Walk-in"}`,
      };

      const result = await addInvoice(payload as any);
      setSavedInvoice(result);
      setShowReceipt(true);

      // Reset cart and customer states
      setCart([]);
      setCustomerName("");
      setCashTendered(0);
      toast.success("POS Invoice saved successfully");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save POS invoice.");
    }
  };

  const symbol = companySettings?.currencySymbol || "Rs.";

  return (
    <div className="flex h-screen w-full bg-slate-900 overflow-hidden font-sans text-xs select-none">
      {/* Left Panel: Catalog */}
      <div className="w-[60%] flex flex-col h-full bg-slate-950">
        {/* Header bar */}
        <div className="bg-indigo-950 border-b border-indigo-900 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
              ⚡ POS MODE
            </span>
            <span className="text-[10px] bg-indigo-800 text-indigo-200 font-extrabold px-1.5 py-0.5 rounded uppercase">
              Live
            </span>
          </div>
          <button
            onClick={() => setCurrentPage("dashboard")}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold transition-all text-[11px]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Exit
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
              <Search className="h-4 w-4" />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search Items... (F2)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Scan barcode or search by name/code. Scanner auto-adds items.
            </p>
          </div>
          <div className="flex items-center bg-[#1a202c] p-1 rounded-lg border border-slate-800 gap-0.5 shrink-0 self-stretch sm:self-auto justify-center">
            {(["all", "product", "service"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setItemFilter(f)}
                className={`px-3 py-1 rounded-md font-bold transition-all uppercase text-[10px] ${
                  itemFilter === f
                    ? "bg-[#1557b0] text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {f}s
              </button>
            ))}
          </div>
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 content-start">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-10">
              <span className="text-sm font-semibold mb-1">No items found</span>
              <p className="text-slate-600">Try adjusting your search filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredItems.map((item) => {
                const isOutOfStock =
                  item.type === ItemType.PRODUCT && (item.currentStock ?? 0) <= 0;
                return (
                  <button
                    key={item.id}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(item)}
                    className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                      isOutOfStock
                        ? "bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed"
                        : "bg-[#1a202c] border-slate-800 hover:border-indigo-500 hover:bg-slate-800 hover:shadow-lg active:scale-[0.98]"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1 w-full">
                      <span className="font-extrabold text-slate-100 text-sm tracking-tight line-clamp-2 leading-tight">
                        {item.name}
                      </span>
                      {item.type === ItemType.PRODUCT && (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                            isOutOfStock
                              ? "bg-red-950 text-red-400 border border-red-900"
                              : "bg-indigo-950 text-indigo-300 border border-indigo-900"
                          }`}
                        >
                          {isOutOfStock ? "Out" : `${item.currentStock || 0} ${item.unit || "pcs"}`}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 font-mono">{item.code}</span>
                    <div className="mt-4 flex items-baseline justify-between w-full border-t border-slate-800/60 pt-2.5">
                      <span className="text-indigo-400 text-[10px] uppercase font-bold tracking-wider">
                        Sales Rate
                      </span>
                      <span className="text-indigo-300 font-extrabold text-sm font-mono">
                        {symbol} {formatNumber(item.salesRate)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Cart */}
      <div className="w-[40%] flex flex-col h-full bg-white text-slate-900 shadow-2xl relative">
        {/* Cart Header */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-150 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-[18px] w-[18px] text-[#1557b0]" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Cart List</h2>
          </div>
          <span className="bg-indigo-100 text-indigo-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full">
            {cart.reduce((sum, c) => sum + c.qty, 0)} items
          </span>
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
              <ShoppingBag className="h-10 w-10 text-slate-200 mb-2 stroke-[1.5]" />
              <p className="font-semibold text-xs">Cart is empty. Click items to add.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-100">
                <tr>
                  <th className="py-2 px-3 text-center">#</th>
                  <th className="py-2 px-2 text-left">Item</th>
                  <th className="py-2 px-2 text-center w-16">Qty</th>
                  <th className="py-2 px-2 text-right">Price</th>
                  <th className="py-2 px-2 text-right">Amt</th>
                  <th className="py-2 px-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.map((c, idx) => (
                  <tr key={c.item.id} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-2 px-2">
                      <p className="font-bold text-slate-800 leading-tight">{c.item.name}</p>
                      <span className="text-[10px] text-slate-400 font-mono">{c.item.code}</span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min="1"
                        value={c.qty}
                        onChange={(e) => updateQty(c.item.id, parseInt(e.target.value) || 1)}
                        className="w-12 text-center border border-slate-200 rounded p-1 font-bold text-slate-800"
                      />
                    </td>
                    <td className="py-2 px-2 text-right font-semibold text-slate-700 font-mono">
                      {formatNumber(c.item.salesRate)}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-slate-900 font-mono">
                      {formatNumber(c.qty * c.item.salesRate)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => removeFromCart(c.item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer controls & totals */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 shrink-0 flex flex-col gap-3">
          {/* Summary values */}
          <div className="flex flex-col gap-1.5 border-b border-slate-200/85 pb-3">
            <div className="flex justify-between items-center text-slate-500 font-semibold">
              <span>Subtotal</span>
              <span className="font-mono">
                {symbol} {formatNumber(subtotal)}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-500 font-semibold">
              <span>VAT (13% on Taxable Items)</span>
              <span className="font-mono">
                {symbol} {formatNumber(vatAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                Grand Total
              </span>
              <span className="text-lg font-bold text-indigo-700 font-mono">
                {symbol} {formatNumber(grandTotal)}
              </span>
            </div>
          </div>

          {/* Customer input */}
          <div className="grid grid-cols-1 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-500">
                Customer Name
              </label>
              <input
                type="text"
                placeholder="Walk-in Customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Payment options */}
            <div className="flex flex-col gap-1 mt-1">
              <label className="text-[10px] uppercase font-bold text-slate-500">Payment Mode</label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: "cash" as const, label: "Cash", icon: DollarSign },
                  { id: "card" as const, label: "Card", icon: CreditCard },
                  { id: "qr" as const, label: "QR Pay", icon: QrCode },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedPayment(id)}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                      selectedPayment === id
                        ? "bg-[#1557b0] text-white border-indigo-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-3 w-3" /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash tendered section */}
            {selectedPayment === "cash" && (
              <div className="grid grid-cols-2 gap-2 mt-1 bg-slate-100 p-2 rounded-lg border border-slate-150 items-center">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500">
                    Cash Received
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={cashTendered || ""}
                    onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-250 rounded p-1 text-xs font-bold text-slate-800 font-mono"
                  />
                </div>
                <div className="flex flex-col text-right justify-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Change Due</span>
                  <span className="text-xs font-bold text-emerald-600 font-mono">
                    {symbol} {formatNumber(changeDue)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action button */}
          <button
            onClick={handleSave}
            disabled={cart.length === 0}
            className={`w-full py-2.5 rounded-xl text-white font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-md text-xs uppercase tracking-wide ${
              cart.length === 0
                ? "bg-slate-300 cursor-not-allowed shadow-none"
                : "bg-emerald-600 hover:bg-emerald-500 hover:shadow-lg active:scale-[0.99]"
            }`}
          >
            <Printer className="h-4 w-4" /> Print & Save (F10)
          </button>
        </div>
      </div>

      {/* Receipt Modal Overlay */}
      {showReceipt && savedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 text-slate-900 border border-slate-100 animate-fadeIn text-[11px]">
            {/* Business info */}
            <div className="text-center border-b border-dashed border-slate-200 pb-4">
              <h1 className="text-sm font-bold uppercase text-slate-800">
                {companySettings?.name || "Sutra ERP Pvt. Ltd."}
              </h1>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {companySettings?.address || "Kathmandu, Nepal"}
              </p>
              <p className="text-[10px] text-slate-400">
                PAN/VAT: {companySettings?.panNumber || "—"}
              </p>
              <h2 className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 py-0.5 px-2 rounded mt-2.5 inline-block">
                TAX INVOICE
              </h2>
            </div>

            {/* Invoice meta */}
            <div className="grid grid-cols-2 gap-y-1.5 py-3 border-b border-dashed border-slate-200">
              <div>
                <p className="text-slate-400 font-medium">Invoice No:</p>
                <p className="font-extrabold text-slate-800">{savedInvoice.invoiceNo}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 font-medium">Date (AD/BS):</p>
                <p className="font-bold text-slate-800">
                  {savedInvoice.date} ({savedInvoice.dateNepali})
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-400 font-medium">Customer Name:</p>
                <p className="font-bold text-slate-800">{savedInvoice.partyName}</p>
              </div>
            </div>

            {/* Line items list */}
            <div className="py-3 border-b border-dashed border-slate-200">
              <table className="w-full">
                <thead>
                  <tr className="text-left font-bold text-slate-500 uppercase text-[10px] border-b border-slate-100">
                    <th className="pb-1 text-left">Item Name</th>
                    <th className="pb-1 text-center w-10">Qty</th>
                    <th className="pb-1 text-right">Rate</th>
                    <th className="pb-1 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {savedInvoice.lines?.map((line: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-50/50">
                      <td className="py-1.5 text-slate-800 font-medium leading-tight">
                        {line.itemName}
                      </td>
                      <td className="py-1.5 text-center font-semibold text-slate-600">
                        {line.qty}
                      </td>
                      <td className="py-1.5 text-right font-mono text-slate-600">
                        {formatNumber(line.rate)}
                      </td>
                      <td className="py-1.5 text-right font-mono font-bold text-slate-800">
                        {formatNumber(line.netAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="py-3 border-b border-dashed border-slate-200 flex flex-col gap-1.5 text-right font-mono">
              <div className="flex justify-between items-center text-slate-500">
                <span>Sub Total:</span>
                <span>
                  {symbol} {formatNumber(savedInvoice.subTotal)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>VAT (13%):</span>
                <span>
                  {symbol} {formatNumber(savedInvoice.vatAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-800 font-extrabold text-xs">
                <span>Grand Total:</span>
                <span>
                  {symbol} {formatNumber(savedInvoice.grandTotal)}
                </span>
              </div>
            </div>

            {/* Payment verification */}
            <div className="py-3 text-slate-600 flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span>Payment Mode:</span>
                <span className="font-extrabold uppercase text-slate-800">
                  {savedInvoice.paymentMode}
                </span>
              </div>
              {savedInvoice.paymentMode === PaymentMode.CASH && (
                <>
                  <div className="flex justify-between items-center">
                    <span>Cash Tendered:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {symbol} {formatNumber(cashTendered || savedInvoice.grandTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Change Returned:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {symbol} {formatNumber(changeDue)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Disclaimer & Actions */}
            <div className="text-center mt-3 border-t border-slate-200/80 pt-4 flex flex-col gap-2">
              <p className="text-[10px] italic text-slate-400">Thank you for your business!</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-1 bg-slate-800 text-white font-bold py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  onClick={() => {
                    setShowReceipt(false);
                    setSavedInvoice(null);
                    searchInputRef.current?.focus();
                  }}
                  className="bg-[#1557b0] text-white font-bold py-1.5 rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  New Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSMode;
