// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import {
  VoucherType,
  VoucherStatus,
  PaymentMode,
  PaymentStatus,
  Item,
  Invoice,
  InvoiceLine,
} from "../lib/types";
import { formatNumber } from "../lib/utils";
import { ADToBSString } from "../lib/nepaliDate";
import toast from "react-hot-toast";
import {
  ShoppingBag,
  Search,
  Trash2,
  Printer,
  ArrowLeft,
  DollarSign,
  CreditCard,
  QrCode,
  Pause,
  PlayCircle,
} from "lucide-react";
import QRCode from "qrcode";
import { generateId } from "../lib/db";

interface CartItem {
  item: Item;
  qty: number;
}

export default function POSMode() {
  const { items, companySettings, addInvoice, setCurrentPage } = useStore();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemGroupFilter, setItemGroupFilter] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<"cash" | "card" | "qr">("cash");
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [customerName, setCustomerName] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [showHeldBills, setShowHeldBills] = useState(false);
  const [heldBills, setHeldBills] = useState<
    { id: string; name: string; date: string; cart: CartItem[] }[]
  >([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Autofocus search on load
    searchInputRef.current?.focus();

    // Load held bills
    const saved = localStorage.getItem("pos_held_bills");
    if (saved) {
      try {
        setHeldBills(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveHeldBills = (bills: any[]) => {
    setHeldBills(bills);
    localStorage.setItem("pos_held_bills", JSON.stringify(bills));
  };

  // Groups
  const groups = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.groupName && s.add(i.groupName));
    return ["all", ...Array.from(s)];
  }, [items]);

  // Filtering
  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      const matchSearch =
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.barcode && i.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (i.code && i.code.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchGroup = itemGroupFilter === "all" || i.groupName === itemGroupFilter;
      return matchSearch && matchGroup;
    });
  }, [items, searchQuery, itemGroupFilter]);

  // Cart Totals
  const subTotal = cart.reduce((acc, c) => acc + c.item.salesRate * c.qty, 0);
  const discountTotal = 0; // Configurable if needed
  const taxableAmount = subTotal - discountTotal;
  const vatAmount = taxableAmount * 0.13;
  const grandTotal = Math.round(taxableAmount + vatAmount);

  // QR Generate
  useEffect(() => {
    if (selectedPayment === "qr" && grandTotal > 0) {
      // In reality, this would be an eSewa/FonePay formatted string
      const qrString = `merchantId=SUTRA_ERP&amount=${grandTotal}&invoiceId=POS_NEW`;
      QRCode.toDataURL(qrString, { width: 150, margin: 1 })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error(err));
    } else {
      setQrDataUrl(null);
    }
  }, [selectedPayment, grandTotal]);

  const addToCart = (item: Item) => {
    if (item.currentStock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((p) => p.item.id === item.id);
      if (existing) {
        return prev.map((p) => (p.item.id === item.id ? { ...p, qty: p.qty + 1 } : p));
      }
      return [{ item, qty: 1 }, ...prev];
    });
  };

  const updateQty = (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    setCart((prev) => prev.map((p) => (p.item.id === itemId ? { ...p, qty: newQty } : p)));
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((p) => p.item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName("");
    setCashTendered(0);
    setSelectedPayment("cash");
    searchInputRef.current?.focus();
  };

  const handleHoldBill = () => {
    if (cart.length === 0) return;
    const holdName = customerName || `Walk-in ${new Date().toLocaleTimeString()}`;
    const newBill = {
      id: generateId("hold"),
      name: holdName,
      date: new Date().toISOString(),
      cart,
    };
    saveHeldBills([...heldBills, newBill]);
    toast.success("Bill held successfully");
    clearCart();
  };

  const handleRecallBill = (id: string) => {
    const bill = heldBills.find((b) => b.id === id);
    if (bill) {
      setCart(bill.cart);
      setCustomerName(bill.name.startsWith("Walk-in") ? "" : bill.name);
      saveHeldBills(heldBills.filter((b) => b.id !== id));
      setShowHeldBills(false);
      toast.success("Bill recalled");
    }
  };

  const handlePrintAndNew = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (selectedPayment === "cash" && cashTendered < grandTotal) {
      toast.error(`Cash received is short by Rs. ${formatNumber(grandTotal - cashTendered)}`);
      return;
    }

    const todayAD = new Date().toISOString().split("T")[0];
    const todayBS = ADToBSString(todayAD);
    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;

    // Build the invoice object
    const lines: InvoiceLine[] = cart.map((c) => ({
      id: generateId("line"),
      itemId: c.item.id,
      itemName: c.item.name,
      qty: c.qty,
      unit: c.item.unit,
      rate: c.item.salesRate,
      netAmount: c.item.salesRate * c.qty,
      discount: 0,
      taxableAmount: c.item.salesRate * c.qty,
      taxAmount: c.item.salesRate * c.qty * 0.13,
      warehouseId: "main",
    }));

    const invoice: Invoice = {
      id: generateId("inv"),
      invoiceNo,
      type: VoucherType.SALES_INVOICE,
      partyId: "",
      partyName: customerName || "Walk-in Customer",
      date: todayAD,
      dateNepali: todayBS,
      subTotal,
      discountAmount: discountTotal,
      taxableAmount,
      exemptAmount: 0,
      vatAmount,
      taxAmount: vatAmount,
      grandTotal,
      lines,
      paymentMode:
        selectedPayment === "cash"
          ? PaymentMode.CASH
          : selectedPayment === "card"
            ? PaymentMode.CARD
            : PaymentMode.BANK_TRANSFER,
      paymentStatus: PaymentStatus.PAID,
      paidAmount: grandTotal,
      narration: `POS Sale - ${selectedPayment}`,
      status: VoucherStatus.POSTED,
    };

    // Print Receipt
    window.print();

    // Save to DB
    try {
      await addInvoice(invoice);
      toast.success("Invoice generated successfully!");
      clearCart();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save invoice");
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        e.stopPropagation();
        handlePrintAndNew();
      } else if (e.key === "Escape") {
        e.stopPropagation();
        clearCart();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [cart, customerName, selectedPayment, grandTotal]);

  const dateNow = new Date().toLocaleDateString();
  const tempInvoiceNo = `POS-${Date.now().toString().slice(-6)}`;

  return (
    <div className="h-screen flex flex-col bg-[#EBF5E2] overflow-hidden text-[#000000]">
      {/* App Header (No Print) */}
      <div className="no-print h-14 bg-[#1e2433] text-white flex items-center justify-between px-4 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage("dashboard")}
            className="p-1.5 rounded-md hover:bg-white/10 text-white hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="font-bold text-[16px] tracking-wide">POS TERMINAL</div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowHeldBills(true)}
            className="flex items-center gap-1.5 text-[12px] bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded font-medium"
          >
            <PlayCircle className="w-4 h-4" /> RECALL BILL ({heldBills.length})
          </button>
          <div className="text-[12px] text-white/90 font-medium">
            {companySettings?.companyNameEn || "Sutra ERP"} | {dateNow}
          </div>
        </div>
      </div>

      {/* Main Layout (No Print) */}
      <div className="no-print flex-1 flex flex-row overflow-hidden">
        {/* LEFT PANEL (Items) */}
        <div className="w-[55%] flex flex-col border-r border-[#9DC07A] bg-[#EBF5E2]">
          {/* Search Bar */}
          <div className="p-3 bg-white border-b border-[#9DC07A] shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#000000]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search items by name, code, or scan barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-10 pr-4 text-[15px] border-2 border-[#1557b0]/20 rounded-lg focus:outline-none focus:border-[#1557b0] focus:ring-4 focus:ring-[#1557b0]/10 transition-all bg-[#EBF5E2] focus:bg-white"
              />
            </div>

            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto mt-3 pb-1 no-scrollbar">
              {groups.map((g) => (
                <button
                  key={g}
                  onClick={() => setItemGroupFilter(g)}
                  className={`px-4 py-1.5 rounded-full text-[12px] font-semibold uppercase tracking-wide whitespace-nowrap transition-colors ${itemGroupFilter === g ? "bg-[#3D6B25] text-white shadow-sm" : "bg-white border border-[#9DC07A] text-[#000000] hover:bg-[#EBF5E2]"}`}
                >
                  {g === "all" ? "All Items" : g}
                </button>
              ))}
            </div>
          </div>

          {/* Item Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredItems.map((item) => {
                const outOfStock = item.currentStock <= 0;
                return (
                  <div
                    key={item.id}
                    onClick={() => !outOfStock && addToCart(item)}
                    className={`relative bg-white border rounded-lg p-3 cursor-pointer shadow-sm transition-all flex flex-col h-28 ${outOfStock ? "opacity-50 border-[#9DC07A] bg-[#EBF5E2] cursor-not-allowed" : "border-[#9DC07A] hover:border-[#1557b0] hover:shadow-md active:scale-95"}`}
                  >
                    <div className="text-[13px] font-semibold text-[#000000] leading-tight line-clamp-2">
                      {item.name}
                    </div>
                    {item.barcode && (
                      <div className="text-[10px] text-[#000000] mt-1">{item.barcode}</div>
                    )}

                    <div className="mt-auto flex items-end justify-between">
                      <div className="text-[16px] font-bold text-[#1557b0]">
                        Rs. {formatNumber(item.salesRate)}
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${outOfStock ? "text-red-500" : "text-green-600"}`}
                      >
                        Stock: {item.currentStock}
                      </div>
                    </div>
                    {outOfStock && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-red-200 -rotate-12">
                          OUT OF STOCK
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {filteredItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-[#000000]">
                <Search className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-[14px]">No items found matching your search.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL (Cart & Payment) */}
        <div className="w-[45%] flex flex-col bg-white">
          {/* Cart Header */}
          <div className="p-3 bg-[#EBF5E2] border-b border-[#9DC07A] flex items-center gap-3 shrink-0">
            <input
              type="text"
              placeholder="Customer Name (Optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="flex-1 h-9 px-3 text-[13px] border border-[#9DC07A] rounded focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0]"
            />
            <div className="px-3 py-1.5 bg-white border border-[#9DC07A] rounded text-[12px] font-mono font-bold text-[#000000]">
              {tempInvoiceNo}
            </div>
          </div>

          {/* Cart Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-[#EBF5E2] border-b border-[#9DC07A] z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-[#000000] uppercase tracking-wide">
                    Item
                  </th>
                  <th className="px-3 py-2 text-center text-[11px] font-semibold text-[#000000] uppercase tracking-wide w-28">
                    Qty
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#000000] uppercase tracking-wide">
                    Rate
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#000000] uppercase tracking-wide w-24">
                    Amount
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((c) => (
                  <tr key={c.item.id} className="border-b border-[#9DC07A] hover:bg-[#EBF5E2]">
                    <td className="px-3 py-2">
                      <div className="text-[12px] font-medium text-[#000000]">{c.item.name}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center border border-[#9DC07A] rounded overflow-hidden">
                        <button
                          onClick={() => updateQty(c.item.id, c.qty - 1)}
                          className="w-7 h-7 bg-[#EBF5E2] hover:bg-[#EBF5E2] text-[#000000] font-bold flex items-center justify-center border-r border-[#9DC07A]"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={c.qty}
                          onChange={(e) => updateQty(c.item.id, Number(e.target.value))}
                          className="w-10 h-7 text-center text-[12px] font-semibold focus:outline-none appearance-none"
                        />
                        <button
                          onClick={() => updateQty(c.item.id, c.qty + 1)}
                          className="w-7 h-7 bg-[#EBF5E2] hover:bg-[#EBF5E2] text-[#000000] font-bold flex items-center justify-center border-l border-[#9DC07A]"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] font-mono text-[#000000]">
                      {formatNumber(c.item.salesRate)}
                    </td>
                    <td className="px-3 py-2 text-right text-[13px] font-mono font-bold text-[#000000]">
                      {formatNumber(c.item.salesRate * c.qty)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => removeFromCart(c.item.id)}
                        className="text-[#000000] hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-[#000000] pt-10">
                <ShoppingBag className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-[15px] font-medium text-[#000000]">Cart is empty</p>
                <p className="text-[12px] mt-1">Scan or click items to add</p>
              </div>
            )}
          </div>

          {/* Totals & Payment Area */}
          <div className="bg-white border-t border-[#9DC07A] shrink-0">
            {/* Totals Block */}
            <div className="p-3 bg-[#EBF5E2] border-b border-[#9DC07A] grid grid-cols-2 gap-x-6 gap-y-1">
              <div className="flex justify-between text-[12px] text-[#000000]">
                <span>Subtotal</span>
                <span className="font-mono">Rs. {formatNumber(subTotal)}</span>
              </div>
              <div className="flex justify-between text-[12px] text-[#000000]">
                <span>Taxable Amount</span>
                <span className="font-mono">Rs. {formatNumber(taxableAmount)}</span>
              </div>
              <div className="flex justify-between text-[12px] text-[#000000]">
                <span>Discount</span>
                <span className="font-mono">Rs. {formatNumber(discountTotal)}</span>
              </div>
              <div className="flex justify-between text-[12px] text-[#000000]">
                <span>VAT (13%)</span>
                <span className="font-mono">Rs. {formatNumber(vatAmount)}</span>
              </div>
              <div className="col-span-2 mt-2 pt-2 border-t border-[#9DC07A] flex justify-between items-end">
                <span className="text-[14px] font-bold text-[#000000] uppercase tracking-wide">
                  Grand Total
                </span>
                <span className="text-[28px] font-bold text-[#1557b0] font-mono leading-none">
                  Rs. {formatNumber(grandTotal)}
                </span>
              </div>
            </div>

            {/* Payment Modes */}
            <div className="p-3 border-b border-[#9DC07A]">
              <label className="block text-[10px] font-bold text-[#000000] uppercase tracking-wide mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedPayment("cash")}
                  className={`flex flex-col items-center justify-center py-2 rounded border ${selectedPayment === "cash" ? "bg-green-50 border-green-500 text-green-700" : "bg-white border-[#9DC07A] text-[#000000] hover:bg-[#EBF5E2]"}`}
                >
                  <DollarSign className="w-5 h-5 mb-1" />
                  <span className="text-[11px] font-bold">CASH</span>
                </button>
                <button
                  onClick={() => setSelectedPayment("card")}
                  className={`flex flex-col items-center justify-center py-2 rounded border ${selectedPayment === "card" ? "bg-[#D4EABD] border-[#9DC07A] text-[#000000]" : "bg-white border-[#9DC07A] text-[#000000] hover:bg-[#EBF5E2]"}`}
                >
                  <CreditCard className="w-5 h-5 mb-1" />
                  <span className="text-[11px] font-bold">CARD</span>
                </button>
                <button
                  onClick={() => setSelectedPayment("qr")}
                  className={`flex flex-col items-center justify-center py-2 rounded border ${selectedPayment === "qr" ? "bg-purple-50 border-purple-500 text-purple-700" : "bg-white border-[#9DC07A] text-[#000000] hover:bg-[#EBF5E2]"}`}
                >
                  <QrCode className="w-5 h-5 mb-1" />
                  <span className="text-[11px] font-bold">SCAN QR</span>
                </button>
              </div>

              {/* Dynamic Payment Input Area */}
              <div className="mt-3 min-h-[70px] flex items-center justify-center bg-[#EBF5E2] rounded border border-[#9DC07A] p-2">
                {selectedPayment === "cash" && (
                  <div className="w-full flex gap-3 items-center">
                    <div className="flex-1">
                      <label className="block text-[10px] text-[#000000] uppercase font-semibold mb-0.5">
                        Tendered Amount
                      </label>
                      <input
                        type="number"
                        value={cashTendered || ""}
                        onChange={(e) => setCashTendered(Number(e.target.value))}
                        className="w-full h-10 px-3 text-[16px] font-mono font-bold border border-[#9DC07A] rounded focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex-1 text-right">
                      <label className="block text-[10px] text-[#000000] uppercase font-semibold mb-0.5">
                        Change Due
                      </label>
                      <div
                        className={`text-[20px] font-mono font-bold ${cashTendered - grandTotal >= 0 ? "text-green-600" : "text-red-500"}`}
                      >
                        Rs. {formatNumber(Math.max(0, cashTendered - grandTotal))}
                      </div>
                    </div>
                  </div>
                )}
                {selectedPayment === "qr" && qrDataUrl && (
                  <div className="flex items-center gap-4">
                    <img
                      src={qrDataUrl}
                      alt="Payment QR"
                      className="w-16 h-16 border rounded bg-white p-1"
                    />
                    <div className="text-[11px] text-[#000000] font-medium">
                      Scan to pay
                      <br />
                      <b className="text-[14px] text-[#000000]">Rs. {formatNumber(grandTotal)}</b>
                    </div>
                  </div>
                )}
                {selectedPayment === "card" && (
                  <div className="text-[12px] text-[#000000] italic flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Swipe card on terminal
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-3 grid grid-cols-4 gap-2">
              <button
                onClick={handleHoldBill}
                className="col-span-1 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 rounded py-2.5 flex flex-col items-center justify-center transition-colors"
              >
                <Pause className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold uppercase">Hold Bill</span>
              </button>
              <button
                onClick={clearCart}
                className="col-span-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded py-2.5 flex flex-col items-center justify-center transition-colors"
              >
                <Trash2 className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold uppercase">Clear (Esc)</span>
              </button>
              <button
                onClick={handlePrintAndNew}
                className="col-span-2 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white rounded py-2.5 flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Printer className="w-6 h-6" />
                <div className="flex flex-col items-start">
                  <span className="text-[14px] font-bold uppercase leading-none">Print & Save</span>
                  <span className="text-[10px] text-[#000000] leading-none mt-1">Shortcut: F2</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RECALL MODAL */}
      {showHeldBills && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-[#9DC07A] flex items-center justify-between bg-[#f5f6fa]">
              <h2 className="text-[14px] font-semibold text-[#000000] flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-[#1557b0]" /> Held Bills
              </h2>
              <button
                onClick={() => setShowHeldBills(false)}
                className="text-[#000000] hover:text-[#000000]"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {heldBills.length === 0 ? (
                <p className="text-center text-[#000000] text-[12px] py-8">No held bills found.</p>
              ) : (
                heldBills.map((b) => (
                  <div
                    key={b.id}
                    className="border border-[#9DC07A] rounded p-3 flex items-center justify-between hover:border-[#1557b0] bg-[#EBF5E2] cursor-pointer"
                    onClick={() => handleRecallBill(b.id)}
                  >
                    <div>
                      <div className="text-[13px] font-bold text-[#000000]">{b.name}</div>
                      <div className="text-[11px] text-[#000000] mt-0.5">
                        {new Date(b.date).toLocaleTimeString()} - {b.cart.length} items
                      </div>
                    </div>
                    <button className="px-3 py-1 bg-white border border-[#1557b0] text-[#1557b0] rounded text-[11px] font-bold hover:bg-[#3D6B25] hover:text-white transition-colors">
                      RECALL
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRINT RECEIPT TEMPLATE (Only visible during window.print()) */}
      <div className="print-only hidden w-[80mm] bg-white text-black p-4 font-mono text-[12px] mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-[16px] font-bold uppercase">
            {companySettings?.companyNameEn || "Sutra ERP"}
          </h1>
          <div className="text-[11px]">{companySettings?.address || "Nepal"}</div>
          <div className="text-[11px]">PAN/VAT: {companySettings?.panNumber || "N/A"}</div>
          <div className="text-[11px]">Ph: {companySettings?.phone || "N/A"}</div>
          <div className="mt-2 text-[14px] font-bold border-b border-black pb-1 mb-1">
            TAX INVOICE
          </div>
        </div>

        <div className="mb-3 text-[11px]">
          <div>Bill No: {tempInvoiceNo}</div>
          <div>Date: {dateNow}</div>
          <div>Customer: {customerName || "Cash Customer"}</div>
          <div>Payment: {selectedPayment.toUpperCase()}</div>
        </div>

        <table className="w-full text-[11px] mb-3">
          <thead className="border-b border-black border-t">
            <tr>
              <th className="py-1 text-left">Item</th>
              <th className="py-1 text-center">Qty</th>
              <th className="py-1 text-right">Rate</th>
              <th className="py-1 text-right">Amt</th>
            </tr>
          </thead>
          <tbody className="border-b border-black">
            {cart.map((c) => (
              <tr key={c.item.id}>
                <td className="py-1 pr-1">{c.item.name}</td>
                <td className="py-1 text-center">{c.qty}</td>
                <td className="py-1 text-right">{c.item.salesRate}</td>
                <td className="py-1 text-right">{c.item.salesRate * c.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-3">
          <div className="w-2/3 text-[11px]">
            <div className="flex justify-between mb-1">
              <span>Subtotal:</span>
              <span>{formatNumber(subTotal)}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Discount:</span>
              <span>{formatNumber(discountTotal)}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Taxable:</span>
              <span>{formatNumber(taxableAmount)}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>VAT (13%):</span>
              <span>{formatNumber(vatAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-[13px] border-t border-black pt-1 mt-1">
              <span>TOTAL:</span>
              <span>{formatNumber(grandTotal)}</span>
            </div>
            {selectedPayment === "cash" && (
              <>
                <div className="flex justify-between mt-1 text-[10px]">
                  <span>Tendered:</span>
                  <span>{formatNumber(cashTendered)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Change:</span>
                  <span>{formatNumber(Math.max(0, cashTendered - grandTotal))}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="text-center mt-6 text-[10px]">
          <div>Thank you for shopping!</div>
          <div className="mt-2 text-[#000000]">This is a computer-generated bill</div>
          <div className="text-[#000000] font-sans">यो कम्प्युटरद्वारा उत्पादित बिल हो</div>
        </div>
      </div>
    </div>
  );
}
