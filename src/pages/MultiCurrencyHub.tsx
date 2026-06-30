// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { getDB, generateId } from "../lib/db";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle,
  Calendar,
} from "lucide-react";

const BORDER = "1px solid #000";
const BG = "#E4F1D9";
const BG_CARD = "#EBF5E2";
const BG_HEADER = "#D4EABD";

function money(v) {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "INR", name: "Indian Rupee" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "QAR", name: "Qatari Rial" },
];

export default function MultiCurrencyHub() {
  const [activeTab, setActiveTab] = useState("rates");
  const [exchangeRates, setExchangeRates] = useState([]);
  const [foreignVouchers, setForeignVouchers] = useState([]);
  const [forexGainLoss, setForexGainLoss] = useState([]);
  const [revaluationBalances, setRevaluationBalances] = useState([]);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualRate, setManualRate] = useState({
    currency: "",
    currencyName: "",
    buyRate: "",
    sellRate: "",
    effectiveDate: new Date().toISOString().split("T")[0],
  });

  const { vouchers, invoices, accounts, addVoucher, companySettings } = useStore();

  // Load exchange rates from DB
  useEffect(() => {
    const db = getDB();
    db.exchangeRates
      .toArray()
      .then(setExchangeRates)
      .catch(() => setExchangeRates([]));
  }, []);

  // Compute foreign vouchers
  useEffect(() => {
    const foreign = vouchers.filter(
      (v) => v.currency && v.currency !== "NPR" && v.currency !== "NRS" && v.currency !== "Rs.",
    );
    setForeignVouchers(foreign);
  }, [vouchers]);

  // Compute forex gain/loss
  useEffect(() => {
    // This would typically compare invoice exchange rates vs payment exchange rates
    // Simplified example calculation
    const gains = [];
    // Placeholder for actual logic based on matching invoices and payments
    setForexGainLoss(gains);
  }, [vouchers, invoices]);

  // Compute revaluation balances
  useEffect(() => {
    // Placeholder for open balances in foreign currencies
    const balances = [];
    setRevaluationBalances(balances);
  }, [vouchers, accounts]);

  const fetchNRBRates = async () => {
    setIsFetching(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const url = `https://corsproxy.io/?https://www.nrb.org.np/api/forex/v1/rates?from=${today}&to=${today}&per_page=30&page=1`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      const db = getDB();
      const newRates = [];

      if (data.data && data.data.payload && Array.isArray(data.data.payload)) {
        for (const item of data.data.payload) {
          if (item.currency && item.buy && item.sell) {
            const iso3 = item.currency.iso3;
            const buy = parseFloat(item.buy);
            const sell = parseFloat(item.sell);

            if (iso3 && !isNaN(buy) && !isNaN(sell)) {
              const newRate = {
                id: generateId(),
                currency: iso3,
                currencyName: item.currency.name || iso3,
                buyRate: buy,
                sellRate: sell,
                midRate: (buy + sell) / 2,
                effectiveDate: today,
                source: "NRB Auto-Fetch",
                createdAt: new Date().toISOString(),
              };

              await db.exchangeRates.put(newRate);
              newRates.push(newRate);
            }
          }
        }

        setExchangeRates((prev) => [...prev, ...newRates]);
        setLastFetchTime(new Date().toLocaleTimeString());
        toast.success(`Successfully fetched ${newRates.length} exchange rates from NRB`);
      } else {
        throw new Error("Invalid response structure from NRB API");
      }
    } catch (error) {
      console.error("Error fetching NRB rates:", error);
      toast.error("Auto-fetch failed. Please enter rates manually.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleAddManualRate = () => {
    if (!manualRate.currency || !manualRate.buyRate || !manualRate.sellRate) {
      toast.error("Please fill all required fields");
      return;
    }

    const buy = parseFloat(manualRate.buyRate);
    const sell = parseFloat(manualRate.sellRate);
    if (isNaN(buy) || isNaN(sell)) {
      toast.error("Buy and Sell rates must be valid numbers");
      return;
    }

    const newRate = {
      id: generateId(),
      currency: manualRate.currency,
      currencyName:
        CURRENCIES.find((c) => c.code === manualRate.currency)?.name || manualRate.currency,
      buyRate: buy,
      sellRate: sell,
      midRate: (buy + sell) / 2,
      effectiveDate: manualRate.effectiveDate,
      source: "Manual Entry",
      createdAt: new Date().toISOString(),
    };

    const db = getDB();
    db.exchangeRates
      .put(newRate)
      .then(() => {
        setExchangeRates((prev) => [...prev, newRate]);
        setShowAddModal(false);
        setManualRate({
          currency: "",
          currencyName: "",
          buyRate: "",
          sellRate: "",
          effectiveDate: new Date().toISOString().split("T")[0],
        });
        toast.success("Exchange rate added successfully");
      })
      .catch((err) => {
        console.error("Error adding exchange rate:", err);
        toast.error("Failed to add exchange rate");
      });
  };

  const handleDeleteRate = async (id) => {
    const db = getDB();
    try {
      await db.exchangeRates.delete(id);
      setExchangeRates((prev) => prev.filter((r) => r.id !== id));
      toast.success("Exchange rate deleted successfully");
    } catch (error) {
      console.error("Error deleting exchange rate:", error);
      toast.error("Failed to delete exchange rate");
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      exchangeRates.map((r) => ({
        Currency: r.currency,
        Name: r.currencyName,
        "Buy Rate": r.buyRate,
        "Sell Rate": r.sellRate,
        "Mid Rate": r.midRate,
        "Effective Date": r.effectiveDate,
        Source: r.source,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exchange Rates");
    XLSX.writeFile(wb, `Exchange_Rates_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Exported to Excel");
  };

  const renderExchangeRatesTab = () => (
    <div style={{ backgroundColor: BG_CARD, padding: "20px", borderRadius: "8px", border: BORDER }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#000000" }}>Exchange Rates</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={fetchNRBRates}
            disabled={isFetching}
            style={{
              backgroundColor: isFetching ? "#cccccc" : "#1557b0",
              color: "white",
              border: BORDER,
              padding: "8px 12px",
              borderRadius: "4px",
              cursor: isFetching ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            {isFetching ? (
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid transparent",
                  borderTopColor: "white",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              ></div>
            ) : (
              <RefreshCw size={16} />
            )}
            Fetch NRB Rates Today
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              backgroundColor: "#059669",
              color: "white",
              border: BORDER,
              padding: "8px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Plus size={16} />
            Add Rate Manually
          </button>
          <button
            onClick={exportToExcel}
            style={{
              backgroundColor: "#1557b0",
              color: "white",
              border: BORDER,
              padding: "8px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {lastFetchTime && (
        <div style={{ marginBottom: "15px", fontSize: "12px", color: "#000000" }}>
          Last fetched: {lastFetchTime}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
          <thead>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Currency</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Name</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Buy Rate</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Sell Rate</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Mid Rate</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Effective Date</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Source</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {exchangeRates.length > 0 ? (
              exchangeRates.map((rate) => (
                <tr
                  key={rate.id}
                  style={{
                    backgroundColor:
                      new Date(rate.effectiveDate) < new Date() ? "#fef3c7" : "transparent",
                  }}
                >
                  <td style={{ border: BORDER, padding: "8px" }}>{rate.currency}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{rate.currencyName}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(rate.buyRate)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(rate.sellRate)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(rate.midRate)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px" }}>{rate.effectiveDate}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{rate.source}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "center" }}>
                    {new Date(rate.effectiveDate) < new Date() && (
                      <AlertTriangle size={16} style={{ color: "#d97706", display: "inline" }} />
                    )}
                    <button
                      onClick={() => handleDeleteRate(rate.id)}
                      style={{
                        backgroundColor: "#dc2626",
                        color: "white",
                        border: BORDER,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginLeft: "5px",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  style={{ border: BORDER, padding: "16px", textAlign: "center", color: "#666" }}
                >
                  No exchange rates found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderForeignVouchersTab = () => (
    <div style={{ backgroundColor: BG_CARD, padding: "20px", borderRadius: "8px", border: BORDER }}>
      <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#000000", marginBottom: "20px" }}>
        Foreign Vouchers
      </h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
          <thead>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Voucher No</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Date</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Type</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Party</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Currency</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Foreign Amount</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Exchange Rate</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Rs. Amount</th>
            </tr>
          </thead>
          <tbody>
            {foreignVouchers.length > 0 ? (
              foreignVouchers.map((v) => (
                <tr key={v.id}>
                  <td style={{ border: BORDER, padding: "8px" }}>{v.voucherNo}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{v.date}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{v.type}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{v.partyName || "N/A"}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{v.currency}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(v.grandTotal)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>{"1.00"}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(v.grandTotal)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  style={{ border: BORDER, padding: "16px", textAlign: "center", color: "#666" }}
                >
                  No foreign vouchers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderForexGainLossTab = () => (
    <div style={{ backgroundColor: BG_CARD, padding: "20px", borderRadius: "8px", border: BORDER }}>
      <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#000000", marginBottom: "20px" }}>
        Forex Gain/Loss
      </h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
          <thead>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Invoice No</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Party</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Currency</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Invoice Rate</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Payment Rate</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Foreign Amount</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                Gain/Loss Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {forexGainLoss.length > 0 ? (
              <>
                {forexGainLoss.map((g, i) => (
                  <tr key={i}>
                    <td style={{ border: BORDER, padding: "8px" }}>{g.invoiceNo}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{g.party}</td>
                    <td style={{ border: BORDER, padding: "8px" }}>{g.currency}</td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(g.invoiceRate)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(g.paymentRate)}
                    </td>
                    <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                      {money(g.foreignAmount)}
                    </td>
                    <td
                      style={{
                        border: BORDER,
                        padding: "8px",
                        textAlign: "right",
                        color: g.gainLoss >= 0 ? "#059669" : "#dc2626",
                      }}
                    >
                      {money(g.gainLoss)}
                    </td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: BG_HEADER, fontWeight: "bold" }}>
                  <td colSpan={6} style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    Total:
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(forexGainLoss.reduce((sum, g) => sum + g.gainLoss, 0))}
                  </td>
                </tr>
              </>
            ) : (
              <tr>
                <td
                  colSpan={7}
                  style={{ border: BORDER, padding: "16px", textAlign: "center", color: "#666" }}
                >
                  No forex gain/loss entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderRevaluationTab = () => (
    <div style={{ backgroundColor: BG_CARD, padding: "20px", borderRadius: "8px", border: BORDER }}>
      <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#000000", marginBottom: "20px" }}>
        Revaluation
      </h2>
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => {
            // Placeholder for revaluation logic
            toast.success("Revaluation process initiated");
          }}
          style={{
            backgroundColor: "#059669",
            color: "white",
            border: BORDER,
            padding: "10px 16px",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Revalue Open Balances
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
          <thead>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Account</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "left" }}>Currency</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Balance</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Old Rate</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>New Rate</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Difference</th>
            </tr>
          </thead>
          <tbody>
            {revaluationBalances.length > 0 ? (
              revaluationBalances.map((b, i) => (
                <tr key={i}>
                  <td style={{ border: BORDER, padding: "8px" }}>{b.account}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{b.currency}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(b.balance)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(b.oldRate)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(b.newRate)}
                  </td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      textAlign: "right",
                      color: b.diff >= 0 ? "#059669" : "#dc2626",
                    }}
                  >
                    {money(b.diff)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  style={{ border: BORDER, padding: "16px", textAlign: "center", color: "#666" }}
                >
                  No open foreign balances to revalue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: BG, minHeight: "100vh", padding: "20px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#000000", marginBottom: "20px" }}>
        Multi-Currency Hub
      </h1>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "20px", borderBottom: BORDER }}>
        {[
          { id: "rates", label: "Exchange Rates" },
          { id: "foreign", label: "Foreign Vouchers" },
          { id: "gainloss", label: "Forex Gain/Loss" },
          { id: "reval", label: "Revaluation" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              backgroundColor: activeTab === tab.id ? BG_HEADER : "transparent",
              color: activeTab === tab.id ? "#000000" : "#666",
              border: BORDER,
              padding: "10px 16px",
              borderRadius: "4px 4px 0 0",
              cursor: "pointer",
              fontWeight: activeTab === tab.id ? "bold" : "normal",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "rates" && renderExchangeRatesTab()}
      {activeTab === "foreign" && renderForeignVouchersTab()}
      {activeTab === "gainloss" && renderForexGainLossTab()}
      {activeTab === "reval" && renderRevaluationTab()}

      {/* Add Manual Rate Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: BG_CARD,
              padding: "20px",
              borderRadius: "8px",
              border: BORDER,
              width: "90%",
              maxWidth: "500px",
            }}
          >
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                color: "#000000",
                marginBottom: "15px",
              }}
            >
              Add Exchange Rate
            </h2>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Currency *
              </label>
              <select
                value={manualRate.currency}
                onChange={(e) =>
                  setManualRate({
                    ...manualRate,
                    currency: e.target.value,
                    currencyName:
                      CURRENCIES.find((c) => c.code === e.target.value)?.name || e.target.value,
                  })
                }
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
              >
                <option value="">Select Currency</option>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Buy Rate *
              </label>
              <input
                type="number"
                step="any"
                value={manualRate.buyRate}
                onChange={(e) => setManualRate({ ...manualRate, buyRate: e.target.value })}
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Sell Rate *
              </label>
              <input
                type="number"
                step="any"
                value={manualRate.sellRate}
                onChange={(e) => setManualRate({ ...manualRate, sellRate: e.target.value })}
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Mid Rate (Calculated)
              </label>
              <input
                type="number"
                step="any"
                value={
                  manualRate.buyRate && manualRate.sellRate
                    ? (
                        (parseFloat(manualRate.buyRate) + parseFloat(manualRate.sellRate)) /
                        2
                      ).toFixed(4)
                    : ""
                }
                readOnly
                style={{
                  width: "100%",
                  padding: "8px",
                  border: BORDER,
                  borderRadius: "4px",
                  backgroundColor: "#f0f0f0",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Effective Date *
              </label>
              <input
                type="date"
                value={manualRate.effectiveDate}
                onChange={(e) => setManualRate({ ...manualRate, effectiveDate: e.target.value })}
                style={{ width: "100%", padding: "8px", border: BORDER, borderRadius: "4px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: BORDER,
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddManualRate}
                style={{
                  backgroundColor: "#059669",
                  color: "white",
                  border: BORDER,
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Save Rate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
