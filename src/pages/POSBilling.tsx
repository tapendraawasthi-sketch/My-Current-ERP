// src/pages/POSBilling.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Button, Input } from '../components/ui';
import { Printer, ShoppingCart, Clock, X } from 'lucide-react';

// Define interfaces
interface POSItem {
  id: string;
  name: string;
  barcode: string;
  price: number;
  mrp: number;
  category: string;
  unit: string;
  stockQty: number;
  vatPct: number;    // 0 or 13
  imageUrl?: string;
}

interface POSLineItem {
  itemId: string;
  itemName: string;
  barcode: string;
  qty: number;
  unit: string;
  price: number;
  discount: number;   // NPR discount per unit
  discountPct: number;
  amount: number;     // (price - discount) * qty
  vatPct: number;
  vatAmount: number;
}

interface POSBill {
  id: string;
  billNo: string;
  date: string;
  dateNepali: string;
  cashierName: string;
  customerName: string;
  customerPhone: string;
  lines: POSLineItem[];
  subTotal: number;
  discountTotal: number;
  taxableAmount: number;
  vatAmount: number;
  grossTotal: number;
  roundOff: number;
  netTotal: number;
  paymentMode: "cash" | "card" | "qr" | "credit";
  cashReceived: number;
  changeGiven: number;
  status: "open" | "paid" | "held" | "cancelled";
}

// Local storage helper functions
const getPOSItems = (storeItems: any[]): POSItem[] => {
  if (!storeItems || !Array.isArray(storeItems)) return [];
  
  return storeItems.map(item => ({
    id: item.id,
    name: item.name || item.itemName || 'Unnamed Item',
    barcode: item.barcode || '',
    price: item.salePrice ?? item.rate ?? 0,
    mrp: item.mrp ?? item.salePrice ?? 0,
    category: item.category || 'Uncategorized',
    unit: item.unit || 'unit',
    stockQty: item.stockQty || 0,
    vatPct: item.vatPct || 0,
    imageUrl: item.imageUrl
  }));
};

const generateBillNo = (companyId: string): string => {
  if (typeof window === 'undefined') return '';
  const key = `sutra_pos_bills_${companyId}`;
  const stored = localStorage.getItem(key);
  const bills: POSBill[] = stored ? JSON.parse(stored) : [];
  
  const posBills = bills.filter(b => b.billNo.startsWith('POS-'));
  const billNumbers = posBills
    .map(b => parseInt(b.billNo.replace('POS-', ''), 10))
    .filter(num => !isNaN(num));
  
  const maxNum = billNumbers.length > 0 ? Math.max(...billNumbers) : 0;
  return `POS-${(maxNum + 1).toString().padStart(4, '0')}`;
};

const savePOSBill = (bill: POSBill, companyId: string): void => {
  if (typeof window === 'undefined') return;
  const key = `sutra_pos_bills_${companyId}`;
  const existingBills = JSON.parse(localStorage.getItem(key) || '[]');
  const updatedBills = existingBills.filter((b: POSBill) => b.id !== bill.id);
  updatedBills.push(bill);
  localStorage.setItem(key, JSON.stringify(updatedBills));
};

const holdBill = (bill: POSBill, companyId: string): void => {
  if (typeof window === 'undefined') return;
  const key = `sutra_pos_held_bills_${companyId}`;
  const existingHeld = JSON.parse(localStorage.getItem(key) || '[]');
  const updatedHeld = existingHeld.filter((b: POSBill) => b.id !== bill.id);
  updatedHeld.push({ ...bill, status: 'held' });
  localStorage.setItem(key, JSON.stringify(updatedHeld));
};

