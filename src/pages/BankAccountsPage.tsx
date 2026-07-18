import React, { useState } from "react";
import { Plus, Edit2, Trash2, Building } from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";
import { Button, PageHeader } from "@/design-system";

interface BankAccount {
  id: string;
  bankName: string;
  accountNo: string;
  branch: string;
  swiftIfsc?: string;
  accountLedger: string;
  openingBalance: number;
  isActive: boolean;
  branchId?: string;
}

export default function BankAccountsPage() {
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([
    {
      id: "1",
      bankName: "Nepal Bank Ltd.",
      accountNo: "00123456789",
      branch: "Kathmandu",
      swiftIfsc: "NEBLNPKA",
      accountLedger: "Nepal Bank - Current A/C",
      openingBalance: 500000,
      isActive: true,
    },
    {
      id: "2",
      bankName: "Nabil Bank",
      accountNo: "98765432100",
      branch: "New Road",
      swiftIfsc: "NARBNPKA",
      accountLedger: "Nabil Bank - Savings A/C",
      openingBalance: 250000,
      isActive: true,
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    bankName: "",
    accountNo: "",
    branch: "",
    swiftIfsc: "",
    accountLedger: "",
    openingBalance: "",
    isActive: true,
  });

  const bankLedgers = [
    "Nepal Bank - Current A/C",
    "Nepal Bank - Savings A/C",
    "Nabil Bank - Current A/C",
    "Nabil Bank - Savings A/C",
    "NIC Asia Bank - Current A/C",
    "Standard Chartered Bank - Current A/C",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedAccount) {
      setBankAccounts(
        bankAccounts.map((acc) =>
          acc.id === selectedAccount.id
            ? {
                ...acc,
                ...formData,
                openingBalance: parseFloat(formData.openingBalance) || 0,
                branchId: selectedAccount.branchId || readActiveBranchId() || undefined,
              }
            : acc,
        ),
      );
      alert("Bank account updated successfully");
    } else {
      setBankAccounts([
        ...bankAccounts,
        {
          id: Date.now().toString(),
          ...formData,
          openingBalance: parseFloat(formData.openingBalance) || 0,
          branchId: readActiveBranchId() || undefined,
        },
      ]);
      alert("Bank account added successfully");
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      bankName: "",
      accountNo: "",
      branch: "",
      swiftIfsc: "",
      accountLedger: "",
      openingBalance: "",
      isActive: true,
    });
    setSelectedAccount(null);
    setShowForm(false);
  };

  const handleEdit = (account: BankAccount) => {
    setSelectedAccount(account);
    setFormData({
      bankName: account.bankName,
      accountNo: account.accountNo,
      branch: account.branch,
      swiftIfsc: account.swiftIfsc || "",
      accountLedger: account.accountLedger,
      openingBalance: account.openingBalance.toString(),
      isActive: account.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this bank account?")) {
      setBankAccounts(bankAccounts.filter((acc) => acc.id !== id));
      alert("Bank account deleted successfully");
    }
  };

  const filteredAccounts = bankAccounts.filter(
    (acc) =>
      matchBranch(acc.branchId) &&
      (acc.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.accountNo.includes(searchTerm) ||
        acc.branch.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank accounts"
        description="Manage bank and cash accounts"
        primaryAction={
          <Button
            variant="primary"
            size="small"
            onClick={() => setShowForm(true)}
            startIcon={<Plus className="h-4 w-4" aria-hidden />}
          >
            Add bank account
          </Button>
        }
        secondaryActions={[
          ...(branchOptions.length > 0
            ? [
                <select
                  key="branch"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                  aria-label="Branch"
                >
                  <option value="all">All branches</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name || b.code || b.id}
                    </option>
                  ))}
                </select>,
              ]
            : []),
        ]}
      />

      <div className="bg-white p-4 rounded-lg shadow">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search bank accounts..."
          className="input"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[var(--ds-surface-muted)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#000000] uppercase">
                  Bank Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#000000] uppercase">
                  Account No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#000000] uppercase">
                  Branch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#000000] uppercase">
                  Account Ledger
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#000000] uppercase">
                  Opening Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#000000] uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#000000] uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#000000]">
                    <Building className="w-12 h-12 mx-auto mb-4 text-[#000000]" />
                    <p>No bank accounts found</p>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-[var(--ds-surface-muted)]">
                    <td className="px-6 py-4 text-sm font-medium text-[#000000]">
                      {account.bankName}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#000000] font-mono">
                      {account.accountNo}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#000000]">{account.branch}</td>
                    <td className="px-6 py-4 text-sm text-[#000000]">{account.accountLedger}</td>
                    <td className="px-6 py-4 text-sm text-right text-[#000000]">
                      Rs. {account.openingBalance.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          account.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {account.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(account)}
                          className="text-[var(--ds-action-primary)] hover:text-[#000000]"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(account.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">
              {selectedAccount ? "Edit Bank Account" : "Add Bank Account"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#000000] mb-1">
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="input"
                    required
                    placeholder="Nepal Bank Ltd."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#000000] mb-1">
                    Account No *
                  </label>
                  <input
                    type="text"
                    value={formData.accountNo}
                    onChange={(e) => setFormData({ ...formData, accountNo: e.target.value })}
                    className="input"
                    required
                    placeholder="00123456789"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#000000] mb-1">Branch *</label>
                  <input
                    type="text"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="input"
                    required
                    placeholder="Kathmandu"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#000000] mb-1">
                    SWIFT / IFSC Code
                  </label>
                  <input
                    type="text"
                    value={formData.swiftIfsc}
                    onChange={(e) => setFormData({ ...formData, swiftIfsc: e.target.value })}
                    className="input"
                    placeholder="NEBLNPKA"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[#000000] mb-1">
                    Link to Account Ledger *
                  </label>
                  <select
                    value={formData.accountLedger}
                    onChange={(e) => setFormData({ ...formData, accountLedger: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="">Select Ledger Account</option>
                    {bankLedgers.map((ledger) => (
                      <option key={ledger} value={ledger}>
                        {ledger}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#000000] mb-1">
                    Opening Balance
                  </label>
                  <input
                    type="number"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                    className="input"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-[var(--ds-border-default)]"
                  />
                  <label className="text-sm font-medium text-[#000000]">Is Active</label>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-[var(--ds-border-default)] rounded-lg hover:bg-[var(--ds-surface-muted)]"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {selectedAccount ? "Update" : "Add"} Bank Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
