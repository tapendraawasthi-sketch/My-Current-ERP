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
  FolderOpen,
  Pause,
} from "lucide-react";

interface CartItem {
  item: Item;
  qty: number;
}

interface HeldCart {
  key: string;
  timestamp: number;
  customerName: string;
  cart: CartItem[];
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

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [scannedBarcode, setScannedBarcode] = useState("");
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [showResumeModal, setShowResumeModal] = useState(false);

  const symbol = companySettings?.currencySymbol || "Rs.";

  // Load held carts on mount
  useEffect(() => {
    loadHeldCarts();
  }, []);

  const loadHeldCarts = () => {
    const carts: HeldCart[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("pos_hold_")) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const data = JSON.parse(raw);
            carts.push({
              key,
              timestamp: parseInt(key.replace("pos_hold_", ""), 10),
              customerName: data.customerName || "Walk-in Customer",
              cart: data.cart || [],
            });
          }
        } catch (e) {
          console.error("Failed to parse held cart", e);
        }
      }
    }
    setHeldCarts(carts.sort((a, b) => b.timestamp - a.timestamp));
  };

  // Focus barcode scanner input on page load and keep focus
  useEffect(() => {
    barcodeInputRef.current?.focus();

    const handleFocusBack = () => {
      // Avoid stealing focus if we are actively editing inputs
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag !== "input" && activeTag !== "textarea") {
        barcodeInputRef.current?.focus();
      }
    };

    document.addEventListener("click", handleFocusBack);
    return () => document.removeEventListener("click", handleFocusBack);
  }, []);

  // Handle scanned value
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedBarcode.trim()) return;

    const value = scannedBarcode.trim();
    setScannedBarcode("");

    const found = items.find((item) => item.barcode === value || item.code === value);

    if (found) {
      addToCart(found);
      toast.success(`${found.name} added to cart`);
    } else {
      toast.error(`Item not found: ${value}`);
    }
  };

  // Quick product grid - Favorite items or fallback to first 12 products
  const quickItems = useMemo(() => {
    const favorites = items.filter((item) => item.isActive && (item as any).isFavorite);
    if (favorites.length > 0) {
      return favorites.slice(0, 12);
    }
    // Fallback to first 12 active products
    return items.filter((item) => item.isActive && item.type === ItemType.PRODUCT).slice(0, 12);
  }, [items]);

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
    return Math.round((subtotal + vatAmount) * 100) / 100;
  }, [subtotal, vatAmount]);

  const changeDue = useMemo(() => {
    const change = cashTendered - grandTotal;
    return change > 0 ? Math.round(change * 100) / 100 : 0;
  }, [cashTendered, grandTotal]);

  // Disable save if cash tendered is less than grand total in cash mode
  const canCompleteSale = useMemo(() => {
    if (cart.length === 0) return false;
    if (selectedPayment === "cash") {
      return cashTendered >= grandTotal;
    }
    return true;
  }, [cart, selectedPayment, cashTendered, grandTotal]);

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

  // Hold current cart
  const handleHoldCart = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    const key = `pos_hold_${Date.now()}`;
    const payload = {
      customerName: customerName || "Walk-in Customer",
      cart,
    };
    localStorage.setItem(key, JSON.stringify(payload));
    toast.success("Cart held successfully");
    setCart([]);
    setCustomerName("");
    setCashTendered(0);
    loadHeldCarts();
  };

  // Resume held cart
  const handleResumeCart = (held: HeldCart) => {
    setCart(held.cart);
    setCustomerName(held.customerName);
    localStorage.removeItem(held.key);
    loadHeldCarts();
    setShowResumeModal(false);
    toast.success("Cart resumed");
  };

  // Save POS sales invoice
  const handleSave = async () => {
    if (!canCompleteSale) {
      toast.error("Insufficient Cash Tendered.");
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      const dateNepali = ADToBSString(today);

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

  return (
    <div className="flex h-screen w-full bg-slate-900 overflow-hidden font-sans text-xs select-none">
      {/* Hidden input to capture barcode scanner input */}
      <form onSubmit={handleBarcodeSubmit} className="absolute opacity-0 pointer-events-none">
        <input
          ref={barcodeInputRef}
          type="text"
          value={scannedBarcode}
          onChange={(e) => setScannedBarcode(e.target.value)}
          autoFocus
        />
      </form>

      {/* Left Panel: Catalog & Quick Favorites */}
      <div className="w-[60%] flex flex-col h-full bg-slate-950">
        {/* Header bar */}
        <div className="bg-indigo-950 border-b border-indigo-900 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
              ⚡ POS MODE
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResumeModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold transition-all text-[11px]"
            >
              <FolderOpen className="h-3.5 w-3.5 text-amber-500" /> Resume ({heldCarts.length})
            </button>
            <button
              onClick={() => setCurrentPage("dashboard")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold transition-all text-[11px]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Exit
            </button>
          </div>
        </div>

        {/* Quick Product Grid (Favorites) */}
        <div className="p-3 bg-slate-900 border-b border-slate-850">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Quick Favorites Grid
          </span>
          <div className="grid grid-cols-4 gap-2">
            {quickItems.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="bg-[#1a202c] border border-slate-800 p-2 rounded-lg text-left hover:border-indigo-500 hover:bg-slate-800 transition-colors"
              >
                <div className="font-bold text-slate-100 truncate text-[11px]">{item.name}</div>
                <div className="flex justify-between items-center mt-1 text-[10px]">
                  <span className="text-indigo-300 font-mono">
                    {symbol} {formatNumber(item.salesRate)}
                  </span>
                  <span className="text-slate-400 font-bold">Qty: {item.currentStock || 0}</span>
                </div>
              </button>
            ))}
          </div>
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
              placeholder="Search Items... (Type here or Scan)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
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

        {/* Catalog List */}
        <div className="flex-1 overflow-y-auto p-4 content-start">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredItems.map((item) => {
              const isOutOfStock = item.type === ItemType.PRODUCT && (item.currentStock ?? 0) <= 0;
              return (
                <button
                  key={item.id}
                  disabled={isOutOfStock}
                  onClick={() => addToCart(item)}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                    isOutOfStock
                      ? "bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed"
                      : "bg-[#1a202c] border-slate-800 hover:border-indigo-500 hover:bg-slate-800 transition-all hover:shadow-lg"
                  }`}
                >
                  <div className="flex justify-between items-start gap-1 w-full">
                    <span className="font-extrabold text-slate-100 text-[11px] leading-tight truncate max-w-[120px]">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.code}</span>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between w-full border-t border-slate-800 pt-2">
                    <span className="text-indigo-400 text-[10px] font-bold">
                      {symbol} {formatNumber(item.salesRate)}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      Stock: {item.currentStock || 0}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Panel: Cart & Payment details */}
      <div className="w-[40%] flex flex-col h-full bg-white text-slate-900 shadow-2xl relative">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-150 flex items-center justify-between shrink-0 font-bold uppercase">
          <span>Cart List</span>
          <button
            onClick={handleHoldCart}
            disabled={cart.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100"
          >
            <Pause className="w-3 h-3" /> Hold Cart
          </button>
        </div>

        {/* Cart rows */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
              <p className="font-semibold text-xs">Cart is empty.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-wider sticky top-0 border-b">
                <tr>
                  <th className="py-2 px-3 text-left">Item</th>
                  <th className="py-2 px-2 text-center w-16">Qty</th>
                  <th className="py-2 px-2 text-right">Amt</th>
                  <th className="py-2 px-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {cart.map((c) => (
                  <tr key={c.item.id} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-semibold text-gray-800">{c.item.name}</td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min="1"
                        value={c.qty}
                        onChange={(e) => updateQty(c.item.id, parseInt(e.target.value) || 1)}
                        className="w-12 text-center border rounded p-1 font-bold text-slate-800"
                      />
                    </td>
                    <td className="py-2 px-2 text-right font-bold font-mono">
                      {formatNumber(c.qty * c.item.salesRate)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button onClick={() => removeFromCart(c.item.id)} className="text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Totals & Tendered inputs */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 shrink-0 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
              Grand Total
            </span>
            <span className="text-lg font-bold text-indigo-700 font-mono">
              {symbol} {formatNumber(grandTotal)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 border-t pt-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-500">
                Customer Name
              </label>
              <input
                type="text"
                placeholder="Walk-in Customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-850"
              />
            </div>

            <div className="flex flex-col gap-1">
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
                    className={`flex items-center justify-center gap-1 py-1.5 rounded border text-[10px] font-bold ${
                      selectedPayment === id
                        ? "bg-[#1557b0] text-white border-indigo-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    <Icon className="h-3 w-3" /> {label}
                  </button>
                ))}
              </div>
            </div>

            {selectedPayment === "cash" && (
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-3 rounded-lg border border-slate-200">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500">
                    Cash Tendered
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={cashTendered || ""}
                    onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                    className="w-full border rounded p-1 text-xs font-bold font-mono text-slate-800"
                  />
                </div>
                <div className="flex flex-col text-right justify-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Change Due</span>
                  <span className="text-sm font-bold text-emerald-600 font-mono">
                    {symbol} {formatNumber(changeDue)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!canCompleteSale}
            className={`w-full py-2.5 rounded-lg text-white font-extrabold flex items-center justify-center gap-1.5 uppercase ${
              !canCompleteSale
                ? "bg-slate-350 cursor-not-allowed shadow-none"
                : "bg-emerald-600 hover:bg-emerald-500 hover:shadow-lg cursor-pointer"
            }`}
          >
            <Printer className="h-4 w-4" /> Print & Save
          </button>
        </div>
      </div>

      {/* Resume Held Carts Modal */}
      {showResumeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 text-slate-900 border">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-sm font-bold uppercase">Resume Held Carts</h2>
              <button
                onClick={() => setShowResumeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {heldCarts.length === 0 ? (
                <p className="text-center py-6 text-gray-400">No held carts available.</p>
              ) : (
                heldCarts.map((held) => (
                  <div
                    key={held.key}
                    onClick={() => handleResumeCart(held)}
                    className="p-3 bg-slate-50 border rounded-lg hover:bg-slate-100 cursor-pointer flex justify-between items-center transition-colors"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{held.customerName}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(held.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded text-[10px]">
                      {held.cart.length} lines
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal Overlay */}
      {showReceipt && savedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 text-slate-900 border border-slate-100 animate-fadeIn text-[11px]">
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

            <div className="py-3 border-b border-dashed border-slate-200">
              <table className="w-full">
                <thead>
                  <tr className="text-left font-bold text-slate-500 uppercase text-[10px] border-b border-slate-100">
                    <th className="pb-1 text-left">Item Name</th>
                    <th className="pb-1 text-center w-10">Qty</th>
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
                      <td className="py-1.5 text-right font-mono font-bold text-slate-800">
                        {formatNumber(line.netAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="py-3 border-b border-dashed border-slate-200 flex flex-col gap-1.5 text-right font-mono">
              <div className="flex justify-between items-center text-slate-500">
                <span>Sub Total:</span>
                <span>
                  {symbol} {formatNumber(savedInvoice.subTotal)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-850 font-extrabold text-xs">
                <span>Grand Total:</span>
                <span>
                  {symbol} {formatNumber(savedInvoice.grandTotal)}
                </span>
              </div>
            </div>

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