const getHeldBills = (companyId: string): POSBill[] => {
  if (typeof window === 'undefined') return [];
  const key = `sutra_pos_held_bills_${companyId}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

const calcLine = (line: POSLineItem): POSLineItem => {
  const discountedPrice = line.price - line.discount;
  const amount = discountedPrice * line.qty;
  const vatAmount = amount * (line.vatPct / 100);
  
  return {
    ...line,
    amount,
    vatAmount
  };
};

const calcTotals = (lines: POSLineItem[]): Pick<POSBill, 'subTotal'|'discountTotal'|'taxableAmount'|'vatAmount'|'grossTotal'|'roundOff'|'netTotal'> => {
  const subTotal = lines.reduce((sum, line) => sum + (line.price * line.qty), 0);
  const discountTotal = lines.reduce((sum, line) => sum + (line.discount * line.qty), 0);
  const taxableAmount = subTotal - discountTotal;
  const vatAmount = lines.reduce((sum, line) => sum + line.vatAmount, 0);
  const grossTotal = taxableAmount + vatAmount;
  const roundOff = Math.round(grossTotal) - grossTotal;
  const netTotal = Math.round(grossTotal);
  
  return {
    subTotal,
    discountTotal,
    taxableAmount,
    vatAmount,
    grossTotal,
    roundOff,
    netTotal
  };
};

const POSBilling: React.FC = () => {
  const { items: storeItems, currentUser, companySettings } = useStore();
  const [items, setItems] = useState<POSItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<POSItem[]>([]);
  const [bill, setBill] = useState<POSBill>({
    id: '',
    billNo: '',
    date: new Date().toISOString().split('T')[0],
    dateNepali: '',
    cashierName: currentUser?.name || 'Cashier',
    customerName: '',
    customerPhone: '',
    lines: [],
    subTotal: 0,
    discountTotal: 0,
    taxableAmount: 0,
    vatAmount: 0,
    grossTotal: 0,
    roundOff: 0,
    netTotal: 0,
    paymentMode: "cash",
    cashReceived: 0,
    changeGiven: 0,
    status: "open"
  });
  const [searchText, setSearchText] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [paymentMode, setPaymentMode] = useState<"cash" | "card" | "qr" | "credit">("cash");
  const [cashReceived, setCashReceived] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showHeldBillsModal, setShowHeldBillsModal] = useState<boolean>(false);
  const [heldBills, setHeldBills] = useState<POSBill[]>([]);
  const [printReceipt, setPrintReceipt] = useState<boolean>(false);
  const [companyId, setCompanyId] = useState<string>('');
  
  const barcodeRef = useRef<HTMLInputElement>(null);
  
  // Get unique categories
  const categories = ['ALL', ...new Set(items.map(item => item.category))];
  
  // Initialize on mount
  useEffect(() => {
    if (currentUser?.companyId) {
      setCompanyId(currentUser.companyId);
      const posItems = getPOSItems(storeItems);
      setItems(posItems);
      setFilteredItems(posItems);
      
      // Load held bills
      const loadedHeldBills = getHeldBills(currentUser.companyId);
      setHeldBills(loadedHeldBills);
      
      // Initialize new bill
      const newBill: POSBill = {
        id: `bill-${Date.now()}`,
        billNo: generateBillNo(currentUser.companyId),
        date: new Date().toISOString().split('T')[0],
        dateNepali: '', // Would need a Nepali date converter
        cashierName: currentUser.name || 'Cashier',
        customerName: '',
        customerPhone: '',
        lines: [],
        subTotal: 0,
        discountTotal: 0,
        taxableAmount: 0,
        vatAmount: 0,
        grossTotal: 0,
        roundOff: 0,
        netTotal: 0,
        paymentMode: "cash",
        cashReceived: 0,
        changeGiven: 0,
        status: "open"
      };
      setBill(newBill);
    }
    
    // Focus barcode input on mount
    if (barcodeRef.current) {
      barcodeRef.current.focus();
    }
  }, [currentUser, storeItems]);

  // Filter items based on search and category
  useEffect(() => {
    let result = items;
    
    if (searchText) {
      result = result.filter(item => 
        item.name.toLowerCase().includes(searchText.toLowerCase()) ||
        item.barcode.includes(searchText)
      );
    }
    
    if (selectedCategory !== 'ALL') {
      result = result.filter(item => item.category === selectedCategory);
    }
    
    setFilteredItems(result);
  }, [items, searchText, selectedCategory]);

  // Recalculate totals when lines change
  useEffect(() => {
    const updatedLines = bill.lines.map(calcLine);
    const totals = calcTotals(updatedLines);
    
    setBill(prev => ({
      ...prev,
      lines: updatedLines,
      ...totals
    }));
    
    // Update cash received if payment mode is cash
    if (paymentMode === 'cash' && cashReceived === '') {
      setCashReceived(totals.netTotal.toString());
    }
  }, [bill.lines]);

  // Handle adding an item to the bill
  const handleAddItem = (item: POSItem) => {
    setBill(prev => {
      const existingLineIndex = prev.lines.findIndex(line => line.itemId === item.id);
      
      let newLines = [...prev.lines];
      
      if (existingLineIndex >= 0) {
        // Update quantity if item already exists
        const existingLine = newLines[existingLineIndex];
        const updatedLine = {
          ...existingLine,
          qty: existingLine.qty + 1
        };
        newLines[existingLineIndex] = calcLine(updatedLine);
      } else {
        // Add new line item
        const newLine: POSLineItem = {
          itemId: item.id,
          itemName: item.name,
          barcode: item.barcode,
          qty: 1,
          unit: item.unit,
          price: item.price,
          discount: 0,
          discountPct: 0,
          amount: item.price,
          vatPct: item.vatPct,
          vatAmount: 0
        };
        newLines.push(calcLine(newLine));
      }
      
      return {
        ...prev,
        lines: newLines
      };
    });
  };

  // Handle barcode input
  const handleBarcodeInput = (value: string) => {
    if (value.length > 0) {
      const foundItem = items.find(item => item.barcode === value);
      if (foundItem) {
        handleAddItem(foundItem);
        setBarcodeInput('');
      } else {
        alert(`Item not found for barcode: ${value}`);
        setBarcodeInput('');
      }
    }
  };

  // Update quantity
  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveLine(index);
      return;
    }
    
    setBill(prev => {
      const newLines = [...prev.lines];
      const updatedLine = {
        ...newLines[index],
        qty: newQty
      };
      newLines[index] = calcLine(updatedLine);
      
      return {
        ...prev,
        lines: newLines
      };
    });
  };

  // Remove line
  const handleRemoveLine = (index: number) => {
    setBill(prev => {
      const newLines = prev.lines.filter((_, i) => i !== index);
      return {
        ...prev,
        lines: newLines
      };
    });
  };

  // Update discount
  const handleUpdateDiscount = (index: number, discountPct: number) => {
    setBill(prev => {
      const newLines = [...prev.lines];
      const originalPrice = newLines[index].price;
      const discountAmount = originalPrice * (discountPct / 100);
      
      const updatedLine = {
        ...newLines[index],
        discount: discountAmount,
        discountPct
      };
      newLines[index] = calcLine(updatedLine);
      
      return {
        ...prev,
        lines: newLines
      };
    });
  };

  // Handle payment
  const handlePay = () => {
    if (bill.lines.length === 0) {
      alert('Cannot pay for an empty bill');
      return;
    }
    
    if (paymentMode === 'cash') {
      const received = parseFloat(cashReceived) || 0;
      if (received < bill.netTotal) {
        alert(`Cash received (NPR ${received}) is less than net total (NPR ${bill.netTotal})`);
        return;
      }
    }
    
    const updatedBill = {
      ...bill,
      paymentMode,
      cashReceived: parseFloat(cashReceived) || bill.netTotal,
      changeGiven: (parseFloat(cashReceived) || bill.netTotal) - bill.netTotal,
      status: 'paid',
      billNo: bill.billNo || generateBillNo(companyId)
    };
    
    setBill(updatedBill);
    savePOSBill(updatedBill, companyId);
    setPrintReceipt(true);
    
    // Reset to new bill after payment
    setTimeout(() => {
      setBill({
        id: `bill-${Date.now()}`,
        billNo: generateBillNo(companyId),
        date: new Date().toISOString().split('T')[0],
        dateNepali: '',
        cashierName: currentUser?.name || 'Cashier',
        customerName: '',
        customerPhone: '',
        lines: [],
        subTotal: 0,
        discountTotal: 0,
        taxableAmount: 0,
        vatAmount: 0,
        grossTotal: 0,
        roundOff: 0,
        netTotal: 0,
        paymentMode: "cash",
        cashReceived: 0,
        changeGiven: 0,
        status: "open"
      });
      setCashReceived('');
      setShowPaymentModal(false);
    }, 1000);
  };

  // Hold bill
  const handleHoldBill = () => {
    if (bill.lines.length === 0) {
      alert('Cannot hold an empty bill');
      return;
    }
    
    const heldBill = { ...bill, status: 'held' as const };
    holdBill(heldBill, companyId);
    
    // Refresh held bills list
    const updatedHeldBills = getHeldBills(companyId);
    setHeldBills(updatedHeldBills);
    
    // Reset to new bill
    setBill({
      id: `bill-${Date.now()}`,
      billNo: generateBillNo(companyId),
      date: new Date().toISOString().split('T')[0],
      dateNepali: '',
      cashierName: currentUser?.name || 'Cashier',
      customerName: '',
      customerPhone: '',
      lines: [],
      subTotal: 0,
      discountTotal: 0,
      taxableAmount: 0,
      vatAmount: 0,
      grossTotal: 0,
      roundOff: 0,
      netTotal: 0,
      paymentMode: "cash",
      cashReceived: 0,
      changeGiven: 0,
      status: "open"
    });
    setCashReceived('');
  };

  // Retrieve held bill
  const handleRetrieveHeldBill = (heldBill: POSBill) => {
    setBill(heldBill);
    setShowHeldBillsModal(false);
    
    // Remove from held bills
    if (typeof window !== 'undefined') {
      const key = `sutra_pos_held_bills_${companyId}`;
      const existingHeld = JSON.parse(localStorage.getItem(key) || '[]');
      const updatedHeld = existingHeld.filter((b: POSBill) => b.id !== heldBill.id);
      localStorage.setItem(key, JSON.stringify(updatedHeld));
      
      setHeldBills(updatedHeld);
    }
  };

  // Cancel bill
  const handleCancelBill = () => {
    if (window.confirm('Are you sure you want to cancel this bill?')) {
      setBill({
        id: `bill-${Date.now()}`,
        billNo: generateBillNo(companyId),
        date: new Date().toISOString().split('T')[0],
        dateNepali: '',
        cashierName: currentUser?.name || 'Cashier',
        customerName: '',
        customerPhone: '',
        lines: [],
        subTotal: 0,
        discountTotal: 0,
        taxableAmount: 0,
        vatAmount: 0,
        grossTotal: 0,
        roundOff: 0,
        netTotal: 0,
        paymentMode: "cash",
        cashReceived: 0,
        changeGiven: 0,
        status: "open"
      });
      setCashReceived('');
    }
  };

  // Print receipt
  const handlePrintReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>POS Receipt</title>
        <style>
          body { 
            font-family: monospace; 
            margin: 0; 
            padding: 10px; 
            font-size: 14px;
            width: 80mm;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .bill-info { margin-bottom: 10px; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          .items-table th, .items-table td { text-align: left; padding: 2px 0; }
          .items-table th { border-bottom: 1px solid #000; }
          .totals { margin-top: 10px; }
          .footer { text-align: center; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${companySettings?.companyNameEn || 'Sutra ERP'}</h2>
          <p>VAT: ${companySettings?.panNumber || 'N/A'}</p>
          <p>${companySettings?.address || 'Nepal'}</p>
        </div>
        
        <div class="bill-info">
          <p>Bill No: ${bill.billNo}</p>
          <p>Date: ${bill.date}</p>
          <p>Cashier: ${bill.cashierName}</p>
          ${bill.customerName ? `<p>Customer: ${bill.customerName}</p>` : ''}
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${bill.lines.map(line => `
              <tr>
                <td>${line.itemName}</td>
                <td>${line.qty}</td>
                <td>${line.price.toFixed(2)}</td>
                <td>${line.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <p>Sub Total: NPR ${bill.subTotal.toFixed(2)}</p>
          ${bill.discountTotal > 0 ? `<p>Discount: NPR -${bill.discountTotal.toFixed(2)}</p>` : ''}
          <p>Taxable: NPR ${bill.taxableAmount.toFixed(2)}</p>
          <p>VAT: NPR ${bill.vatAmount.toFixed(2)}</p>
          <p>Round Off: NPR ${bill.roundOff.toFixed(2)}</p>
          <p><strong>NET TOTAL: NPR ${bill.netTotal.toFixed(2)}</strong></p>
          ${paymentMode === 'cash' ? `
            <p>Cash Received: NPR ${(parseFloat(cashReceived) || bill.netTotal).toFixed(2)}</p>
            <p>Change: NPR ${((parseFloat(cashReceived) || bill.netTotal) - bill.netTotal).toFixed(2)}</p>
          ` : ''}
        </div>
        
        <div class="footer">
          <p>Thank You for Shopping!</p>
          <p>Visit again soon</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
      setPrintReceipt(false);
    };
  };

  // Effect to trigger print when printReceipt is true
  useEffect(() => {
    if (printReceipt) {
      handlePrintReceipt();
    }
  }, [printReceipt]);

  // Handle barcode input key events
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBarcodeInput(barcodeInput);
    }
  };

  // Calculate change
  const changeGiven = paymentMode === 'cash' 
    ? (parseFloat(cashReceived) || bill.netTotal) - bill.netTotal 
    : 0;

  return (
    <div className="flex flex-col h-screen bg-[#f5f6fa]">
      {/* Top Action Bar */}
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-6 w-6 text-[#1557b0]" />
            <h1 className="text-xl font-bold text-gray-800">Point of Sale (POS)</h1>
          </div>
          <div className="text-sm text-gray-600">
            Cashier: {currentUser?.name || 'N/A'} | {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Items Selection */}
        <div className="w-3/5 flex flex-col border-r border-gray-200">
          {/* Barcode Input and Categories */}
          <div className="p-4 bg-white border-b border-gray-200">
            <div className="flex gap-2 mb-3">
              <Input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Scan barcode or type..."
                className="h-9 text-[12px]"
              />
            </div>
            
            <div className="flex gap-1 overflow-x-auto pb-1">
              {categories.map(category => (
                <button
                  key={category}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-full whitespace-nowrap ${
                    selectedCategory === category
                      ? 'bg-[#1557b0] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          
          {/* Search */}
          <div className="p-3 bg-white border-b border-gray-200">
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search items..."
              className="h-8 text-[12px]"
            />
          </div>
          
          {/* Items Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>No items found. Add items from Inventory menu.</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-[#1557b0] hover:bg-[#f0f4ff] transition-colors"
                    onClick={() => handleAddItem(item)}
                  >
                    <div className="text-[12px] font-medium text-gray-800 truncate">
                      {item.name}
                    </div>
                    <div className="text-[13px] font-bold text-[#1557b0] mt-1">
                      NPR {item.price.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      Stock: {item.stockQty} {item.unit}
                    </div>
                    {item.vatPct > 0 && (
                      <div className="text-[9px] bg-blue-50 text-blue-600 rounded px-1 inline-block mt-1">
                        {item.vatPct}% VAT
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Right Panel - Bill/Receipt */}
        <div className="w-2/5 flex flex-col">
          {/* Bill Header */}
          <div className="p-4 bg-white border-b border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold text-gray-800">Current Bill</h2>
              <div className="text-sm text-gray-600">
                {bill.billNo} | {bill.date}
              </div>
            </div>
            <div className="mt-2">
              <Input
                value={bill.customerName}
                onChange={(e) => setBill({...bill, customerName: e.target.value})}
                placeholder="Customer Name (optional)"
                className="h-8 text-[12px]"
              />
            </div>
          </div>
          
          {/* Bill Lines */}
          <div className="flex-1 overflow-y-auto p-4">
            {bill.lines.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Add items to start billing</p>
              </div>
            ) : (
              <div className="space-y-2">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left pb-2">Item</th>
                      <th className="text-center pb-2">Qty</th>
                      <th className="text-center pb-2">Price</th>
                      <th className="text-center pb-2">Disc%</th>
                      <th className="text-right pb-2">Amount</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.lines.map((line, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-2 text-[11px]">{line.itemName}</td>
                        <td className="py-2 text-center">
                          <input
                            type="number"
                            value={line.qty}
                            onChange={(e) => handleUpdateQty(index, parseInt(e.target.value) || 0)}
                            className="w-12 h-7 text-center text-[11px] border border-gray-300 rounded"
                          />
                        </td>
                        <td className="py-2 text-center text-[11px] font-medium">
                          {line.price.toFixed(2)}
                        </td>
                        <td className="py-2 text-center">
                          <input
                            type="number"
                            value={line.discountPct}
                            onChange={(e) => handleUpdateDiscount(index, parseFloat(e.target.value) || 0)}
                            className="w-14 h-7 text-center text-[11px] border border-gray-300 rounded"
                            min="0"
                            max="100"
                          />
                        </td>
                        <td className="py-2 text-right font-mono text-[11px]">
                          {line.amount.toFixed(2)}
                        </td>
                        <td className="py-2 text-center">
                          <button
                            onClick={() => handleRemoveLine(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Bill Totals */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="space-y-1 mb-4">
              <div className="flex justify-between text-[12px]">
                <span>Sub Total:</span>
                <span>NPR {bill.subTotal.toFixed(2)}</span>
              </div>
              {bill.discountTotal > 0 && (
                <div className="flex justify-between text-[12px] text-red-500">
                  <span>Discount:</span>
                  <span>-NPR {bill.discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[12px]">
                <span>Taxable:</span>
                <span>NPR {bill.taxableAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span>VAT ({bill.vatAmount > 0 ? '13%' : '0%'}):</span>
                <span>NPR {bill.vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span>Round Off:</span>
                <span>NPR {bill.roundOff.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[18px] font-bold mt-2 pt-2 border-t border-gray-200">
                <span>NET TOTAL:</span>
                <span>NPR {bill.netTotal.toFixed(2)}</span>
              </div>
            </div>
            
            {/* Payment Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {(['cash', 'card', 'qr', 'credit'] as const).map(mode => (
                <button
                  key={mode}
                  className={`py-2 text-[11px] font-medium rounded ${
                    paymentMode === mode
                      ? 'bg-[#1557b0] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setPaymentMode(mode)}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Cash Payment Fields */}
            {paymentMode === 'cash' && (
              <div className="mb-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-medium text-gray-700 mb-1">
                      Cash Received: NPR
                    </label>
                    <Input
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="0.00"
                      type="number"
                      step="0.01"
                      className="h-9 text-[14px]"
                    />
                  </div>
                </div>
                {changeGiven >= 0 && (
                  <div className="mt-2 text-right">
                    <span className="text-[12px] font-medium">Change: NPR {changeGiven.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Button
                variant="outline"
                onClick={handleHoldBill}
                className="text-[12px] py-2"
              >
                Hold Bill
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelBill}
                className="text-[12px] py-2 text-red-600 border-red-300 hover:bg-red-50"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => setShowPaymentModal(true)}
                className="text-[14px] py-2 h-10"
              >
                PAY — NPR {bill.netTotal.toFixed(2)}
              </Button>
            </div>
            
            <button
              onClick={() => setShowHeldBillsModal(true)}
              className="w-full py-2 text-[12px] bg-amber-100 text-amber-800 rounded hover:bg-amber-200"
            >
              View Held Bills ({heldBills.length})
            </button>
          </div>
        </div>
      </div>
      
      {/* Payment Confirmation Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Confirm Payment</h3>
              <button onClick={() => setShowPaymentModal(false)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span>Bill No:</span>
                <span className="font-medium">{bill.billNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-medium">NPR {bill.netTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-medium capitalize">{paymentMode}</span>
              </div>
              {paymentMode === 'cash' && (
                <>
                  <div className="flex justify-between">
                    <span>Cash Received:</span>
                    <span className="font-medium">NPR {(parseFloat(cashReceived) || bill.netTotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Change:</span>
                    <span className="font-medium">NPR {changeGiven.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handlePay}
                className="flex-1"
              >
                Confirm Payment
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Held Bills Modal */}
      {showHeldBillsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md max-h-96 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Held Bills</h3>
              <button onClick={() => setShowHeldBillsModal(false)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto mb-4">
              {heldBills.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No held bills
                </div>
              ) : (
                <div className="space-y-2">
                  {heldBills.map(heldBill => (
                    <div key={heldBill.id} className="border border-gray-200 rounded p-3">
                      <div className="flex justify-between">
                        <span className="font-medium">{heldBill.billNo}</span>
                        <span>NPR {heldBill.netTotal.toFixed(2)}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        {heldBill.customerName || 'Walk-in Customer'} • {new Date(heldBill.date).toLocaleTimeString()}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetrieveHeldBill(heldBill)}
                          className="flex-1"
                        >
                          Retrieve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Remove from held bills
                            if (typeof window !== 'undefined') {
                              const key = `sutra_pos_held_bills_${companyId}`;
                              const existingHeld = JSON.parse(localStorage.getItem(key) || '[]');
                              const updatedHeld = existingHeld.filter((b: POSBill) => b.id !== heldBill.id);
                              localStorage.setItem(key, JSON.stringify(updatedHeld));
                              setHeldBills(updatedHeld);
                            }
                          }}
                          className="flex-1 text-red-600"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <Button
              variant="outline"
              onClick={() => setShowHeldBillsModal(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSBilling;
