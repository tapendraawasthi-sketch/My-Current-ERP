import React, { useState } from "react";
import { ActionToolbar } from "../components/ui";
import { Save, FileText } from "lucide-react";

export default function TdsPayment() {
  const [formData, setFormData] = useState({
    tdsType: "",
    period: "",
    amount: "",
    depositDate: "",
    bank: "",
    challanNo: "",
    description: "",
  });
  const [payments, setPayments] = useState([
    {
      id: "1",
      tdsType: "194C - Contractor",
      period: "January 2024",
      amount: 15000,
      depositDate: "2024-02-07",
      bank: "Nepal Bank Ltd.",
      challanNo: "CH001234",
      description: "TDS payment for January",
    },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPayments([
      ...payments,
      {
        id: Date.now().toString(),
        ...formData,
        amount: parseFloat(formData.amount),
      },
    ]);
    setFormData({
      tdsType: "",
      period: "",
      amount: "",
      depositDate: "",
      bank: "",
      challanNo: "",
      description: "",
    });
    alert("TDS payment recorded successfully");
  };

  return (
    <div className="space-y-6">
      <ActionToolbar title="TDS Payment" subtitle="Tax Deducted at Source remittance" />
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">TDS Payment</h1>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Record TDS Deposit</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TDS Type *</label>
              <select
                value={formData.tdsType}
                onChange={(e) => setFormData({ ...formData, tdsType: e.target.value })}
                className="input"
                required
              >
                <option value="">Select TDS Type</option>
                <option value="194C - Contractor">194C - Payment to Contractor</option>
                <option value="194J - Professional">194J - Professional/Technical Fees</option>
                <option value="194H - Commission">194H - Commission/Brokerage</option>
                <option value="194I - Rent">194I - Rent Payment</option>
                <option value="194A - Interest">194A - Interest</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period (Month) *
              </label>
              <input
                type="month"
                value={formData.period}
                onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="input"
                required
                placeholder="0.00"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Date *</label>
              <input
                type="date"
                value={formData.depositDate}
                onChange={(e) => setFormData({ ...formData, depositDate: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank *</label>
              <select
                value={formData.bank}
                onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                className="input"
                required
              >
                <option value="">Select Bank</option>
                <option value="Nepal Bank Ltd.">Nepal Bank Ltd.</option>
                <option value="Rastriya Banijya Bank">Rastriya Banijya Bank</option>
                <option value="Agriculture Development Bank">Agriculture Development Bank</option>
                <option value="Nabil Bank">Nabil Bank</option>
                <option value="Nepal Investment Bank">Nepal Investment Bank</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Challan No *</label>
              <input
                type="text"
                value={formData.challanNo}
                onChange={(e) => setFormData({ ...formData, challanNo: e.target.value })}
                className="input"
                required
                placeholder="CH001234"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows={2}
                placeholder="TDS payment for..."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary flex items-center space-x-2">
              <Save className="w-4 h-4" />
              <span>Record Payment</span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Payment History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  TDS Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Period
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Deposit Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Bank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Challan No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{payment.tdsType}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{payment.period}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                    Rs. {payment.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(payment.depositDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{payment.bank}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-mono">{payment.challanNo}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{payment.description}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <button className="text-[#1557b0] hover:text-indigo-900">
                      <FileText className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
