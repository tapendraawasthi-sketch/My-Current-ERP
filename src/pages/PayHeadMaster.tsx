import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store";
import { Plus, X, Save, Search } from "lucide-react";
import toast from "@/lib/appToast";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  type EnterpriseColumnDef,
} from "@/design-system";

const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const labelCls = "text-[12px] font-medium text-gray-600 mb-1 block";

const emptyForm = () => ({
  name: "",
  payHeadType: "",
  accountId: "",
  affectsNetSalary: true,
  calculationType: "flat_rate",
  calculationPeriod: "monthly",
  rate: 0,
  percentage: 0,
  basedOnPayHeadId: "",
  formula: "",
  roundingMethod: "normal",
  ssfApplicable: false,
  citApplicable: false,
  incomeTaxApplicable: false,
  pfApplicable: false,
  isActive: true,
});

const PayHeadMaster: React.FC = () => {
  const { payHeads, addPayHead, updatePayHead, deletePayHead, accounts, initLifecycle } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [seedDone, setSeedDone] = useState(false);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if ((payHeads || []).length === 0 && !seedDone) {
      setSeedDone(true);
      const seedData = [
        {
          name: "Basic Salary",
          payHeadType: "earnings",
          affectsNetSalary: true,
          calculationType: "flat_rate",
          calculationPeriod: "monthly",
          rate: 0,
          roundingMethod: "normal",
          ssfApplicable: true,
          citApplicable: false,
          incomeTaxApplicable: true,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "House Rent Allowance",
          payHeadType: "earnings",
          affectsNetSalary: true,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 10,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: true,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "Transport Allowance",
          payHeadType: "earnings",
          affectsNetSalary: true,
          calculationType: "flat_rate",
          calculationPeriod: "monthly",
          rate: 0,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: true,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "Dashain Allowance",
          payHeadType: "earnings",
          affectsNetSalary: true,
          calculationType: "flat_rate",
          calculationPeriod: "monthly",
          rate: 0,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: true,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "SSF Employee Contribution (11%)",
          payHeadType: "deductions",
          affectsNetSalary: true,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 11,
          roundingMethod: "normal",
          ssfApplicable: true,
          citApplicable: false,
          incomeTaxApplicable: false,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "SSF Employer Contribution (20%)",
          payHeadType: "employer_contribution",
          affectsNetSalary: false,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 20,
          roundingMethod: "normal",
          ssfApplicable: true,
          citApplicable: false,
          incomeTaxApplicable: false,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "Income Tax (TDS on Salary)",
          payHeadType: "deductions",
          affectsNetSalary: true,
          calculationType: "formula",
          calculationPeriod: "monthly",
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: true,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "CIT Deduction",
          payHeadType: "deductions",
          affectsNetSalary: true,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 10,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: true,
          incomeTaxApplicable: false,
          pfApplicable: false,
          isActive: true,
        },
        {
          name: "EPF Employee Contribution (10%)",
          payHeadType: "deductions",
          affectsNetSalary: true,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 10,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: false,
          pfApplicable: true,
          isActive: true,
        },
        {
          name: "EPF Employer Contribution (10%)",
          payHeadType: "employer_contribution",
          affectsNetSalary: false,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 10,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: false,
          pfApplicable: true,
          isActive: true,
        },
        {
          name: "Provident Fund Employee (10%)",
          payHeadType: "deductions",
          affectsNetSalary: true,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 10,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: false,
          pfApplicable: true,
          isActive: true,
        },
        {
          name: "Provident Fund Employer (10%)",
          payHeadType: "employer_contribution",
          affectsNetSalary: false,
          calculationType: "pct_of_basic",
          calculationPeriod: "monthly",
          percentage: 10,
          roundingMethod: "normal",
          ssfApplicable: false,
          citApplicable: false,
          incomeTaxApplicable: false,
          pfApplicable: true,
          isActive: true,
        },
      ];

      seedData.forEach(async (item) => {
        await addPayHead(item);
      });
    }
  }, [payHeads, seedDone, addPayHead]);

  const filteredHeads = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = payHeads || [];
    return list.filter((head) => {
      if (!matchBranch((head as { branchId?: string }).branchId)) return false;
      if (!q) return true;
      return head.name.toLowerCase().includes(q) || head.payHeadType.toLowerCase().includes(q);
    });
  }, [payHeads, searchTerm, matchBranch, branchFilter]);

  const resetForm = () => {
    setForm(emptyForm());
    setSelected(null);
    setShowForm(false);
  };

  const openAdd = () => {
    setForm(emptyForm());
    setSelected(null);
    setShowForm(true);
  };

  const loadFormForEdit = (head: any) => {
    setForm({
      name: head.name || "",
      payHeadType: head.payHeadType || "",
      accountId: head.accountId || "",
      affectsNetSalary: head.affectsNetSalary ?? true,
      calculationType: head.calculationType || "flat_rate",
      calculationPeriod: head.calculationPeriod || "monthly",
      rate: head.rate || 0,
      percentage: head.percentage || 0,
      basedOnPayHeadId: head.basedOnPayHeadId || "",
      formula: head.formula || "",
      roundingMethod: head.roundingMethod || "normal",
      ssfApplicable: head.ssfApplicable ?? false,
      citApplicable: head.citApplicable ?? false,
      incomeTaxApplicable: head.incomeTaxApplicable ?? false,
      pfApplicable: head.pfApplicable ?? false,
      isActive: head.isActive ?? true,
    });
    setSelected(head);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Pay Head Name is required");
      return;
    }
    if (!form.payHeadType) {
      toast.error("Pay Head Type is required");
      return;
    }

    try {
      if (selected) {
        await updatePayHead(selected.id, {
          ...form,
          branchId: selected.branchId || readActiveBranchId() || undefined,
        } as any);
        toast.success("Updated successfully");
      } else {
        await addPayHead({
          ...form,
          branchId: readActiveBranchId() || undefined,
        } as any);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (head: { id: string; name: string; [key: string]: unknown }) => {
    const snapshot = { ...head };
    try {
      await deletePayHead(head.id);
      toast.undo(`"${head.name}" deleted`, async () => {
        try {
          await addPayHead(snapshot as any);
        } catch (error) {
          console.error("Restore error:", error);
          toast.error("Failed to restore pay head");
        }
      });
      if (selected && selected.id === head.id) {
        resetForm();
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("An error occurred while deleting.");
    }
  };

  const getPayHeadTypeLabel = (type: string) => {
    switch (type) {
      case "earnings":
        return "Earnings";
      case "deductions":
        return "Deductions";
      case "employer_contribution":
        return "Employer Contribution";
      case "reimbursement":
        return "Reimbursement";
      case "loans_advances":
        return "Loans & Advances";
      case "statutory":
        return "Statutory";
      default:
        return type;
    }
  };

  const getCalculationTypeLabel = (type: string) => {
    switch (type) {
      case "flat_rate":
        return "Flat Rate";
      case "pct_of_basic":
        return "% of Basic";
      case "pct_of_gross":
        return "% of Gross";
      case "attendance_based":
        return "Attendance Based";
      case "production_based":
        return "Production Based";
      case "formula":
        return "Formula";
      case "user_defined":
        return "User Defined";
      default:
        return type;
    }
  };

  const rateDisplay = (head: any) => {
    if (head.calculationType === "flat_rate" || head.calculationType === "attendance_based") {
      return `Rs. ${head.rate}`;
    }
    if (head.percentage) return `${head.percentage}%`;
    return "—";
  };

  const columns = useMemo<EnterpriseColumnDef<any>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (head) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">{head.name}</span>
        ),
      },
      {
        id: "payHeadType",
        header: "Type",
        cell: (head) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">
            {getPayHeadTypeLabel(head.payHeadType)}
          </span>
        ),
      },
      {
        id: "calculationType",
        header: "Calc type",
        cell: (head) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">
            {getCalculationTypeLabel(head.calculationType)}
          </span>
        ),
      },
      {
        id: "rate",
        header: "Rate/%",
        align: "right",
        financial: true,
        cell: (head) => (
          <span className="ds-financial-value">{rateDisplay(head)}</span>
        ),
      },
      {
        id: "affectsNetSalary",
        header: "Affects net",
        align: "center",
        cell: (head) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              head.affectsNetSalary
                ? "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]"
                : "bg-[var(--ds-surface-muted)] text-[var(--ds-text-muted)]"
            }`}
          >
            {head.affectsNetSalary ? "Yes" : "No"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        cell: (head) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              head.isActive
                ? "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]"
                : "bg-[var(--ds-surface-muted)] text-[var(--ds-text-muted)]"
            }`}
          >
            {head.isActive ? "Active" : "Inactive"}
          </span>
        ),
      },
    ],
    [],
  );

  const ledgerOptions = (accounts || []).filter((acc) => !acc.isGroup);

  return (
    <div className="flex h-full min-h-0 bg-[var(--ds-canvas)]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0 flex flex-col gap-3">
          <PageHeader
            title="Pay heads"
            description="Manage earnings, deductions, and statutory pay components"
            meta={
              <PageMeta>
                {filteredHeads.length} of {(payHeads || []).length} pay heads
              </PageMeta>
            }
            primaryAction={
              <Button
                variant="primary"
                size="small"
                onClick={openAdd}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Add pay head
              </Button>
            }
            secondaryActions={[
              ...(branchOptions.length > 0
                ? [
                    <select
                      key="branch"
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-lg bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
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

          <div className="relative max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-subtle)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search pay heads..."
              className={`${inputCls} pl-8`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
          <EnterpriseDataTable
            columns={columns}
            rows={filteredHeads}
            getRowId={(head) => head.id}
            loading={initLifecycle === "loading"}
            emptyTitle={searchTerm ? "No pay heads match your search" : "No pay heads found"}
            emptyDescription={
              searchTerm
                ? "Try a different search term."
                : 'Click "Add pay head" to create your first pay head.'
            }
            emptyAction={
              !searchTerm ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={openAdd}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add pay head
                </Button>
              ) : undefined
            }
            onRowClick={loadFormForEdit}
            rowActions={(head) => [
              { label: "Edit", onSelect: () => loadFormForEdit(head) },
              { label: "Delete", destructive: true, onSelect: () => handleDelete(head) },
            ]}
            caption="Pay heads"
          />
        </div>
      </div>

      {showForm && (
        <div className="w-[min(560px,100%)] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <span className="text-[13px] font-semibold text-gray-700">
              {selected ? "Edit pay head" : "Add pay head"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" aria-label="Close form" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div>
              <label className={labelCls}>
                Pay head name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter pay head name"
                autoFocus
              />
            </div>

            <div>
              <label className={labelCls}>
                Pay head type <span className="text-red-500">*</span>
              </label>
              <select
                className={inputCls}
                value={form.payHeadType}
                onChange={(e) => setForm({ ...form, payHeadType: e.target.value })}
              >
                <option value="">— Select type —</option>
                <option value="earnings">Earnings</option>
                <option value="deductions">Deductions</option>
                <option value="employer_contribution">Employer Contribution</option>
                <option value="reimbursement">Reimbursement</option>
                <option value="loans_advances">Loans & Advances</option>
                <option value="statutory">Statutory</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Linked ledger/account</label>
              <select
                className={inputCls}
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              >
                <option value="">— None —</option>
                {ledgerOptions.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex flex-col gap-2.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] mt-0.5"
                    checked={form.affectsNetSalary}
                    onChange={(e) => setForm({ ...form, affectsNetSalary: e.target.checked })}
                  />
                  <span className="text-[12px] font-medium text-gray-700 leading-tight">
                    Affects net salary
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] mt-0.5"
                    checked={form.ssfApplicable}
                    onChange={(e) => setForm({ ...form, ssfApplicable: e.target.checked })}
                  />
                  <span className="text-[12px] font-medium text-gray-700 leading-tight">
                    SSF applicable
                    <span className="block text-[12px] text-gray-500 font-normal">
                      Social Security Fund
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] mt-0.5"
                    checked={form.citApplicable}
                    onChange={(e) => setForm({ ...form, citApplicable: e.target.checked })}
                  />
                  <span className="text-[12px] font-medium text-gray-700 leading-tight">
                    CIT applicable
                    <span className="block text-[12px] text-gray-500 font-normal">
                      Citizen Investment Trust
                    </span>
                  </span>
                </label>
              </div>
              <div className="flex flex-col gap-2.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] mt-0.5"
                    checked={form.incomeTaxApplicable}
                    onChange={(e) => setForm({ ...form, incomeTaxApplicable: e.target.checked })}
                  />
                  <span className="text-[12px] font-medium text-gray-700 leading-tight">
                    Income tax (TDS) applicable
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] mt-0.5"
                    checked={form.pfApplicable}
                    onChange={(e) => setForm({ ...form, pfApplicable: e.target.checked })}
                  />
                  <span className="text-[12px] font-medium text-gray-700 leading-tight">
                    PF applicable
                    <span className="block text-[12px] text-gray-500 font-normal">
                      Provident Fund
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] mt-0.5"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <span className="text-[12px] font-medium text-gray-700 leading-tight">
                    Active
                  </span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Calculation type</label>
                <select
                  className={inputCls}
                  value={form.calculationType}
                  onChange={(e) => setForm({ ...form, calculationType: e.target.value })}
                >
                  <option value="flat_rate">Flat Rate</option>
                  <option value="pct_of_basic">% of Basic</option>
                  <option value="pct_of_gross">% of Gross</option>
                  <option value="attendance_based">Attendance Based</option>
                  <option value="production_based">Production Based</option>
                  <option value="formula">Formula</option>
                  <option value="user_defined">User Defined</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Calculation period</label>
                <select
                  className={inputCls}
                  value={form.calculationPeriod}
                  onChange={(e) => setForm({ ...form, calculationPeriod: e.target.value })}
                >
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
            </div>

            {(form.calculationType === "flat_rate" ||
              form.calculationType === "attendance_based") && (
              <div>
                <label className={labelCls}>Rate (NPR)</label>
                <input
                  type="number"
                  className={`${inputCls} font-mono`}
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step="any"
                  placeholder="0.00"
                />
              </div>
            )}

            {(form.calculationType === "pct_of_basic" ||
              form.calculationType === "pct_of_gross") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Percentage</label>
                  <input
                    type="number"
                    className={`${inputCls} font-mono`}
                    value={form.percentage}
                    onChange={(e) =>
                      setForm({ ...form, percentage: parseFloat(e.target.value) || 0 })
                    }
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>Based on pay head</label>
                  <select
                    className={inputCls}
                    value={form.basedOnPayHeadId}
                    onChange={(e) => setForm({ ...form, basedOnPayHeadId: e.target.value })}
                  >
                    <option value="">— Select pay head —</option>
                    {(payHeads || [])
                      .filter((ph) => ph.id !== selected?.id)
                      .map((ph) => (
                        <option key={ph.id} value={ph.id}>
                          {ph.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            {form.calculationType === "formula" && (
              <div>
                <label className={labelCls}>Formula</label>
                <textarea
                  className="w-full px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] resize-none h-16"
                  value={form.formula}
                  onChange={(e) => setForm({ ...form, formula: e.target.value })}
                  placeholder="Enter formula..."
                />
              </div>
            )}

            <div>
              <label className={labelCls}>Rounding method</label>
              <select
                className={inputCls}
                value={form.roundingMethod}
                onChange={(e) => setForm({ ...form, roundingMethod: e.target.value })}
              >
                <option value="normal">Normal</option>
                <option value="up">Up</option>
                <option value="down">Down</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-200 shrink-0">
            <button type="button" className={btnPrimary} onClick={handleSubmit}>
              <Save className="h-3.5 w-3.5" />
              {selected ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayHeadMaster;
