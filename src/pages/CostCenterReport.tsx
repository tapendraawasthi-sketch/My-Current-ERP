import React, { useState } from "react";
import { ActionToolbar } from "../components/ui";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface CostCenterData {
  costCenter: string;
  costCenterCode: string;
  accounts: AccountData[];
  totalBudgeted: number;
  totalActual: number;
  totalVariance: number;
  percentAchieved: number;
}

interface AccountData {
  accountName: string;
  accountCode: string;
  budgeted: number;
  actual: number;
  variance: number;
  percentAchieved: number;
  transactions?: Transaction[];
}

interface Transaction {
  id: string;
  date: string;
  voucherNo: string;
  description: string;
  amount: number;
}

export default function CostCenterReport() {
  const [filters, setFilters] = useState({
    costCenter: "",
    startDate: "",
    endDate: "",
  });
  const [expandedCenters, setExpandedCenters] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  const costCenterData: CostCenterData[] = [
    {
      costCenter: "Head Office - Administration",
      costCenterCode: "HO-ADM",
      totalBudgeted: 500000,
      totalActual: 425000,
      totalVariance: 75000,
      percentAchieved: 85,
      accounts: [
        {
          accountName: "Salary & Wages",
          accountCode: "5001",
          budgeted: 300000,
          actual: 300000,
          variance: 0,
          percentAchieved: 100,
          transactions: [
            {
              id: "T1",
              date: "2024-01-15",
              voucherNo: "PAY001",
              description: "January Salary Payment",
              amount: 150000,
            },
            {
              id: "T2",
              date: "2024-02-15",
              voucherNo: "PAY015",
              description: "February Salary Payment",
              amount: 150000,
            },
          ],
        },
        {
          accountName: "Office Supplies",
          accountCode: "5010",
          budgeted: 50000,
          actual: 35000,
          variance: 15000,
          percentAchieved: 70,
          transactions: [
            {
              id: "T3",
              date: "2024-01-10",
              voucherNo: "PAY002",
              description: "Stationery Purchase",
              amount: 20000,
            },
            {
              id: "T4",
              date: "2024-02-05",
              voucherNo: "PAY016",
              description: "Office Supplies",
              amount: 15000,
            },
          ],
        },
        {
          accountName: "Utilities",
          accountCode: "5020",
          budgeted: 150000,
          actual: 90000,
          variance: 60000,
          percentAchieved: 60,
          transactions: [
            {
              id: "T5",
              date: "2024-01-20",
              voucherNo: "PAY005",
              description: "Electricity Bill",
              amount: 45000,
            },
            {
              id: "T6",
              date: "2024-02-20",
              voucherNo: "PAY020",
              description: "Water & Electricity",
              amount: 45000,
            },
          ],
        },
      ],
    },
    {
      costCenter: "Kathmandu Branch",
      costCenterCode: "BR-KTM",
      totalBudgeted: 750000,
      totalActual: 680000,
      totalVariance: 70000,
      percentAchieved: 90.67,
      accounts: [
        {
          accountName: "Staff Salary",
          accountCode: "5001",
          budgeted: 500000,
          actual: 500000,
          variance: 0,
          percentAchieved: 100,
          transactions: [],
        },
        {
          accountName: "Rent",
          accountCode: "5030",
          budgeted: 150000,
          actual: 120000,
          variance: 30000,
          percentAchieved: 80,
          transactions: [],
        },
        {
          accountName: "Marketing",
          accountCode: "5040",
          budgeted: 100000,
          actual: 60000,
          variance: 40000,
          percentAchieved: 60,
          transactions: [],
        },
      ],
    },
    {
      costCenter: "Project Alpha",
      costCenterCode: "PRJ-ALPHA",
      totalBudgeted: 1000000,
      totalActual: 1050000,
      totalVariance: -50000,
      percentAchieved: 105,
      accounts: [
        {
          accountName: "Project Materials",
          accountCode: "5050",
          budgeted: 600000,
          actual: 650000,
          variance: -50000,
          percentAchieved: 108.33,
          transactions: [],
        },
        {
          accountName: "Contractor Payments",
          accountCode: "5060",
          budgeted: 400000,
          actual: 400000,
          variance: 0,
          percentAchieved: 100,
          transactions: [],
        },
      ],
    },
  ];

  const toggleCostCenter = (code: string) => {
    const newExpanded = new Set(expandedCenters);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedCenters(newExpanded);
  };

  const toggleAccount = (key: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedAccounts(newExpanded);
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return "text-green-600";
    if (variance < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getPercentageColor = (percent: number) => {
    if (percent <= 80) return "text-green-600";
    if (percent <= 100) return "text-yellow-600";
    return "text-red-600";
  };

  const totalBudgeted = costCenterData.reduce((sum, cc) => sum + cc.totalBudgeted, 0);
  const totalActual = costCenterData.reduce((sum, cc) => sum + cc.totalActual, 0);
  const totalVariance = totalBudgeted - totalActual;
  const overallPercent = (totalActual / totalBudgeted) * 100;

  return (
    <div className="space-y-6">
      <ActionToolbar title="Cost Center Report" subtitle="Expenses and income by cost center" />
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Cost Center Report</h1>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Budgeted</p>
              <p className="text-2xl font-bold text-gray-900">
                Rs. {totalBudgeted.toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-[#1557b0]" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Actual</p>
              <p className="text-2xl font-bold text-gray-900">Rs. {totalActual.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Variance</p>
              <p className={`text-2xl font-bold ${getVarianceColor(totalVariance)}`}>
                Rs. {Math.abs(totalVariance).toLocaleString()}
              </p>
            </div>
            {totalVariance >= 0 ? (
              <TrendingDown className="w-12 h-12 text-green-600" />
            ) : (
              <TrendingUp className="w-12 h-12 text-red-600" />
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overall Utilization</p>
              <p className={`text-2xl font-bold ${getPercentageColor(overallPercent)}`}>
                {overallPercent.toFixed(1)}%
              </p>
            </div>
            <div className="w-16 h-16 relative">
              <svg className="transform -rotate-90 w-16 h-16">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-gray-200"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - overallPercent / 100)}`}
                  className={getPercentageColor(overallPercent)}
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cost Center</label>
            <select
              value={filters.costCenter}
              onChange={(e) => setFilters({ ...filters, costCenter: e.target.value })}
              className="input"
            >
              <option value="">All Cost Centers</option>
              {costCenterData.map((cc) => (
                <option key={cc.costCenterCode} value={cc.costCenterCode}>
                  {cc.costCenter}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Account / Cost Center
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Budgeted
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actual
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Variance
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                % Achieved
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {costCenterData.map((cc) => (
              <React.Fragment key={cc.costCenterCode}>
                <tr className="bg-indigo-50 cursor-pointer hover:bg-indigo-100">
                  <td
                    onClick={() => toggleCostCenter(cc.costCenterCode)}
                    className="px-6 py-4 whitespace-nowrap"
                  >
                    <div className="flex items-center space-x-2">
                      {expandedCenters.has(cc.costCenterCode) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span className="font-semibold text-gray-900">{cc.costCenter}</span>
                      <span className="text-xs text-gray-500">({cc.costCenterCode})</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">
                    Rs. {cc.totalBudgeted.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">
                    Rs. {cc.totalActual.toLocaleString()}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-right font-semibold ${getVarianceColor(
                      cc.totalVariance,
                    )}`}
                  >
                    Rs. {Math.abs(cc.totalVariance).toLocaleString()}
                    {cc.totalVariance >= 0 ? " (Under)" : " (Over)"}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-right font-semibold ${getPercentageColor(
                      cc.percentAchieved,
                    )}`}
                  >
                    {cc.percentAchieved.toFixed(1)}%
                  </td>
                </tr>

                {expandedCenters.has(cc.costCenterCode) &&
                  cc.accounts.map((acc) => {
                    const accountKey = `${cc.costCenterCode}-${acc.accountCode}`;
                    return (
                      <React.Fragment key={accountKey}>
                        <tr className="bg-gray-50 hover:bg-gray-100">
                          <td
                            onClick={() => toggleAccount(accountKey)}
                            className="px-6 py-3 whitespace-nowrap cursor-pointer"
                          >
                            <div className="flex items-center space-x-2 pl-8">
                              {acc.transactions && acc.transactions.length > 0 ? (
                                expandedAccounts.has(accountKey) ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )
                              ) : (
                                <span className="w-3 h-3" />
                              )}
                              <span className="text-gray-900">{acc.accountName}</span>
                              <span className="text-xs text-gray-500">({acc.accountCode})</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-right text-gray-900">
                            Rs. {acc.budgeted.toLocaleString()}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-right text-gray-900">
                            Rs. {acc.actual.toLocaleString()}
                          </td>
                          <td
                            className={`px-6 py-3 whitespace-nowrap text-right ${getVarianceColor(
                              acc.variance,
                            )}`}
                          >
                            Rs. {Math.abs(acc.variance).toLocaleString()}
                          </td>
                          <td
                            className={`px-6 py-3 whitespace-nowrap text-right ${getPercentageColor(
                              acc.percentAchieved,
                            )}`}
                          >
                            {acc.percentAchieved.toFixed(1)}%
                          </td>
                        </tr>

                        {expandedAccounts.has(accountKey) &&
                          acc.transactions?.map((txn) => (
                            <tr key={txn.id} className="bg-white hover:bg-gray-50">
                              <td className="px-6 py-2 text-sm pl-20">
                                <div className="text-gray-600">
                                  {new Date(txn.date).toLocaleDateString()} - {txn.voucherNo}
                                  <div className="text-xs text-gray-500">{txn.description}</div>
                                </div>
                              </td>
                              <td colSpan={2}></td>
                              <td className="px-6 py-2 text-sm text-right text-gray-900">
                                Rs. {txn.amount.toLocaleString()}
                              </td>
                              <td></td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
