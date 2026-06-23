import React, { useState, useMemo } from "react";
import { ActionToolbar } from "../components/ui";
import { Plus, Edit, TrendingUp, DollarSign, Calendar } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Input from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import Table from "../components/ui/Table";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import toast from "react-hot-toast";

const CurrencyMaster: React.FC = () => {
  const {
    currencies,
    exchangeRates,
    addCurrency,
    updateCurrency,
    addExchangeRate,
    getBaseCurrency,
  } = useStore();
  const baseCurrency = getBaseCurrency();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<any>(null);
  const [editingCurrency, setEditingCurrency] = useState<any>(null);

  const [currencyForm, setCurrencyForm] = useState({
    code: "",
    name: "",
    symbol: "",
    isBase: false,
    isActive: true,
  });

  const [rateForm, setRateForm] = useState({
    date: new Date().toISOString().split("T")[0],
    rateToBase: 0,
    source: "manual",
  });

  const handleAddCurrency = async () => {
    if (!currencyForm.code || !currencyForm.name || !currencyForm.symbol) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      if (editingCurrency) {
        await updateCurrency(editingCurrency.id, currencyForm);
      } else {
        await addCurrency(currencyForm);
      }
      setShowAddModal(false);
      setCurrencyForm({ code: "", name: "", symbol: "", isBase: false, isActive: true });
      setEditingCurrency(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to save currency");
    }
  };

  const handleEditCurrency = (currency: any) => {
    setEditingCurrency(currency);
    setCurrencyForm({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      isBase: currency.isBase,
      isActive: currency.isActive,
    });
    setShowAddModal(true);
  };

  const handleSetRate = (currency: any) => {
    setSelectedCurrency(currency);
    const latestRate = exchangeRates
      .filter((r) => r.currencyCode === currency.code)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    setRateForm({
      date: new Date().toISOString().split("T")[0],
      rateToBase: latestRate?.rateToBase || 0,
      source: "manual",
    });
    setShowRateModal(true);
  };

  const handleAddRate = async () => {
    if (!selectedCurrency || rateForm.rateToBase <= 0) {
      toast.error("Please enter a valid exchange rate");
      return;
    }

    try {
      await addExchangeRate({
        currencyCode: selectedCurrency.code,
        date: rateForm.date,
        rateToBase: rateForm.rateToBase,
        source: rateForm.source,
      });
      setShowRateModal(false);
      setSelectedCurrency(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to add exchange rate");
    }
  };

  const getRateHistory = (currencyCode: string, days: number = 30) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return exchangeRates
      .filter((r) => r.currencyCode === currencyCode && new Date(r.date) >= startDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: new Date(r.date).toLocaleDateString(),
        rate: r.rateToBase,
      }));
  };

  const getLatestRate = (currencyCode: string) => {
    const rates = exchangeRates
      .filter((r) => r.currencyCode === currencyCode)
      .sort((a, b) => b.date.localeCompare(a.date));
    return rates[0];
  };

  const currencyColumns = [
    {
      key: "code",
      header: "Code",
      render: (currency: any) => (
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-gray-400" />
          <span className="font-mono font-bold">{currency.code}</span>
          {currency.isBase && (
            <Badge variant="success" size="sm">
              BASE
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "name",
      header: "Name",
    },
    {
      key: "symbol",
      header: "Symbol",
      render: (currency: any) => <span className="text-lg font-bold">{currency.symbol}</span>,
    },
    {
      key: "rate",
      header: "Current Rate",
      render: (currency: any) => {
        if (currency.isBase) return <span className="text-gray-400">1.00</span>;
        const latest = getLatestRate(currency.code);
        return latest ? (
          <span className="font-mono font-semibold">
            {formatNumber(latest.rateToBase)} {baseCurrency?.code}
          </span>
        ) : (
          <span className="text-gray-400">Not set</span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (currency: any) => (
        <Badge variant={currency.isActive ? "success" : "danger"}>
          {currency.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (currency: any) => (
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handleEditCurrency(currency)}
            icon={<Edit className="h-3 w-3" />}
          >
            Edit
          </Button>
          {!currency.isBase && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => handleSetRate(currency)}
              icon={<TrendingUp className="h-3 w-3" />}
            >
              Set Rate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <ActionToolbar title="Currency Master" subtitle="Multi-currency setup and exchange rates" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Currency Master</h1>
          <p className="text-sm text-gray-500 mt-1">Manage currencies and exchange rates</p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setEditingCurrency(null);
            setCurrencyForm({ code: "", name: "", symbol: "", isBase: false, isActive: true });
            setShowAddModal(true);
          }}
          icon={<Plus className="h-4 w-4" />}
        >
          Add Currency
        </Button>
      </div>

      {/* Currencies Table */}
      <Card>
        <Table
          columns={currencyColumns}
          data={currencies}
          rowKey="id"
          emptyMessage="No currencies found"
        />
      </Card>

      {/* Exchange Rate History & Charts */}
      {currencies
        .filter((c) => !c.isBase && c.isActive)
        .map((currency) => {
          const history = getRateHistory(currency.code);
          const latest = getLatestRate(currency.code);

          return (
            <Card key={currency.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {currency.code} - {currency.name}
                  </h3>
                  {latest && (
                    <p className="text-sm text-gray-500 mt-1">
                      Current Rate:{" "}
                      <span className="font-mono font-semibold">
                        {formatNumber(latest.rateToBase)} {baseCurrency?.code}
                      </span>
                      <span className="mx-2">â€¢</span>
                      Last Updated: {new Date(latest.date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSetRate(currency)}
                  icon={<Calendar className="h-4 w-4" />}
                >
                  Set Today's Rate
                </Button>
              </div>

              {/* Chart */}
              {history.length > 0 ? (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-600 mb-3">
                    30-Day Exchange Rate Trend
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" domain={["auto", "auto"]} />
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          backgroundColor: "#f9fafb",
                          border: "1px solid #e5e7eb",
                        }}
                        formatter={(value: any) => [formatNumber(value), "Rate"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: "#3b82f6", r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No exchange rate history available</p>
                </div>
              )}

              {/* Rate History Table */}
              {history.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-2">Recent Rate History</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-y border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-right">Rate to {baseCurrency?.code}</th>
                          <th className="px-3 py-2 text-center">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {exchangeRates
                          .filter((r) => r.currencyCode === currency.code)
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .slice(0, 10)
                          .map((rate, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                {new Date(rate.date).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {formatNumber(rate.rateToBase)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Badge
                                  variant={rate.source === "auto" ? "info" : "default"}
                                  size="sm"
                                >
                                  {rate.source}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          );
        })}

      {/* Add/Edit Currency Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingCurrency(null);
        }}
        title={editingCurrency ? "Edit Currency" : "Add New Currency"}
      >
        <div className="space-y-4">
          <Input
            label="Currency Code"
            value={currencyForm.code}
            onChange={(v) => setCurrencyForm((prev) => ({ ...prev, code: v.toUpperCase() }))}
            placeholder="e.g., USD, EUR, GBP"
            required
            disabled={!!editingCurrency}
            maxLength={3}
          />
          <Input
            label="Currency Name"
            value={currencyForm.name}
            onChange={(v) => setCurrencyForm((prev) => ({ ...prev, name: v }))}
            placeholder="e.g., US Dollar"
            required
          />
          <Input
            label="Symbol"
            value={currencyForm.symbol}
            onChange={(v) => setCurrencyForm((prev) => ({ ...prev, symbol: v }))}
            placeholder="e.g., $, â‚¬, Â£"
            required
          />
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={currencyForm.isBase}
                onChange={(e) => setCurrencyForm((prev) => ({ ...prev, isBase: e.target.checked }))}
                className="h-4 w-4 accent-blue-600"
                disabled={!!editingCurrency && editingCurrency.isBase}
              />
              <span className="text-sm font-medium text-gray-700">Set as Base Currency</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={currencyForm.isActive}
                onChange={(e) =>
                  setCurrencyForm((prev) => ({ ...prev, isActive: e.target.checked }))
                }
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setEditingCurrency(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddCurrency}>
              {editingCurrency ? "Update" : "Add"} Currency
            </Button>
          </div>
        </div>
      </Modal>

      {/* Set Exchange Rate Modal */}
      <Modal
        isOpen={showRateModal}
        onClose={() => {
          setShowRateModal(false);
          setSelectedCurrency(null);
        }}
        title={`Set Exchange Rate - ${selectedCurrency?.code}`}
      >
        <div className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={rateForm.date}
            onChange={(v) => setRateForm((prev) => ({ ...prev, date: v }))}
            required
          />
          <Input
            label={`Rate (1 ${selectedCurrency?.code} = X ${baseCurrency?.code})`}
            type="number"
            value={rateForm.rateToBase}
            onChange={(v) => setRateForm((prev) => ({ ...prev, rateToBase: parseFloat(v) || 0 }))}
            placeholder="e.g., 133.50"
            required
            step="0.01"
          />
          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowRateModal(false);
                setSelectedCurrency(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddRate}>
              Set Rate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CurrencyMaster;
