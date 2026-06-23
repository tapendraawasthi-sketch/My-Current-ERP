import React, { useState } from "react";
import { Save, Download, Upload, AlertCircle } from "lucide-react";
import { useStore } from "../store";
import { PartyType } from "../lib/types";
import { ActionToolbar } from "../components/ui";

interface Balance {
  accountId: string;
  accountName: string;
  accountCode: string;
  debit: number;
  credit: number;
}

interface PartyBalance {
  partyId: string;
  partyName: string;
  partyType: string;
  debit: number;
  credit: number;
}

interface StockBalance {
  itemId: string;
  itemName: string;
  warehouse: string;
  quantity: number;
  rate: number;
  value: number;
}

export default function OpeningBalance() {
  const { accounts, parties, items, fiscalYears, currentFiscalYear } = useStore();
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("2083/84");
  const [asOfDate, setAsOfDate] = useState<string>(
    () => currentFiscalYear?.startDate || new Date().toISOString().split("T")[0],
  );
  const [activeTab, setActiveTab] = useState<"accounts" | "parties" | "stock">("accounts");

  const [accountBalances, setAccountBalances] = useState<Balance[]>(
    accounts.map((l) => ({
      accountId: l.id,
      accountName: l.name,
      accountCode: l.code,
      debit: 0,
      credit: 0,
    })),
  );

  const [partyBalances, setPartyBalances] = useState<PartyBalance[]>(() => {
    const customers = parties.filter(
      (p) => p.type === PartyType.CUSTOMER || p.type === PartyType.BOTH,
    );
    const suppliers = parties.filter(
      (p) => p.type === PartyType.SUPPLIER || p.type === PartyType.BOTH,
    );
    return [
      ...customers.map((c) => ({
        partyId: c.id,
        partyName: c.name,
        partyType: "Customer",
        debit: 0,
        credit: 0,
      })),
      ...suppliers.map((s) => ({
        partyId: s.id,
        partyName: s.name,
        partyType: "Supplier",
        debit: 0,
        credit: 0,
      })),
    ];
  });

  const [stockBalances, setStockBalances] = useState<StockBalance[]>(
    items.map((p) => ({
      itemId: p.id,
      itemName: p.name,
      warehouse: "Main Warehouse",
      quantity: 0,
      rate: 0,
      value: 0,
    })),
  );

  const updateAccountBalance = (accountId: string, field: "debit" | "credit", value: number) => {
    setAccountBalances(
      accountBalances.map((b) => (b.accountId === accountId ? { ...b, [field]: value } : b)),
    );
  };

  const updatePartyBalance = (partyId: string, field: "debit" | "credit", value: number) => {
    setPartyBalances(
      partyBalances.map((b) => (b.partyId === partyId ? { ...b, [field]: value } : b)),
    );
  };

  const updateStockBalance = (itemId: string, field: "quantity" | "rate", value: number) => {
    setStockBalances(
      stockBalances.map((b) => {
        if (b.itemId === itemId) {
          const updated = { ...b, [field]: value };
          updated.value = updated.quantity * updated.rate;
          return updated;
        }
        return b;
      }),
    );
  };

  const totalDebit = accountBalances.reduce((sum, b) => sum + b.debit, 0);
  const totalCredit = accountBalances.reduce((sum, b) => sum + b.credit, 0);
  const difference = totalDebit - totalCredit;

  const debitAccounts = accountBalances.filter(
    (b) =>
      accounts.find((l) => l.id === b.accountId)?.group?.includes("Asset") ||
      accounts.find((l) => l.id === b.accountId)?.group?.includes("Expense"),
  );

  const creditAccounts = accountBalances.filter(
    (b) =>
      accounts.find((l) => l.id === b.accountId)?.group?.includes("Liability") ||
      accounts.find((l) => l.id === b.accountId)?.group?.includes("Income") ||
      accounts.find((l) => l.id === b.accountId)?.group?.includes("Capital"),
  );

  const handlePost = () => {
    if (Math.abs(difference) > 0.01) {
      alert("Total Debit must equal Total Credit. Please check your entries.");
      return;
    }

    if (confirm("Post opening balances? This will create journal entries.")) {
      alert("Opening balances posted successfully!");
    }
  };

  const handleCarryForward = () => {
    if (confirm("Carry forward closing balances from previous fiscal year?")) {
      alert("Balances carried forward successfully!");
    }
  };

  return (
    <div className="space-y-6">
      <ActionToolbar
        title="Opening Balance"
        subtitle="Set initial account balances for the fiscal year"
        primaryAction={{
          label: "Post Opening Balances",
          onClick: handlePost,
          icon: <Save className="w-4 h-4" />,
        }}
      />

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year</label>
            <select
              value={selectedFiscalYear}
              onChange={(e) => setSelectedFiscalYear(e.target.value)}
              className="input"
            >
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.name}>
                  {fy.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">As of Date</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleCarryForward}
              className="btn-primary flex items-center space-x-2 w-full"
            >
              <Download className="w-4 h-4" />
              <span>Carry Forward from Previous Year</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
          <div className="text-[12px] text-blue-700">
            <span className="font-bold">Total Debit: </span>
            {totalDebit.toFixed(2)}
          </div>
          <div
            className={`text-[12px] font-bold ${Math.abs(totalDebit - totalCredit) < 0.01 ? "text-green-700" : "text-red-600"}`}
          >
            {Math.abs(totalDebit - totalCredit) < 0.01
              ? "✓ Balanced"
              : `Diff: ${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
          </div>
          <div className="text-[12px] text-blue-700">
            <span className="font-bold">Total Credit: </span>
            {totalCredit.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="border-b">
        <nav className="flex space-x-8">
          {[
            { id: "accounts", label: "Account Opening Balances" },
            { id: "parties", label: "Party Opening Balances" },
            { id: "stock", label: "Opening Stock" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-[#1557b0] text-[#1557b0]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "accounts" && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="bg-green-50 px-6 py-3 border-b">
              <h3 className="font-semibold text-green-900">Debit Accounts (Assets & Expenses)</h3>
            </div>
            <div className="overflow-auto max-h-96">
              <table className="data-table">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      Account
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                      Dr Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {debitAccounts.map((acc) => (
                    <tr key={acc.accountId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">
                        <div>{acc.accountName}</div>
                        <div className="text-xs text-gray-500">{acc.accountCode}</div>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={acc.debit || ""}
                          onChange={(e) =>
                            updateAccountBalance(
                              acc.accountId,
                              "debit",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="input text-right w-full"
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="bg-blue-50 px-6 py-3 border-b">
              <h3 className="font-semibold text-blue-900">
                Credit Accounts (Liabilities & Income)
              </h3>
            </div>
            <div className="overflow-auto max-h-96">
              <table className="data-table">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      Account
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                      Cr Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {creditAccounts.map((acc) => (
                    <tr key={acc.accountId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">
                        <div>{acc.accountName}</div>
                        <div className="text-xs text-gray-500">{acc.accountCode}</div>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={acc.credit || ""}
                          onChange={(e) =>
                            updateAccountBalance(
                              acc.accountId,
                              "credit",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="input text-right w-full"
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "parties" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="data-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Party Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Opening Dr
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Opening Cr
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {partyBalances.map((party) => (
                <tr key={party.partyId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{party.partyName}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        party.partyType === "Customer"
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {party.partyType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="number"
                      value={party.debit || ""}
                      onChange={(e) =>
                        updatePartyBalance(party.partyId, "debit", parseFloat(e.target.value) || 0)
                      }
                      className="input text-right w-32"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="number"
                      value={party.credit || ""}
                      onChange={(e) =>
                        updatePartyBalance(party.partyId, "credit", parseFloat(e.target.value) || 0)
                      }
                      className="input text-right w-32"
                      placeholder="0.00"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "stock" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="data-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Qty
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Rate
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stockBalances.map((item) => (
                <tr key={item.itemId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{item.itemName}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.warehouse}</td>
                  <td className="px-6 py-4">
                    <input
                      type="number"
                      value={item.quantity || ""}
                      onChange={(e) =>
                        updateStockBalance(item.itemId, "quantity", parseFloat(e.target.value) || 0)
                      }
                      className="input text-right w-24"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="number"
                      value={item.rate || ""}
                      onChange={(e) =>
                        updateStockBalance(item.itemId, "rate", parseFloat(e.target.value) || 0)
                      }
                      className="input text-right w-28"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                    {item.value.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
