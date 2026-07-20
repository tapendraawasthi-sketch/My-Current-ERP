import React, { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import toast from "@/lib/appToast";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  type EnterpriseColumnDef,
  formatAmountCell,
} from "@/design-system";

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

  const filteredAccounts = useMemo(
    () =>
      bankAccounts.filter(
        (acc) =>
          matchBranch(acc.branchId) &&
          (acc.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.accountNo.includes(searchTerm) ||
            acc.branch.toLowerCase().includes(searchTerm.toLowerCase())),
      ),
    [bankAccounts, searchTerm, matchBranch, branchFilter],
  );

  const columns = useMemo<EnterpriseColumnDef<BankAccount>[]>(
    () => [
      {
        id: "bankName",
        header: "Bank name",
        cell: (account) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{account.bankName}</span>
        ),
      },
      {
        id: "accountNo",
        header: "Account no",
        cell: (account) => (
          <span className="font-mono text-[12px] text-[var(--ds-text-default)]">{account.accountNo}</span>
        ),
      },
      {
        id: "branch",
        header: "Branch",
        cell: (account) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">{account.branch}</span>
        ),
      },
      {
        id: "accountLedger",
        header: "Account ledger",
        cell: (account) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">{account.accountLedger}</span>
        ),
      },
      {
        id: "openingBalance",
        header: "Opening balance",
        align: "right",
        financial: true,
        cell: (account) => formatAmountCell(account.openingBalance),
      },
      {
        id: "status",
        header: "Status",
        cell: (account) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              account.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {account.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

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
      toast.success("Bank account updated successfully");
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
      toast.success("Bank account added successfully");
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

  const handleDelete = (account: BankAccount) => {
    const snapshot = { ...account };
    const index = bankAccounts.findIndex((acc) => acc.id === account.id);
    setBankAccounts((prev) => prev.filter((acc) => acc.id !== account.id));
    toast.undo(`"${account.bankName}" deleted`, () => {
      setBankAccounts((prev) => {
        const next = [...prev];
        const insertAt = Math.min(Math.max(index, 0), next.length);
        next.splice(insertAt, 0, snapshot);
        return next;
      });
    });
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <PageHeader
        title="Bank accounts"
        description="Manage bank and cash accounts"
        meta={
          <PageMeta>
            {filteredAccounts.length} of {bankAccounts.length} accounts
          </PageMeta>
        }
        primaryAction={
          <Button
            variant="primary"
            size="small"
            onClick={() => setShowForm(true)}
            startIcon={<Plus className="h-3.5 w-3.5" />}
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

      <div className="relative w-fit">
        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-subtle)] pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search bank accounts..."
          className="h-8 pl-8 pr-3 text-[12px] border border-[var(--ds-border-default)] rounded-lg bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-72"
        />
      </div>

      <EnterpriseDataTable
        columns={columns}
        rows={filteredAccounts}
        getRowId={(account) => account.id}
        emptyTitle={searchTerm ? "No bank accounts match your search" : "No bank accounts found"}
        emptyDescription={
          searchTerm ? "Try a different search term." : "Add your first bank account."
        }
        emptyAction={
          !searchTerm ? (
            <Button
              variant="primary"
              size="small"
              onClick={() => setShowForm(true)}
              startIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Add bank account
            </Button>
          ) : undefined
        }
        onRowClick={handleEdit}
        rowActions={(account) => [
          { label: "Edit", onSelect: () => handleEdit(account) },
          { label: "Delete", destructive: true, onSelect: () => handleDelete(account) },
        ]}
        caption="Bank accounts"
      />

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">
              {selectedAccount ? "Edit Bank Account" : "Add Bank Account"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
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
                  <label className="block text-sm font-medium text-[#374151] mb-1">
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
                  <label className="block text-sm font-medium text-[#374151] mb-1">Branch *</label>
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
                  <label className="block text-sm font-medium text-[#374151] mb-1">
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
                  <label className="block text-sm font-medium text-[#374151] mb-1">
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
                  <label className="block text-sm font-medium text-[#374151] mb-1">
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
                  <label className="text-sm font-medium text-[#374151]">Is Active</label>
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
