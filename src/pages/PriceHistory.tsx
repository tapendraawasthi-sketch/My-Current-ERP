// src/pages/PriceHistory.tsx
import React, { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Search, Package, Users, History } from "lucide-react";
import { useStore } from "@/store/useStore";

// Define types
interface PriceEntry {
  date: string;
  dateNepali: string;
  invoiceNo: string;
  partyName: string;
  qty: number;
  unit: string;
  rate: number;
  discount: number;
  netRate: number; // rate after discount
  type: "sale" | "purchase";
}

interface ItemPriceHistory {
  itemId: string;
  itemName: string;
  lastSaleRate: number;
  lastSaleDate: string;
  lastPurchaseRate: number;
  lastPurchaseDate: string;
  avgSaleRate: number;
  avgPurchaseRate: number;
  margin: number; // lastSaleRate - lastPurchaseRate
  marginPct: number; // margin / lastPurchaseRate * 100
  priceEntries: PriceEntry[];
}

// Compute function
const computePriceHistory = (invoices: any[]): ItemPriceHistory[] => {
  if (!invoices || invoices.length === 0) return [];

  const allLines: any[] = [];
  invoices.forEach((inv) => {
    if (inv.lines && Array.isArray(inv.lines)) {
      inv.lines.forEach((line) => {
        allLines.push({
          ...line,
          invoiceNo: inv.invoiceNo || inv.voucherNo || "Unknown",
          partyName: inv.partyName || inv.party || "Unknown",
          date: inv.date || inv.invoiceDate || "",
          dateNepali: inv.dateNepali || "",
          type: inv.type.includes("SALES") || inv.type.includes("sales") ? "sale" : "purchase",
        });
      });
    }
  });

  if (allLines.length === 0) return [];

  const grouped: Record<string, any> = {};
  allLines.forEach((line) => {
    const itemName = line.itemName || line.name || "Unknown";
    if (!grouped[itemName]) {
      grouped[itemName] = {
        itemId: line.itemId || "unknown",
        itemName,
        sales: [],
        purchases: [],
        priceEntries: [],
      };
    }

    const rate = line.rate ?? line.unitPrice ?? line.price ?? 0;
    const discount = line.discount ?? line.discountPct ?? 0;
    const netRate = rate * (1 - discount / 100);

    const priceEntry: PriceEntry = {
      date: line.date,
      dateNepali: line.dateNepali,
      invoiceNo: line.invoiceNo,
      partyName: line.partyName,
      qty: line.qty || line.quantity || 0,
      unit: line.unit || "unit",
      rate,
      discount,
      netRate,
      type: line.type,
    };

    grouped[itemName].priceEntries.push(priceEntry);

    if (line.type === "sale") {
      grouped[itemName].sales.push(priceEntry);
    } else {
      grouped[itemName].purchases.push(priceEntry);
    }
  });

  const result: ItemPriceHistory[] = [];
  Object.values(grouped).forEach((item) => {
    // Sort entries by date descending
    item.priceEntries.sort(
      (a: PriceEntry, b: PriceEntry) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    item.sales.sort(
      (a: PriceEntry, b: PriceEntry) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    item.purchases.sort(
      (a: PriceEntry, b: PriceEntry) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // Calculate last rates and dates
    const lastSale = item.sales[0] || null;
    const lastPurchase = item.purchases[0] || null;

    const lastSaleRate = lastSale ? lastSale.rate : 0;
    const lastSaleDate = lastSale ? lastSale.date : "";
    const lastPurchaseRate = lastPurchase ? lastPurchase.rate : 0;
    const lastPurchaseDate = lastPurchase ? lastPurchase.date : "";

    // Calculate averages
    const avgSaleRate =
      item.sales.length > 0
        ? item.sales.reduce((sum: number, entry: PriceEntry) => sum + entry.rate, 0) /
          item.sales.length
        : 0;

    const avgPurchaseRate =
      item.purchases.length > 0
        ? item.purchases.reduce((sum: number, entry: PriceEntry) => sum + entry.rate, 0) /
          item.purchases.length
        : 0;

    // Calculate margin
    const margin = lastSaleRate - lastPurchaseRate;
    const marginPct = lastPurchaseRate > 0 ? (margin / lastPurchaseRate) * 100 : 0;

    result.push({
      itemId: item.itemId,
      itemName: item.itemName,
      lastSaleRate,
      lastSaleDate,
      lastPurchaseRate,
      lastPurchaseDate,
      avgSaleRate,
      avgPurchaseRate,
      margin,
      marginPct,
      priceEntries: item.priceEntries,
    });
  });

  return result.sort((a, b) => a.itemName.localeCompare(b.itemName));
};

const PriceHistory: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"item_view" | "party_view">("item_view");
  const [selectedParty, setSelectedParty] = useState<string>("");

  const { invoices, vouchers } = useStore();
  const allInvoices = [
    ...(invoices ?? []),
    ...(vouchers ?? []).filter((v) =>
      ["SALES", "PURCHASE", "sales", "purchase"].includes(v.type ?? ""),
    ),
  ];

  const priceHistory = useMemo(() => computePriceHistory(allInvoices), [allInvoices]);
  const uniqueParties = useMemo(() => {
    const parties = new Set<string>();
    allInvoices.forEach((inv) => {
      if (inv.partyName) parties.add(inv.partyName);
    });
    return Array.from(parties).sort();
  }, [allInvoices]);

  const filteredHistory = useMemo(() => {
    if (!searchText) return priceHistory;
    return priceHistory.filter((item) =>
      item.itemName.toLowerCase().includes(searchText.toLowerCase()),
    );
  }, [priceHistory, searchText]);

  const selectedItemData = useMemo(() => {
    return priceHistory.find((item) => item.itemName === selectedItem);
  }, [priceHistory, selectedItem]);

  const partyPriceHistory = useMemo(() => {
    if (!selectedParty) return [];
    return allInvoices
      .filter((inv) => inv.partyName === selectedParty)
      .flatMap((inv) =>
        (inv.lines || []).map((line: any) => ({
          date: inv.date || inv.invoiceDate || "",
          dateNepali: inv.dateNepali || "",
          invoiceNo: inv.invoiceNo || inv.voucherNo || "Unknown",
          itemName: line.itemName || line.name || "Unknown",
          qty: line.qty || line.quantity || 0,
          unit: line.unit || "unit",
          rate: line.rate ?? line.unitPrice ?? line.price ?? 0,
          discount: line.discount ?? line.discountPct ?? 0,
          netRate:
            (line.rate ?? line.unitPrice ?? line.price ?? 0) *
            (1 - (line.discount ?? line.discountPct ?? 0) / 100),
          type: inv.type.includes("SALES") || inv.type.includes("sales") ? "sale" : "purchase",
        })),
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allInvoices, selectedParty]);

  // Calculate rate ranges for selected item
  const rateRanges = useMemo(() => {
    if (!selectedItemData) return null;

    const salesRates = selectedItemData.priceEntries
      .filter((pe) => pe.type === "sale")
      .map((pe) => pe.rate);

    const purchasesRates = selectedItemData.priceEntries
      .filter((pe) => pe.type === "purchase")
      .map((pe) => pe.rate);

    return {
      sales: {
        min: salesRates.length > 0 ? Math.min(...salesRates) : 0,
        max: salesRates.length > 0 ? Math.max(...salesRates) : 0,
        avg: salesRates.length > 0 ? salesRates.reduce((a, b) => a + b, 0) / salesRates.length : 0,
      },
      purchases: {
        min: purchasesRates.length > 0 ? Math.min(...purchasesRates) : 0,
        max: purchasesRates.length > 0 ? Math.max(...purchasesRates) : 0,
        avg:
          purchasesRates.length > 0
            ? purchasesRates.reduce((a, b) => a + b, 0) / purchasesRates.length
            : 0,
      },
    };
  }, [selectedItemData]);

  // Determine trend direction
  const getTrendDirection = (entries: PriceEntry[], type: "sale" | "purchase") => {
    const relevantEntries = entries.filter((e) => e.type === type).slice(0, 2);
    if (relevantEntries.length < 2) return null;

    const [latest, previous] = relevantEntries;
    return latest.rate > previous.rate ? "up" : "down";
  };

  if (allInvoices.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#f5f6fa]">
        <div className="p-4 bg-white border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">Price History & Rate Lookup</h1>
          <p className="text-sm text-gray-600">
            View item-wise and party-wise sale/purchase rate history
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-lg">No invoice history found.</p>
            <p className="text-sm">Create invoices to track price history.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa] pb-20">
      <div className="p-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">Price History & Rate Lookup</h1>
        <p className="text-sm text-gray-600">
          View item-wise and party-wise sale/purchase rate history
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        <button
          className={`px-4 py-2 text-sm font-medium capitalize ${
            activeTab === "item_view"
              ? "text-[#1557b0] border-b-2 border-[#1557b0]"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("item_view")}
        >
          By Item
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium capitalize ${
            activeTab === "party_view"
              ? "text-[#1557b0] border-b-2 border-[#1557b0]"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("party_view")}
        >
          By Party
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === "item_view" ? (
          <div className="space-y-6">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search item name..."
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Item Summary Table */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-[#f5f6fa]">
                      <tr>
                        <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          Item Name
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          Last Sale
                        </th>
                        <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          Last Purchase
                        </th>
                        <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          Margin %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredHistory.map((item) => (
                        <tr
                          key={item.itemId}
                          className={`hover:bg-gray-50 cursor-pointer ${
                            selectedItem === item.itemName ? "bg-blue-50" : ""
                          }`}
                          onClick={() => setSelectedItem(item.itemName)}
                        >
                          <td className="px-4 py-2 text-[12px] text-gray-700">{item.itemName}</td>
                          <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                            {item.lastSaleRate > 0 ? `Rs. ${item.lastSaleRate.toFixed(2)}` : "-"}
                          </td>
                          <td className="px-4 py-2 text-[12px] text-gray-700">
                            {item.lastSaleDate}
                          </td>
                          <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                            {item.lastPurchaseRate > 0
                              ? `Rs. ${item.lastPurchaseRate.toFixed(2)}`
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-[12px] text-gray-700">
                            {item.lastPurchaseDate}
                          </td>
                          <td className="px-4 py-2 text-right text-[12px]">
                            <span
                              className={
                                item.marginPct > 15
                                  ? "text-green-600"
                                  : item.marginPct > 5
                                    ? "text-amber-600"
                                    : "text-red-600"
                              }
                            >
                              {item.marginPct > 0
                                ? `+${item.marginPct.toFixed(2)}`
                                : item.marginPct.toFixed(2)}
                              %
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detailed View */}
              {selectedItemData && (
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="text-md font-semibold mb-4">
                      Price History for: {selectedItemData.itemName}
                    </h3>

                    {rateRanges && (
                      <div className="mb-4 space-y-1">
                        <p className="text-sm font-medium">
                          Sale Rate: Min Rs. {rateRanges.sales.min.toFixed(2)} / Max NPR{" "}
                          {rateRanges.sales.max.toFixed(2)} / Avg NPR{" "}
                          {rateRanges.sales.avg.toFixed(2)}
                        </p>
                        <p className="text-sm font-medium">
                          Purchase Rate: Min Rs. {rateRanges.purchases.min.toFixed(2)} / Max NPR{" "}
                          {rateRanges.purchases.max.toFixed(2)} / Avg NPR{" "}
                          {rateRanges.purchases.avg.toFixed(2)}
                        </p>
                      </div>
                    )}

                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">Sale Trend</h4>
                      {getTrendDirection(selectedItemData.priceEntries, "sale") === "up" ? (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-green-600 text-sm">Increasing</span>
                        </div>
                      ) : getTrendDirection(selectedItemData.priceEntries, "sale") === "down" ? (
                        <div className="flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          <span className="text-red-600 text-sm">Decreasing</span>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No trend data</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">Purchase Trend</h4>
                      {getTrendDirection(selectedItemData.priceEntries, "purchase") === "up" ? (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-green-600 text-sm">Increasing</span>
                        </div>
                      ) : getTrendDirection(selectedItemData.priceEntries, "purchase") ===
                        "down" ? (
                        <div className="flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          <span className="text-red-600 text-sm">Decreasing</span>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No trend data</p>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedItem("")}
                      className="text-sm text-[#1557b0] hover:underline"
                    >
                      Back to list
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 mt-4">
                    {/* Sales History */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="px-4 py-2 bg-[#f5f6fa] border-b border-gray-200">
                        <h4 className="text-sm font-semibold">Sales Price History</h4>
                      </div>
                      <div className="overflow-y-auto max-h-60">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-[#f5f6fa] sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                Date
                              </th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                Party
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                Rate
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                Net
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {selectedItemData.priceEntries
                              .filter((pe) => pe.type === "sale")
                              .map((pe, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-[12px] text-gray-700">
                                    {pe.dateNepali || pe.date}
                                  </td>
                                  <td className="px-3 py-2 text-[12px] text-gray-700">
                                    {pe.partyName}
                                  </td>
                                  <td className="px-3 py-2 text-right text-[12px] text-gray-700 font-mono">
                                    {pe.rate.toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-[12px] text-blue-600 font-mono">
                                    {pe.netRate.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Purchase History */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="px-4 py-2 bg-[#f5f6fa] border-b border-gray-200">
                        <h4 className="text-sm font-semibold">Purchase Price History</h4>
                      </div>
                      <div className="overflow-y-auto max-h-60">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-[#f5f6fa] sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                Date
                              </th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                Party
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                Rate
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                Net
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {selectedItemData.priceEntries
                              .filter((pe) => pe.type === "purchase")
                              .map((pe, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-[12px] text-gray-700">
                                    {pe.dateNepali || pe.date}
                                  </td>
                                  <td className="px-3 py-2 text-[12px] text-gray-700">
                                    {pe.partyName}
                                  </td>
                                  <td className="px-3 py-2 text-right text-[12px] text-gray-700 font-mono">
                                    {pe.rate.toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-[12px] text-orange-600 font-mono">
                                    {pe.netRate.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={selectedParty}
                  onChange={(e) => setSelectedParty(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                >
                  <option value="">Select a party...</option>
                  {uniqueParties.map((party) => (
                    <option key={party} value={party}>
                      {party}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedParty && (
              <>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-md font-semibold mb-2">
                    Last 5 Transactions with {selectedParty}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-[#f5f6fa]">
                        <tr>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Rate
                          </th>
                          <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Net Rate
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {partyPriceHistory.slice(0, 5).map((entry, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-[12px] text-gray-700">
                              {entry.dateNepali || entry.date}
                            </td>
                            <td className="px-4 py-2 text-[12px] text-gray-700">
                              {entry.itemName}
                            </td>
                            <td className="px-4 py-2 text-[12px] text-gray-700">
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  entry.type === "sale"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-orange-100 text-orange-800"
                                }`}
                              >
                                {entry.type === "sale" ? "Sale" : "Purchase"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                              {entry.rate.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right text-[12px] font-mono">
                              {entry.type === "sale" ? (
                                <span className="text-blue-600">{entry.netRate.toFixed(2)}</span>
                              ) : (
                                <span className="text-orange-600">{entry.netRate.toFixed(2)}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-md font-semibold mb-4">Suggested Rate</h3>
                  {partyPriceHistory.length > 0 ? (
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-sm">
                        Based on last transaction with {selectedParty}: Use NPR{" "}
                        <span className="font-semibold">
                          {partyPriceHistory[0].rate.toFixed(2)}
                        </span>{" "}
                        for {partyPriceHistory[0].itemName}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No previous transactions found for this party.
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2 bg-[#f5f6fa] border-b border-gray-200">
                    <h4 className="text-sm font-semibold">All Transactions with {selectedParty}</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-[#f5f6fa]">
                        <tr>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Invoice
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Qty
                          </th>
                          <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Rate
                          </th>
                          <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Net Rate
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {partyPriceHistory.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-[12px] text-gray-700">
                              {entry.dateNepali || entry.date}
                            </td>
                            <td className="px-4 py-2 text-[12px] text-gray-700">
                              {entry.itemName}
                            </td>
                            <td className="px-4 py-2 text-[12px] text-gray-700">
                              {entry.invoiceNo}
                            </td>
                            <td className="px-4 py-2 text-[12px] text-gray-700">
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  entry.type === "sale"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-orange-100 text-orange-800"
                                }`}
                              >
                                {entry.type === "sale" ? "Sale" : "Purchase"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right text-[12px] text-gray-700">
                              {entry.qty}
                            </td>
                            <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                              {entry.rate.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right text-[12px] font-mono">
                              {entry.type === "sale" ? (
                                <span className="text-blue-600">{entry.netRate.toFixed(2)}</span>
                              ) : (
                                <span className="text-orange-600">{entry.netRate.toFixed(2)}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceHistory;
